/* game.h - <comment goes here> */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: game.h,v 1.6 2024/12/06 04:59:51 malakai Exp $ */

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

#ifndef LO_GAME_H
#define LO_GAME_H

#include "iostats.h"
#include <netinet/tcp.h>

/* global #defines */

/* structs and typedefs */
typedef struct game_conn {

	struct lws *wsi_game; 			/* LWS wsi for game raw socket */
	proxy_state_t game_state;		/* current loci interface state */
	GQueue *game_q;					/* Game side data queue */
	telnet_t *game_telnet;			/* telnet protocol tracker */
	gchar *uuid;					/* reconnect key for this game connection. */
	char *hostname;					/* for consistency with client */
	int port;						/* for ease of access */
	int ssl;						/* for ease of access */

	struct iostat_data *ios;		/* iostat structure for bytes in/out */
	struct tcp_info tcp_info;		/* for monitoring tcp stats like rtt */

	int check_wait;					/* Protocol verification timer */
	int check_protocol;				/* Protocol verification flags */
	
	int request_mssp;				/* include mssp in connection request? */

	int ttype_state;				/* */
	int data_sent;
	int reconnections;

	proxy_conn_t *pc;				/* pointer to parent proxy context. */
	
} game_conn_t;

/* exported global variable declarations */

/* exported function declarations */
game_conn_t *new_game_conn(void);
void free_game_conn(game_conn_t *f);


void loci_game_write(proxy_conn_t *pc, char *in, size_t len);
int loci_game_telopt_active(proxy_conn_t *pc,uint8_t telopt);
void loci_game_charset_apply(proxy_conn_t *pc,const char *charset, int inform_server);

int callback_loci_game(
	struct lws *wsi, enum lws_callback_reasons reason,
	void *user, void *in, size_t len
);

#endif /* LO_GAME_H */
