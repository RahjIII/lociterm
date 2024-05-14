/* client.c - LociTerm client side protocols */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: client.c,v 1.14 2024/05/14 16:57:41 malakai Exp $*/

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
#include <json-c/json.h>

#include "libtelnet.h"

#include "locid.h"
#include "locilws.h"
#include "debug.h"
#include "game.h"
#include "telnet.h"

#include "client.h"

/* structures and types */

/* local function declarations */
int loci_client_parse(proxy_conn_t *pc, char *in, size_t len);
void loci_client_send_cmd(proxy_conn_t *pc, char cmd, char *in, size_t len);
int loci_connect_to_game(proxy_conn_t *pc, int gameno, char *uuid);
int loci_client_json_cmd_parse(proxy_conn_t *pc,char *in, size_t len);
void loci_client_send_key(proxy_conn_t *pc);

/* locals */

/* functions */

/* reads loci client protocol messages and acts on them. */
int loci_client_parse(proxy_conn_t *pc, char *in, size_t len) {

	int width = 80;
	int height = 25;
	char *s;
	int gameno=0;
	char *uuid;
	int ret;

	if (!in || !len) {
		return(-1);
	}

	switch (*in) {
		case INPUT:
			if(pc->wsi_game) {
				telnet_send_text(pc->game_telnet,in+1,len-1);
			}
			break;
		case GMCP_INPUT:
			if(pc->wsi_game) {
				loci_telnet_send_gmcp(pc->game_telnet,in+1,len-1);
			}
			break;
		case RESIZE_TERMINAL:
			width = 80;
			height =25;
			s = (char *)malloc(len);
			memset(s, 0, len);  
			memcpy(s,in+1,len-1);
			if( (sscanf(s,"%d %d",&width,&height)==2) ) {
				pc->width = width;
				pc->height = height;
			}
			free(s);
			if(pc->wsi_game) {
				loci_telnet_send_naws(pc->game_telnet,pc->width,pc->height);
			}
			lwsl_user("[%d] Terminal resized (%dx%d)",pc->id,pc->width,pc->height);

			break;
		case CONNECT_GAME:
			/* The message provides a number for 'connect to nth game', but
			 * it's not really implemented yet.  Always connect to game 0. */
			s = (char *)malloc(len);
			memset(s, 0, len);  
			memcpy(s,in+1,len-1);
			uuid = (char *)malloc(len);
			*uuid = '\0';
			if( (sscanf(s,"%d %s",&gameno,uuid)>=1) ) {
				if(*uuid) {
					ret = loci_connect_to_game(pc,gameno,uuid);
				} else {
					/* But I don't care, he gets the default game */
					ret = loci_connect_to_game(pc,gameno,NULL);
				}
			} else {
				locid_log("[%d] bad client CONNECT_GAME request.");
				ret = -1;
			}
			free(s);
			free(uuid);
			return(ret);

			break;
		case DISCONNECT_GAME:
			lws_set_timeout(pc->wsi_game,
				PENDING_TIMEOUT_KILLED_BY_PROXY_CLIENT_CLOSE, 1
			); 
			break;
		case SEND_CMD:
			loci_client_json_cmd_parse(pc,in+1,len-1);
			break;
		case PAUSE:
		case RESUME:
		default:
			locid_log("[%d] unimplemented client command.",pc->id);
			return(-1);
	}
	return(*in);
}

void loci_client_send_cmd(proxy_conn_t *pc, char cmd, char *in, size_t len) {

	proxy_msg_t *msg;
	uint8_t *data;

	/* notice we over-allocate by LWS_PRE + rx len */
	msg = (proxy_msg_t *)malloc(sizeof(*msg) + LWS_PRE + sizeof(char) + len);
	data = (uint8_t *)&msg[1] + LWS_PRE;
	memset(msg, 0, sizeof(*msg));
	msg->len = sizeof(char) + len;
	/* first byte of data is the cmd. */
	*data = cmd;
	/* The rest is the message. */
	memcpy(data+1,in,len);
	/* put it on the client q and request service. */
	g_queue_push_tail(pc->client_q,msg);
	if(pc->wsi_client) {
		lws_callback_on_writable(pc->wsi_client);
	}
	return;
}

/* send regular terminal data to the client. */
void loci_client_write(proxy_conn_t *pc, char *in, size_t len) {
	loci_client_send_cmd(pc,OUTPUT,in,len);
}

