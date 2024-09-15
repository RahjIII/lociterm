/* debug.c - Debugging and loggin code for LociTerm */
/* Created: Wed Mar  3 11:09:27 PM EST 2021 malakai */
/* $Id: debug.c,v 1.7 2024/09/15 16:39:29 malakai Exp $*/

/* Copyright © 2022 Jeff Jahr <malakai@jeffrika.com>
 *
 * This file is part of LociTerm - Last Outpost Client Implementation Terminal
 *
 * LociTerm is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * LociTerm is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
 * more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with LociTerm.  If not, see <https://www.gnu.org/licenses/>.
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

unsigned int global_debug_facility = DEBUG_OFF;

FILE *locid_logfile;

void locid_log_init(char *pathname) {
	FILE *out;

	locid_logfile = stderr;
	if(pathname && *pathname) {
		if(! (out=fopen(pathname,"a"))) {
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
	*vbuf = '\0';

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
	fflush(locid_logfile);
}

int locid_ssl_err_cb(const char *str, size_t len, void *u) {
	locid_log("%s: %.*s",(char *)u,len-1,str);
	return(0);
}

/* defining this to return 0 tells lws not to include a time stamp. */
int lwsl_timestamp(int level, char *p, size_t len) {
	return(0);
}

/* ...cause we'll be using this logger instead. */
void locid_log_lws(int level, char *str) {
	locid_Debug("LWS",DEBUG_LWS,NULL,"Level %d, %s",level,str);
}

void locid_Debug(const char *caller, int facility, proxy_conn_t *pc, char *str, ...) {

	va_list ap;
	char vbuf[LOG_BUF_LEN];
	char *v,*eov;

	if(((facility) & global_debug_facility) == 0) { 
		return;
	}

	v = vbuf;
	eov = vbuf + sizeof(vbuf)-1;

	if(pc) {
		v += g_snprintf(v,eov-v,"[%d] ",pc->id);
	}
	if(caller) {
		v += g_snprintf(v,eov-v,"%s(): ",caller);
	}

	va_start(ap,str);
	g_vsnprintf(v,eov-v,str,ap);
	va_end(ap);

	locid_log("%s",vbuf);

	if(global_debug_facility & DEBUG_BREAK) {
		locid_breakpoint(facility);
	}
}

int locid_breakpoint(int code) {
	static int count = 0;
	count++;
	return(count);
}

