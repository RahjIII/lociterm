/* client.h - LociTerm client side protocols */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: client.h,v 1.6 2023/02/12 17:45:05 malakai Exp $ */

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

#ifndef LO_CLIENT_H
#define LO_CLIENT_H

/* global #defines */

// to web client message
#define OUTPUT '0'
#define SET_WINDOW_TITLE '1'
#define SET_PREFERENCES '2'
#define RECV_CMD '3'
#define RECONNECT_KEY '7'

// from web client message
#define INPUT '0'
#define RESIZE_TERMINAL '1'
#define PAUSE '2'
#define RESUME '3'
#define CONNECT_GAME '5'
#define SEND_CMD '6'
#define DISCONNECT_GAME '7'

/* structs and typedefs */


/* exported global variable declarations */

/* exported function declarations */

void loci_client_write(proxy_conn_t *pc, char *in, size_t len);

int callback_loci_client(
	struct lws *wsi, enum lws_callback_reasons reason,
	void *user, void *in, size_t len
);
void loci_client_invalidate_key(proxy_conn_t *pc);

#endif /* LO_CLIENT_H */