/* send the reconnection key to the client. */
void loci_client_send_key(proxy_conn_t *pc) {
	locid_log("[%d] sent current reconnect key %s.",pc->id,pc->uuid);
	loci_client_send_cmd(pc,RECONNECT_KEY,pc->uuid,strlen(pc->uuid));
}

void loci_client_invalidate_key(proxy_conn_t *pc) {
	locid_log("[%d] send invalidate key message.",pc->id);
	loci_client_send_cmd(pc,RECONNECT_KEY,"",0);
}

/* connect to the mud. */
int loci_connect_to_game_number(proxy_conn_t *pc, int gameno) {

	struct lws_client_connect_info info;

	if(pc->wsi_game != NULL) {
		lwsl_warn("%s: client requested a second connection?\n", __func__); 
		return(0);
	}

	locid_log("[%d] client requested gameno %d.",pc->id,gameno);

	/* lws example code likes to clear out structures before use */
	memset(&info, 0, sizeof(info));

	info.method = "RAW";
	info.context = lws_get_context(pc->wsi_client);
	info.port = config->game_port; 
	info.address = config->game_host;
	info.host = config->game_host;
	if(config->game_usessl) {
		info.ssl_connection = 
			LCCSCF_USE_SSL |
			LCCSCF_ALLOW_SELFSIGNED |
			LCCSCF_SKIP_SERVER_CERT_HOSTNAME_CHECK |
			LCCSCF_ALLOW_EXPIRED |
			LCCSCF_ALLOW_INSECURE;

	} else {
		info.ssl_connection = 0;
	}

	info.local_protocol_name = "loci-game";
	/* also mark this onward conn with the proxy_conn.  This is take from
	 * the lws example code.  probably should be lws_set_opaque_user_data()
	 * instead for clarity and consistency, but whatever. */
	info.opaque_user_data = pc;
	/* if the connect_via_info call succeeds, it'll set the wsi into the
	 * location pointed to by info.pwsi, in this case, the wsi_game field
	 * of the proxy_conn. */
	info.pwsi = &pc->wsi_game;

	/* Perhaps also a good spot to send "opening..." to the client. */
	// buflen = sprintf(buf,"Trying %s %d...",info.address,info.port);
	// loci_client_write(pc,buf,buflen);

	if (!lws_client_connect_via_info(&info)) {
		lwsl_warn("%s: onward game connection failed\n", __func__); 
		loci_client_invalidate_key(pc);
		/* return -1 means hang up on the ws client, triggering _CLOSE flow */
		return -1;
	}

	loci_client_send_key(pc);

	return(0);
}

/* reconnect to the mud. */
int loci_connect_to_game_uuid(proxy_conn_t *pc,char *uuid) {

	proxy_conn_t *oldpc;

	if(!uuid || !*uuid) {
		return(-1);
	}


	oldpc = find_proxy_conn_by_uuid(uuid);

	/* if !found return(-1) */
	if(!oldpc) {
		locid_log("[%d] client reconnect %s NOT FOUND.",pc->id,uuid);
		return(-1);
	}

	/* patch the found old pc gameside into this client pc */
	locid_log("[%d] client reconnect %s found id %d",pc->id,uuid,oldpc->id);
	pc->wsi_game = oldpc->wsi_game;
	oldpc->wsi_game = NULL;
	lws_set_opaque_user_data(pc->wsi_game,pc);

	/* copy in the queues */
	move_proxy_queue(pc->game_q,oldpc->game_q);
	move_proxy_queue(pc->client_q,oldpc->client_q);

	if(pc->uuid) g_free(pc->uuid);
	pc->uuid = oldpc->uuid;
	oldpc->uuid = NULL;

	/* close out the old proxyconn */
	if(oldpc->wsi_client) {
		lws_wsi_close(oldpc->wsi_client, LWS_TO_KILL_SYNC);
	}

	loci_client_send_key(pc);
	loci_renegotiate_env(pc);

	return(0);
}

int loci_connect_to_game(proxy_conn_t *pc, int gameno, char *uuid) {
	
	int ret;

	if(pc->wsi_game != NULL) {
		lwsl_warn("%s: client requested a second connection?\n", __func__); 
		return(0);
	}

	if( !uuid || (*uuid == '\0')) {
		return(loci_connect_to_game_number(pc,gameno));
	}
	ret = loci_connect_to_game_uuid(pc,uuid);	
	if (ret == -1 ) {
		return(loci_connect_to_game_number(pc,gameno));
	} 
	return(ret);

}


