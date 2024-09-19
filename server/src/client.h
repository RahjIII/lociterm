/* client.h - LociTerm client side protocols */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: client.h,v 1.9 2024/09/19 17:03:30 malakai Exp $ */

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

#include "iostats.h"

/* global #defines */

/* These defines MUST MATCH the ones in ../../client/lociterm.js ! */
#define HELLO 0
#define TERM_DATA 1
#define COMMAND 2
#define CONNECT 3
#define DISCONNECT 4
#define ECHO_MODE 5
#define RESIZE_TERMINAL 6
#define GMCP_DATA 7
#define GAME_LIST 8
#define MORE_INFO 9
/* special reserved numbers, used to detect connection from lociterm 1.0, which
 * doesn't have a HELLO message. */
#define OLD_LOCITERM_OUTPUT 48
#define OLD_LOCITERM 49

/* structs and typedefs */

typedef struct client_conn {

	/* client side elements */
	struct lws *wsi_client;			/* LWS wsi for client websocket. */
	proxy_state_t client_state;		/* current loci interface state */
	GQueue *client_q;				/* Client side data queue */

	struct iostat_data *ios;		/* iostat structure for bytes in/out */

	char *hostname;					/* Hostname of the calling client. */
	gchar *useragent;				/* User agent reported by clients browser */
	int width;						/* terminal window char width for NAWS */
	int height;						/* terminal window char height for NAWS */
	json_object *requested_game;	/* TEMPORARY storage for game request from client. */

	proxy_conn_t *pc;				/* pointer to parent proxy context. */

} client_conn_t;

/* exported global variable declarations */

/* exported function declarations */
client_conn_t *new_client_conn(void);
void free_client_conn(client_conn_t *f);

void loci_client_send_cmd(proxy_conn_t *pc, char cmd, char *in, size_t len);
void loci_client_write(proxy_conn_t *pc, char *in, size_t len);

int callback_loci_client(
	struct lws *wsi, enum lws_callback_reasons reason,
	void *user, void *in, size_t len
);
int loci_connect_to_game_number(proxy_conn_t *pc, int gameno);
void loci_client_send_key(proxy_conn_t *pc);
void loci_client_send_connectmsg(proxy_conn_t *pc, char *state, char *msg);
int loci_client_json_cmd_parse(proxy_conn_t *pc,char *str, size_t len);

#endif /* LO_CLIENT_H */
