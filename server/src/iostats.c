/* iostats.c - per connection io statistics */
/* Created: Fri Feb 16 11:16:41 AM EST 2024 malakai */
/* Copyright © 1991-2024 The Last Outpost Project */
/* $Id: iostats.c,v 1.1 2024/09/19 17:03:30 malakai Exp $ */

#include <stdio.h>
#include <ctype.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/time.h>
#include <glib.h>

#include "iostats.h"

/* local #defines */

/* structs and typedefs */

/* local variable declarations */

/* local function declarations */

struct iostat_data *iostat_new(void) {
	struct iostat_data *new;
	new = (struct iostat_data *)malloc(sizeof(struct iostat_data));
	iostat_init(new);
	return(new);
}

void iostat_free(struct iostat_data *ios) {
	if(!ios) return;
	free(ios);
}

void iostat_counter_init(struct iostat_counter *ioc) {
	if(!ioc) return;
	gettimeofday( &(ioc->ts), NULL );
	ioc->in = 0;
	ioc->out = 0;
}

void iostat_init(struct iostat_data *ios) {
	if(!ios) return;
	iostat_counter_init(&(ios->lifetime));
	iostat_counter_init(&(ios->checkpoint));
	iostat_counter_init(&(ios->rate));
}

void iostat_incr(struct iostat_data *ios,int in, int out) {
	if(!ios) return;
	ios->lifetime.in += MAX(0,in);
	ios->lifetime.out += MAX(0,out);
}

/* call this every X seconds to generate a weighted rate.  (weight = 1.0) means
 * no weight given to historical value. */
void iostat_checkpoint(struct iostat_data *ios,double weight) {
	struct timeval now;
	struct timeval deltat;
	long int deltain, deltaout;

	if(!ios) return;

	gettimeofday(&now,NULL);

	deltain = ios->lifetime.in - ios->checkpoint.in;
	deltaout = ios->lifetime.out - ios->checkpoint.out;
	timersub(&now,&(ios->checkpoint.ts),&deltat);

	ios->rate.in = ((weight) * deltain) + ((1.0-weight) * ios->rate.in);
	ios->rate.out = ((weight) * deltaout) + ((1.0-weight) * ios->rate.out);
	ios->rate.ts = deltat;

	ios->checkpoint.in = ios->lifetime.in;
	ios->checkpoint.out = ios->lifetime.out;
	ios->checkpoint.ts = now;

}

int iostat_unitval(char *buf, size_t len, double val) {

	char *unit;

	if(val<1024) {
		return(g_snprintf(buf,len,"%0.0f ", val));
	} else {
		val = val / 1024;
		unit = "K";
		if(val>1024) {
			val = val / 1024;
			unit = "M";
			if(val>1024) {
				val = val / 1024;
				unit = "G";
				if(val>1024) {
					val = val / 1024;
					unit = "T";
				}
			}
		}
	}

	int s = g_snprintf(buf,len,"%'0.2f %s",
		val,
		unit
	);

	return(s);
}

int iostat_unitsec(char *buf, size_t len, double val) {

	char *unit;

	if(val<60) {
		unit = "sec";
	} else {
		val = val / 60;
		unit = "min";
		if(val>60) {
			val = val / 60;
			unit = "hr";
			if(val>24) {
				val = val / 24;
				unit = "day";
			}
		}
	}

	int s = g_snprintf(buf,len,"%'0.2f %s",
		val,
		unit
	);

	return(s);
}

int iostat_printraw(char *buf, size_t len, struct iostat_data *ios) {
	
	struct timeval now;
	struct timeval deltat;

	gettimeofday(&now,NULL);
	timersub(&now,&(ios->lifetime.ts),&deltat);

	int ret = g_snprintf(buf,len,"%ld B in, %ld B out, %ld s",
		ios->lifetime.in,
		ios->lifetime.out,
		deltat.tv_sec
	);

	return(ret);

}

int iostat_printhuman(char *buf, size_t len, struct iostat_data *ios) {
	
	struct timeval now;
	struct timeval deltat;
	char *s = buf;
	char *eos = buf+len;

	gettimeofday(&now,NULL);
	timersub(&now,&(ios->lifetime.ts),&deltat);

	s += iostat_unitval(s,eos-s,ios->lifetime.in);
	s += g_snprintf(s,eos-s,"B in, ");
	s += iostat_unitval(s,eos-s,ios->lifetime.out);
	s += g_snprintf(s,eos-s,"B out, ");

	s += iostat_unitsec(s,eos-s,(double)deltat.tv_sec+((double)deltat.tv_usec/1000000));

	return(s-buf);

}

int iostat_printhrate(char *buf, size_t len, struct iostat_data *ios) {
	
	char *s = buf;
	char *eos = buf+len;
	double deltat;

	if( (ios->rate.ts.tv_sec == 0) && (ios->rate.ts.tv_usec == 0)) {
		return(g_snprintf(buf,len,"No Rate Data."));
	}

	deltat = (double)(ios->rate.ts.tv_sec)+((double)(ios->rate.ts.tv_usec)/1000000.0);

	s += iostat_unitval(s,eos-s,ios->rate.in * 8 / deltat);
	s += g_snprintf(s,eos-s,"b/s in, ");
	s += iostat_unitval(s,eos-s,ios->rate.out * 8 / deltat);
	s += g_snprintf(s,eos-s,"b/s out, (");

	s += iostat_unitsec(s,eos-s,deltat);
	s += g_snprintf(s,eos-s,")");

	return(s-buf);

}
