/* game.c - LociTerm game side protocols */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: game.c,v 1.11 2024/12/06 04:59:51 malakai Exp $*/

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
#include <glib.h>

#include "libtelnet.h"

#include "debug.h"
#include "proxy.h"
#include "connect.h"
#include "telnet.h"
#include "gamedb.h"
#include "iostats.h"

#include "game.h"

/* structures and types */

/* local function declarations */

/* locals */

/* functions */

game_conn_t *new_game_conn(void) {
	game_conn_t *n;

	n = (game_conn_t *)malloc(sizeof(game_conn_t));
	/* lws example code always does this to its embedded struct lws's. Doesn't
	 * hurt to do it to the whole game_conn_t.*/
	memset(n, 0, sizeof(*n));  

	n->wsi_game = NULL;
	n->game_q = g_queue_new();
	n->game_state = PRXY_INIT;
	n->game_telnet = NULL;
	n->uuid = g_uuid_string_random();
	n->ttype_state = 0;

	n->ios = iostat_new();

	n->check_wait = 0;
	n->check_protocol = 0;
	n->echo_opt = 0;
	n->sga_opt = 0;
	n->eor_opt = 0;
	n->gmcp_opt = 0;
	n->data_sent = 0;
	
	return(n);
}

void free_game_conn(game_conn_t *f) {

	if(f->wsi_game) {
		lws_set_opaque_user_data(f->wsi_game, NULL);
		lws_wsi_close(f->wsi_game, LWS_TO_KILL_SYNC);
		f->wsi_game = NULL;
	}

	if(f->game_q) {
		empty_proxy_queue(f->game_q);
		g_queue_free(f->game_q);
		f->game_q = NULL;
	}

	if(f->game_telnet) {
		telnet_free(f->game_telnet);
		f->game_telnet = NULL;
	}

	if(f->uuid) g_free(f->uuid);
	f->uuid = NULL;

	if(f->ios) iostat_free(f->ios);
	f->ios = NULL;

	f->echo_opt = 0;
	f->sga_opt = 0;

	f->pc = NULL;
	free(f);
}


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
	g_queue_push_tail(pc->game->game_q,msg);
	if(pc->game->wsi_game) {
		lws_callback_on_writable(pc->game->wsi_game);
	}
	return;
}
	

