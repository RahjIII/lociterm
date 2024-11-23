/* debug.h - Debugging code for locid */
/* Created: Wed Mar  3 11:09:27 PM EST 2021 malakai */
/* $Id: debug.h,v 1.7 2024/11/23 16:33:25 malakai Exp $*/

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

#ifndef LOCID_DEBUG_H
#define LOCID_DEBUG_H

#include "proxy.h"

/* global #defines */
#define DEBUG_BREAK		(1<<0)
#define DEBUG_LOG		(1<<1)
#define DEBUG_CLIENT	(1<<2)
#define DEBUG_GAME		(1<<3)
#define DEBUG_MSSP		(1<<4)
#define DEBUG_LWS		(1<<5)
#define DEBUG_TELNET	(1<<6)
#define DEBUG_DB		(1<<7)
#define DEBUG_EVENTNO	(1<<8)
#define DEBUG_PROXY		(1<<9)

#define DEBUG_MAX		(10)
#define DEBUG_ALL		((1<<DEBUG_MAX)-1)

#define DEBUG_OFF (DEBUG_LOG)
//#define DEBUG_ON (DEBUG_LOG|DEBUG_PROXY|DEBUG_GAME|DEBUG_CLIENT|DEBUG_TELNET|DEBUG_DB|DEBUG_LWS)
#define DEBUG_ON DEBUG_ALL

#define locid_debug(facility, pc, args...) if(global_debug_facility & facility) { locid_Debug( __func__, facility, pc, args); }

#define locid_info(pc, args...) if (1) { locid_Debug(NULL, DEBUG_LOG, pc, args); }

#define LOG_BUF_LEN 8192

/* structs and typedefs */

/* exported global variable declarations */
extern unsigned int global_debug_facility;

/* exported function declarations */
void locid_log_init(char *pathname);
void locid_log(char *str, ...);
void locid_log_lws(int level, char *str);
void locid_Debug(const char *caller, int facility, proxy_conn_t *pc, char *str, ...);
int locid_breakpoint(int code);


#endif /* LOCID_DEBUG_H */
