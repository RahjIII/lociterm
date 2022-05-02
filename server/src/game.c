/* game.c - LociTerm game side protocols */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: game.c,v 1.2 2022/05/02 03:18:36 malakai Exp $*/

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

#include <libwebsockets.h>
#include <string.h>
#include <signal.h>
#include <string.h>
#include <glib.h>

#include "libtelnet.h"

#include "locilws.h"
#include "client.h"
#include "debug.h"

#include "game.h"

/* structures and types */

/* local function declarations */

/* locals */

/* functions */

void loci_game_write(proxy_conn_t *pc, char *in, size_t len) {
	proxy_msg_t *msg;
	uint8_t *data;

	/* notice we over-allocate by LWS_PRE + rx len */
	msg = (proxy_msg_t *)malloc(sizeof(*msg) + LWS_PRE + sizeof(char) + len);
	data = (uint8_t *)&msg[1] + LWS_PRE;
	memset(msg, 0, sizeof(*msg));
	msg->len = len;
	/* The rest is the message. */
	/* INSERT TELNET PARSER HERE */
	memcpy(data,in,len);
	/* put it on the game q and request service. */
	g_queue_push_tail(pc->game_q,msg);
	lws_callback_on_writable(pc->wsi_game);
	return;
}
	

int loci_game_parse(proxy_conn_t *pc, char *in, size_t len) {
	/* INSERT TELNET PARSER HERE */
	/*loci_client_write(pc,in,len); */
	telnet_recv(pc->game_telnet,in,len);
	return(1);
}

/* primary lws callback for the game side of the proxy. */
int callback_loci_game(struct lws *wsi, enum lws_callback_reasons reason,
			  void *user, void *in, size_t len)
{
	proxy_conn_t *pc;
	proxy_msg_t *msg;
	uint8_t *data;
	int m, a;

	/* pc is stored in the wsi user data area.  fetch it.  (pc may come back
	 * NULL on the first time this is called, but that's ok.)*/
	pc = (proxy_conn_t *)lws_get_opaque_user_data(wsi);

	switch (reason) {
	case LWS_CALLBACK_CLIENT_CONNECTION_ERROR:
		lwsl_warn("%s: onward game connection failed\n", __func__);
		pc->wsi_game = NULL;
		/* close the websocket side, rather than hang... */
		if(pc->wsi_client) {
			lws_wsi_close(pc->wsi_client, LWS_TO_KILL_ASYNC);
		}
		break;

	case LWS_CALLBACK_RAW_ADOPT:
		lwsl_user("LWS_CALLBACK_RAW_ADOPT\n");
		pc->wsi_game = wsi;
		lws_callback_on_writable(wsi);
		break;

	case LWS_CALLBACK_RAW_CLOSE:
		lwsl_user("LWS_CALLBACK_RAW_CLOSE\n");
		/*
		 * Clean up any pending messages to us that are never going
		 * to get delivered now, we are in the middle of closing
		 */
		empty_proxy_queue(pc->game_q);

		/*
		 * Remove our pointer from the proxy_conn... we are about to
		 * be destroyed.
		 */
		pc->wsi_game = NULL;
		lws_set_opaque_user_data(wsi, NULL);

		if (!pc->wsi_client) {
			/*
			 * The original ws conn is already closed... then we are
			 * the last guy still holding on to the proxy_conn...
			 * and we're going away, so let's destroy it
			 */

			free_proxy_conn(pc);
			break;
		}

		/* the game side is now gone, but the client side may still have final
		 * messages to deliver.  The LWS example code would close with
		 * lws_wsi_close(pc->wsi_client, LWS_TO_KILL_ASYNC) if the client queue
		 * was empty, but that seems too abrupt, in that the client side
		 * frequently didn't get the final "logout" message text before
		 * closing.  Always taking the lws_set_timeout route allows that last
		 * message to be seen. The number after the define is seconds.-jsj */
		lws_set_timeout(pc->wsi_client,
			PENDING_TIMEOUT_KILLED_BY_PROXY_CLIENT_CLOSE, 1
		); 
		break;

	case LWS_CALLBACK_RAW_RX:
		lwsl_user("LWS_CALLBACK_RAW_RX (%d)\n", (int)len);
		if (!pc || !pc->wsi_client)
			break;

		/* FIXME dencapsulate inbound from the game here. The ufiltered data
		 * is at *in.  It needs its telnet protocol stripped, and then
		 * sent on to the outbound client q.*/
		loci_game_parse(pc,in,len);
	
		break;

	case LWS_CALLBACK_RAW_WRITEABLE:
		lwsl_user("LWS_CALLBACK_RAW_WRITEABLE\n");
		if (!pc || g_queue_is_empty(pc->game_q))
			break;

		msg = g_queue_pop_head(pc->game_q);
		data = (uint8_t *)&msg[1] + LWS_PRE;

		/* notice we allowed for LWS_PRE in the payload already */
		m = lws_write(wsi, data, msg->len, LWS_WRITE_BINARY); /* jsj should this be LWS_WRITE_BINARY? */
		a = (int)msg->len;
		free(msg);

		if (m < a) {
			lwsl_err("ERROR %d writing to raw\n", m);
			return -1;
		}

		/*
		 * If more to do...
		 */
		if (!(g_queue_is_empty(pc->game_q))) {
			lws_callback_on_writable(wsi);
		}
		break;
	default:
		break;
	}

	return 0;
}

