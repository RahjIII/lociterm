/* scan.h - locibot game scanner and crawler */
/* Created: Sat Jan 25 01:55:54 PM EST 2025 malakai */
/* $Id: $ */

/* Copyright © 2022-2025 Jeff Jahr <malakai@jeffrika.com>
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

#ifndef LO_SCAN_H
#define LO_SCAN_H

#include "locid.h"
#include "uv.h"

/* global #defines */

/* structs and typedefs */
typedef struct scan_tbd_entry {
	int id;
	char *host;
	int port;
	int ssl;
	int laststatus;
	int status;
} scan_tbd_entry_t;

/* exported global variable declarations */

/* exported function declarations */
void free_scan_tbd_entry(struct scan_tbd_entry *f);
void scanner_finalize(proxy_conn_t *pc);
void scanner_init(uv_loop_t *uvloop,struct locid_conf *config);
void scanner_update_status(proxy_conn_t *pc,int dbstatus);


#endif /* LO_SCAN_H */
