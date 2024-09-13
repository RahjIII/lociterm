/* client.h - LociTerm client side protocols */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: client.h,v 1.8 2024/09/13 14:32:58 malakai Exp $ */

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
#define OUTPUT 0
#define SET_WINDOW_TITLE 1
#define SET_PREFERENCES 2
#define RECV_CMD 3
#define RECONNECT_KEY_OLD 7
#define GMCP_OUTPUT 8
#define CONNECT_VERBOSE 9
#define ECHO_MODE 10 
#define GAME_LIST 11

// from web client message
#define INPUT 0
#define RESIZE_TERMINAL 1
#define PAUSE 2
#define RESUME 3
#define CONNECT_GAME 5
#define SEND_CMD 6
#define DISCONNECT_GAME 7
#define GMCP_INPUT 8
#define CONNECT_VERBOSE 9
#define GAME_LIST 11
#define MORE_INFO 12

/* structs and typedefs */

typedef struct client_conn {

	/* client side elements */
	struct lws *wsi_client;			/* LWS wsi for client websocket. */
	proxy_state_t client_state;		/* current loci interface state */
	GQueue *client_q;				/* Client side data queue */
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