int loci_game_parse(proxy_conn_t *pc, char *in, size_t len) {
	if(pc->game->game_telnet) {
		telnet_recv(pc->game->game_telnet,in,len);
	}
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

	locid_debug(DEBUG_EVENTNO,pc,"event: %d.",reason);

	/* any event triggers a timeout check. */
	if(pc && (get_game_state(pc) == PRXY_BLOCKING) ) {
		security_enforcement(pc);
	}

	/* some special handling for proxy forced close or reconnect message when
	 * the game side wsi is already active.  */
	if( (reason == LWS_CALLBACK_RAW_WRITEABLE) ) {
		if( (pc->game->game_state == PRXY_CLOSING) ||
			(pc->game->game_state == PRXY_RECONNECTING)
		) {
			locid_debug(DEBUG_GAME,pc,"force game side to close.");
			reason = LWS_CALLBACK_RAW_CLOSE;
		}
	}

	switch (reason) {
	case LWS_CALLBACK_CLIENT_CONNECTION_ERROR:
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_CLIENT_CONNECTION_ERROR.");
		locid_info(pc,"game lws connection error.");
		if(game_db_get_status(pc) == DBSTATUS_NOT_CHECKED) {
			game_db_update_status(pc,DBSTATUS_NO_ANSWER);
		}
		pc->game->wsi_game = NULL;
		set_game_state(pc,PRXY_INIT);
		/* close the websocket side, rather than hang... */
		loci_client_shutdown(pc);
		break;

	case LWS_CALLBACK_CONNECTING:
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_CONNECTING");
		set_game_state(pc,PRXY_CONNECTING);
		pc->game->echo_opt = pc->game->sga_opt = pc->game->data_sent = 0;
		break;

	case LWS_CALLBACK_WSI_CREATE:
		/* happens after LWS_CALLBACK_CONNECTING */
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_WSI_CREATE");
		//set_game_state(pc,PRXY_DOWN);
		//pc->game->wsi_game = wsi;
		//lws_callback_on_writable(wsi);
		break;

	case LWS_CALLBACK_RAW_ADOPT:
		/* Not really sure when or if this happens. */
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_RAW_ADOPT");
		// set_game_state(pc,PRXY_DOWN);
		// pc->game->wsi_game = wsi;
		// lws_callback_on_writable(wsi);
		break;

	case LWS_CALLBACK_RAW_CONNECTED:
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_RAW_CONNECTED");
		locid_info(pc,"Game side connected.");
		game_db_update_lastconnection(pc);
		loci_telnet_init(pc->game);
		if(pc->game->check_protocol || pc->game->check_wait) {
			locid_info(pc,"Blocking for protocol check.");
			set_game_state(pc,PRXY_BLOCKING);
		} else {
			locid_info(pc,"No protocol check required.");
			/* We're connected, no more security checks, so mark approved. */
			if(game_db_get_status(pc) == DBSTATUS_NOT_CHECKED) {
				game_db_update_status(pc,DBSTATUS_APPROVED);
			}
			set_game_state(pc,PRXY_UP);
			loci_client_send_echosga(pc);
		}
		/* arrange for a timer pulse for idle timeout and rate tracking. */
		lws_set_timer_usecs(wsi,IDLE_TIMER_USEC);
		break;

	case LWS_CALLBACK_RAW_CLOSE: {
		if(!pc) return(-1);
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_RAW_CLOSE\n");

		char buf[1024];
		iostat_printhuman(buf,sizeof(buf),pc->game->ios);
		locid_info(pc,"game closed: %s",buf);
		/*
		 * Clean up any pending messages to us that are never going
		 * to get delivered now, we are in the middle of closing
		 */
		empty_proxy_queue(pc->game->game_q);

		/*
		 * Remove our pointer from the proxy_conn... we are about to
		 * be destroyed.
		 */
		pc->game->wsi_game = NULL;
		lws_set_opaque_user_data(wsi, NULL);

		/* does this signal the end of both sides of the proxy? */
		if (get_client_state(pc) <= PRXY_DOWN) {
			/*
			 * The original ws conn is already closed... then we are
			 * the last guy still holding on to the proxy_conn...
			 * and we're going away, so let's destroy it
			 */
			/* locid_info(pc,"Proxy Session Ends.");
			free_proxy_conn(pc); */
			loci_proxy_shutdown(pc);
			break;
		}

		if( (get_game_state(pc) == PRXY_BLOCKING) &&
			(game_db_get_status(pc) == DBSTATUS_NOT_CHECKED)
		) {
			/* a security check was in process, but the connection has closed
			 * without passing.*/
			game_db_update_status(pc,DBSTATUS_BAD_PROTOCOL);
			locid_info(pc,"game didn't meet protocol requirements.");
		}

		if( (get_game_state(pc) == PRXY_RECONNECTING) ) {

			free_game_conn(pc->game);
			pc->game = new_game_conn();
			pc->game->pc = pc;
			return(loci_connect_requested_game(pc));

		} else {
			set_game_state(pc,PRXY_DOWN);
			locid_debug(DEBUG_GAME,pc,"game side down, shutting down client side.");
			/* Trigger client side close. */
			loci_client_shutdown(pc);
		} 

		break;
	}

	case LWS_CALLBACK_RAW_RX:
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_RAW_RX (%d)", (int)len);
		//if (!pc || !pc->client->wsi_client)
		if (!pc)
			break;

		iostat_incr(pc->game->ios,len,0);
		
		if(get_game_state(pc) != PRXY_CLOSING) {
			loci_game_parse(pc,in,len);
		}
		if(get_game_state(pc) == PRXY_BLOCKING) {
			if( pc->game->check_protocol == 0 ) {
				/* all of the checks are cleared. */
				pc->game->check_wait = 0;
				locid_debug(DEBUG_TELNET,pc,"All protocol checks PASSED, unblocking.");
				game_db_update_status(pc,DBSTATUS_APPROVED);
				locid_info(pc,"game passed protocol requirements.");
				set_game_state(pc,PRXY_UP);
			}
		}
	
		break;

	case LWS_CALLBACK_RAW_WRITEABLE:
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_RAW_WRITEABLE");
		if (!pc || g_queue_is_empty(pc->game->game_q))
			break;

		msg = g_queue_pop_head(pc->game->game_q);
		data = (uint8_t *)&msg[1] + LWS_PRE;

		/* notice we allowed for LWS_PRE in the payload already */
		m = lws_write(wsi, data, msg->len, LWS_WRITE_BINARY); 
		a = (int)msg->len;
		free(msg);

		if (m < a) {
			locid_debug(DEBUG_LWS,pc,"ERROR %d writing to raw", m);
			return -1;
		}

		iostat_incr(pc->game->ios,0,m);

		/*
		 * If more to do...
		 */
		if (!(g_queue_is_empty(pc->game->game_q))) {
			lws_callback_on_writable(wsi);
		}
		break;

	case LWS_CALLBACK_TIMER: {
		locid_debug(DEBUG_LWS,pc,"LWS_CALLBACK_TIMER");
		if(!pc) break;

		iostat_checkpoint(pc->game->ios,0.9);

		if(global_debug_facility & DEBUG_GAME) {
			char buf[4096];
			iostat_printhrate(buf,sizeof(buf),pc->game->ios);
			locid_debug(DEBUG_GAME,pc,buf);
		}

		/* don't forget to reschedule. */
		lws_set_timer_usecs(wsi,IDLE_TIMER_USEC);

		/* and pet the doggie. */
		if(loci_proxy_watchdog(pc)) {
			loci_proxy_shutdown(pc);
		}

		break;
	}

	default:
		break;
	}

	return 0;
}