/* main LWS callback for the webclient side of the proxy. */
int callback_loci_client(struct lws *wsi, enum lws_callback_reasons reason,
			 void *user, void *in, size_t len)
{
	proxy_conn_t *pc;
	proxy_msg_t *msg;
	proxy_msg_t *nextmsg;
	proxy_msg_t *newmsg;
	uint8_t *data;
	int m, a;
	char buf[4096];
	int buflen;
	int n;

	/* pc is stored in the wsi user data area.  fetch it.  (pc may come back
	 * NULL on the first time this is called, but that's ok.)*/
	pc = (proxy_conn_t *)lws_get_opaque_user_data(wsi);

	switch (reason) {
	case LWS_CALLBACK_ESTABLISHED:
		/* A web client has called into the proxy for the first time, and
		 * connection was established.  Set up the proxy! */

		/* create a new proxy connection object and add it as the user data for this wsi */
		pc = new_proxy_conn(); 
		lws_set_opaque_user_data(wsi, pc);

		/* Save this wsi in the proxy con structure as the client side, so that
		 * it can be looked up by callbacks made the game side wsi... */
		pc->wsi_client = wsi;

		lws_get_peer_simple(pc->wsi_client,buf,sizeof(buf));
		pc->hostname = strdup(buf);
		locid_log("[%d] Establishing client connection from %s",pc->id, pc->hostname);

		/* grab a string copy of the peer's address */
		if(lws_hdr_copy(pc->wsi_client,buf,sizeof(buf),WSI_TOKEN_X_FORWARDED_FOR) > 0) {
			locid_log("[%d] Using x-forwarded-for as the hostname: '%s'",pc->id, buf);
			if(pc->hostname) free(pc->hostname);
			pc->hostname = strdup(buf);
		}

		if(lws_hdr_copy(pc->wsi_client,buf,sizeof(buf),WSI_TOKEN_HTTP_USER_AGENT) > 0) {
			locid_log("[%d] User Agent: '%s'",pc->id, buf);
			if(pc->useragent) {
				g_free(pc->useragent);
			}
			pc->useragent = strdup(buf);
		}

		loci_telnet_init(pc);

		/* loci_connect_to_game(pc,0); */
		/* Don't open up the connection to the game until the client
		 * specifically requests it. This is so that the client has a chance to
		 * send up any login or environment */
		break;

	case LWS_CALLBACK_CLOSED:
		pc->wsi_client = NULL;
		lws_set_opaque_user_data(wsi, NULL);

		/* if the game side has either not opened, or has closed and cleaned
		 * itself up, we can get rid of the proxy_conn too and be all done. */
		if (!pc->wsi_game) {
			/* The game side of the proxy is already gone... */
			locid_log("[%d] client side full close",pc->id);
			empty_proxy_queue(pc->client_q); 
			free_proxy_conn(pc);
			break;
		}

		/* The game side of the proxy is still alive... */
		locid_log("[%d] client side half close",pc->id);
		break;

	case LWS_CALLBACK_SERVER_WRITEABLE:
		if (!pc || g_queue_is_empty(pc->client_q))
			break;
		
		msg = g_queue_pop_head(pc->client_q);
		data = ((uint8_t *)&msg[1]) + LWS_PRE;

		/* notice we allowed for LWS_PRE in the payload already */
		m = lws_write(wsi, data, msg->len, LWS_WRITE_BINARY);  /* jsj should this be LWS_WRITE_BINARY? */
		a = (int)msg->len;
		free(msg);

		if (m < a) {
			lwsl_err("ERROR %d writing to ws\n", m);
			return -1;
		}

		/* and repeat while the queue contains messages. */
		if (!(g_queue_is_empty(pc->client_q))) {
			lws_callback_on_writable(wsi);
		}
		break;

	case LWS_CALLBACK_RECEIVE:
		if (!pc) break;

		/* de-encapsulate inbound from the client here. The unfiltered data is
		 * at *in.  It needs its loci protocol framing translated, and then
		 * sent on to the outbound game q.*/

		loci_client_parse(pc,in,len);

		break;

	default:
		break;
	}

	return 0;
}

/* parse verbose json data send from the web client.  */
int loci_client_json_cmd_parse(proxy_conn_t *pc,char *str, size_t len) {
	return(0);
}
