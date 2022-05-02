/* debug.h - Debugging code for locid */
/* Created: Wed Mar  3 11:09:27 PM EST 2021 malakai */
/* $Id: debug.h,v 1.2 2022/05/02 03:18:36 malakai Exp $*/

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

/* global #defines */
#define LOG_BUF_LEN 8192

/* structs and typedefs */

/* exported global variable declarations */

/* exported function declarations */
void locid_log_init(char *pathname);
void locid_log(char *str, ...);
void locid_log_lws(int level, char *str);

#endif /* LOCID_DEBUG_H */
