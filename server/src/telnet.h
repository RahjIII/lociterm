/* telnet.h - LociTerm libtelnet handlers */
/* Created: Fri Apr 29 03:01:13 PM EDT 2022 malakai */
/* $Id: telnet.h,v 1.2 2022/05/02 03:18:36 malakai Exp $ */

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


#ifndef LO_TELNET_H
#define LO_TELNET_H

/* global #defines */

/* structs and typedefs */

/* exported global variable declarations */


/* exported function declarations */

void free_telopts(telnet_telopt_t *t);
telnet_t *loci_telnet_init(proxy_conn_t *pc);
void loci_telnet_free(proxy_conn_t *pc);
void loci_telnet_send_naws(telnet_t *telnet, int width, int height);
void loci_environment_init(proxy_conn_t *pc);
void loci_environment_free(proxy_conn_t *pc);

#endif /* LO_TELNET_H */