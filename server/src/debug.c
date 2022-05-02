/* debug.c - Debugging code for locid */
/* Created: Wed Mar  3 11:09:27 PM EST 2021 malakai */
/* $Id: debug.c,v 1.1 2022/05/02 02:35:25 malakai Exp $*/

/* Copyright © 2021 Jeff Jahr <malakai@jeffrika.com>
 *
 */

#include <stdio.h>
#include <stdarg.h>
#include <time.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>
#include <stdlib.h>
#include <errno.h>

#include "debug.h"

FILE *locid_logfile;

void locid_log_init(char *pathname) {
	FILE *out;

	locid_logfile = stderr;
	if(pathname && *pathname) {
		if(! (out=fopen(pathname,"w+"))) {
			locid_log("Can't open log file %s: %s",pathname,strerror(errno));
			exit(EXIT_FAILURE);
		}
		locid_logfile = out;
	}
}
	
void locid_log(char *str, ...)
{
	va_list ap;
	long ct;
	char *tmstr;
	char vbuf[LOG_BUF_LEN];
	int slen;
	char nl='\n';

	va_start(ap, str);
	vsnprintf(vbuf, sizeof(vbuf) - 1, str, ap);
	va_end(ap);

	ct = time(0);
	tmstr = asctime(localtime(&ct));
	*(tmstr + strlen(tmstr) - 1) = '\0';

	if((slen = strlen(vbuf))>0) {
		if((*(vbuf+slen-1)) == '\n') {
			nl='\0';
		}
	}

	fprintf(locid_logfile, "%s %s%c", tmstr, vbuf,nl);
}

int locid_ssl_err_cb(const char *str, size_t len, void *u) {
	locid_log("%s: %.*s",(char *)u,len-1,str);
	return(0);
}

/* defining this to return 0 tells lws not to include a timestamp. */
int lwsl_timestamp(int level, char *p, size_t len) {
	return(0);
}

/* ...cause we'll be using this logger instead. */
void locid_log_lws(int level, char *str) {
	locid_log("%d:%s",level,str);
}
