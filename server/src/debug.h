/* debug.h - Debugging code for locid */
/* Created: Wed Mar  3 11:09:27 PM EST 2021 malakai */
/* $Id: debug.h,v 1.1 2022/05/02 02:35:25 malakai Exp $*/

/* Copyright © 2022 Jeff Jahr <malakai@jeffrika.com>
 *
 */

#ifndef LOCID_DEBUG_H
#define LOCID_DEBUG_H

/* global #defines */
#define LOG_BUF_LEN 8192

/* structs and typedefs */

/* exported global variable declarations */

/* exported function declarations */
void locid_log_init(char *pathname);
void locid_log(char *str, ...);
void locid_log_lws(int level, char *str);

#endif /* LOCID_DEBUG_H */
