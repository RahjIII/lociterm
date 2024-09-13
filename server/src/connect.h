/* connect.h - <comment goes here> */
/* Created: Sun Aug  4 10:09:40 PM EDT 2024 malakai */
/* $Id: connect.h,v 1.1 2024/09/13 14:32:58 malakai Exp $ */

/* Copyright © 2022-2024 Jeff Jahr <malakai@jeffrika.com>
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


#ifndef LOCI_CONNECT_H
#define LOCI_CONNECT_H

/* global #defines */

/* structs and typedefs */

/* exported global variable declarations */

/* exported function declarations */
int loci_connect_verbose(proxy_conn_t *pc, char *msg);
int loci_connect_requested_game(proxy_conn_t *pc);
int loci_connect_to_game_host(proxy_conn_t *pc, char *hostname, int port, int ssl);
int loci_connect_to_game_uuid(proxy_conn_t *pc,char *uuid);


#endif /* LOCI_CONNECT_H */
