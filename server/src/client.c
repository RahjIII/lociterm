/* client.c - LociTerm client side protocols */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: client.c,v 1.16 2024/09/13 14:32:58 malakai Exp $*/

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
#include <glib.h>
#include <json-c/json.h>

#include "debug.h"
#include "proxy.h"
#include "connect.h"
#include "gamedb.h"

#include "client.h"

/* structures and types */

/* local function declarations */
int loci_client_parse(proxy_conn_t *pc, char *in, size_t len);
void loci_client_send_cmd(proxy_conn_t *pc, char cmd, char *in, size_t len);
int loci_client_json_cmd_parse(proxy_conn_t *pc,char *in, size_t len);
void loci_client_send_key(proxy_conn_t *pc);
void loci_client_game_list(proxy_conn_t *pc, char *msg);
void loci_client_more_info(proxy_conn_t *pc, char *msg);

/* locals */

/* functions */

client_conn_t *new_client_conn() {
	client_conn_t *n;

	n = (client_conn_t *)malloc(sizeof(client_conn_t));
	/* lws example code always does this memset to clear its embedded struct lws's. Doesn't
	 * hurt to do it to the whole game_conn_t.*/
	memset(n, 0, sizeof(*n));  

	n->wsi_client = NULL;
	n->client_q = g_queue_new();
	n->client_state = PRXY_INIT;
	n->hostname = NULL;
	n->width = 80;
	n->height = 25;
	n->useragent = NULL;
	n->requested_game = NULL;

	n->pc = NULL;

	return(n);

}

void free_client_conn(client_conn_t *f) {

	if(f->wsi_client) {
		lws_set_opaque_user_data(f->wsi_client, NULL);
		lws_wsi_close(f->wsi_client, LWS_TO_KILL_SYNC);
		f->wsi_client = NULL;
	}

	if(f->client_q) {
		empty_proxy_queue(f->client_q);
		g_queue_free(f->client_q);
		f->client_q = NULL;
	}
	if(f->hostname) free(f->hostname);
	f->hostname = NULL;
	
	if(f->useragent) g_free(f->useragent);
	f->useragent = NULL;

	if(f->requested_game) json_object_put(f->requested_game);
	f->requested_game = NULL;

	f->pc = NULL;
	free(f);
	return;

}


/* reads loci client protocol messages and acts on them. */
int loci_client_parse(proxy_conn_t *pc, char *in, size_t len) {

	int width = 80;
	int height = 25;
	char *s;
	int gameno=0;
	char *uuid;
	int ret;

	char *msg = in+1;
	size_t msglen = len-1;

	if (!in || !len) {
		return(-1);
	}

	switch (*in) {
		case INPUT:
			loci_game_send(pc,msg,msglen);
			break;
		case GMCP_INPUT:
			loci_game_send_gmcp(pc,msg,msglen);
			break;
		case RESIZE_TERMINAL:
			width = 80;
			height =25;
			s = (char *)malloc(len);
			memset(s, 0, len);  
			memcpy(s,msg,msglen);
			if( (sscanf(s,"%d %d",&width,&height)==2) ) {
				pc->client->width = width;
				pc->client->height = height;
			}
			free(s);
			loci_game_send_naws(pc);
			lwsl_user("[%d] Terminal resized (%dx%d)",pc->id,pc->client->width,pc->client->height);
			break;

		case CONNECT_VERBOSE: {
			/* the msg is a null terminated json encoded blob of data.  See
			 * loci_connect_verbose() for the expected content of that blob. */
			s = (char *)malloc(len);
			memset(s, 0, len);  
			memcpy(s,msg,msglen);
			ret = loci_connect_verbose(pc,s);
			free(s);
			return(ret);
		} break;
		case DISCONNECT_GAME:
			locid_debug(DEBUG_CLIENT,pc,"client requested game close.");
			loci_game_shutdown(pc);
			break;
		case SEND_CMD:
			loci_client_json_cmd_parse(pc,msg,msglen);
			break;
		case GAME_LIST:
			s = (char *)malloc(len);
			memset(s, 0, len);  
			memcpy(s,msg,msglen);
			loci_client_game_list(pc,s);
			free(s);
			return(0);
		case MORE_INFO:
			s = (char *)malloc(len);
			memset(s, 0, len);  
			memcpy(s,msg,msglen);
			loci_client_more_info(pc,s);
			free(s);
			return(0);
		case PAUSE:
		case RESUME:
		default:
			locid_debug(DEBUG_CLIENT,pc,"unimplemented client command.");
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
	g_queue_push_tail(pc->client->client_q,msg);
	if(pc->client->wsi_client) {
		lws_callback_on_writable(pc->client->wsi_client);
	}
	return;
}

/* send regular terminal data to the client. */
void loci_client_write(proxy_conn_t *pc, char *in, size_t len) {
	loci_client_send_cmd(pc,OUTPUT,in,len);
}

/* send the reconnection key to the client. */
void loci_client_send_key(proxy_conn_t *pc) {

	json_object *r;
	json_object *db;
	char *jstr;

	r = json_object_new_object();
	json_object_object_add(r,"reconnect",
		json_object_new_string(loci_get_game_uuid(pc))
	);

	db = pc->game_db_entry;
	if(db) {
		json_object_object_add(r,"host",json_object_get(json_object_object_get(db,"host")));
		json_object_object_add(r,"port",json_object_get(json_object_object_get(db,"port")));
		json_object_object_add(r,"ssl",json_object_get(json_object_object_get(db,"ssl")));
		json_object_object_add(r,"icon",json_object_get(json_object_object_get(db,"icon")));
	}

	jstr = json_object_to_json_string(r);

	loci_client_send_cmd(pc,CONNECT_VERBOSE,jstr,strlen(jstr));
	locid_debug(DEBUG_CLIENT,pc,"sent reconnect '%s'",jstr);
	json_object_put(r);

}


void loci_client_send_connectmsg(proxy_conn_t *pc, char *state, char *msg) {

	json_object *r;
	json_object *db;
	char *jstr;

	r = json_object_new_object();
	if(state) {
		json_object_object_add(r,"state",json_object_new_string(state));
	}
	if(msg) {
		json_object_object_add(r,"msg",json_object_new_string(msg));
	}
	jstr = json_object_to_json_string(r);

	loci_client_send_cmd(pc,CONNECT_VERBOSE,jstr,strlen(jstr));
	locid_debug(DEBUG_CLIENT,pc,"sent connectmsg '%s'",jstr);
	json_object_put(r);

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

	locid_debug(DEBUG_EVENTNO,pc,"event: %d.",reason);

	/* any event triggers a timeout check. */
	if(pc && (get_game_state(pc) == PRXY_BLOCKING) ) {
		security_enforcement(pc);
	}

	switch (reason) {
	case LWS_CALLBACK_ESTABLISHED:
		/* A web client has called into the proxy for the first time, and
		 * connection was established.  Set up the proxy! */

		/* create a new proxy connection object and add it as the user data for this wsi */
		pc = new_proxy_conn(); 
		set_client_state(pc,PRXY_UP);
		lws_set_opaque_user_data(wsi, pc);

		/* Save this wsi in the proxy con structure as the client side, so that
		 * it can be looked up by callbacks made the game side wsi... */
		pc->client->wsi_client = wsi;

		lws_get_peer_simple(pc->client->wsi_client,buf,sizeof(buf));
		pc->client->hostname = strdup(buf);
		locid_log("Establishing client connection from %s", pc->client->hostname);

		/* grab a string copy of the peer's address */
		if(lws_hdr_copy(pc->client->wsi_client,buf,sizeof(buf),WSI_TOKEN_X_FORWARDED_FOR) > 0) {
			locid_log("Using x-forwarded-for as the hostname: '%s'", buf);
			if(pc->client->hostname) free(pc->client->hostname);
			pc->client->hostname = strdup(buf);
		}

		if(lws_hdr_copy(pc->client->wsi_client,buf,sizeof(buf),WSI_TOKEN_HTTP_USER_AGENT) > 0) {
			locid_log("User Agent: '%s'", buf);
			if(pc->client->useragent) {
				g_free(pc->client->useragent);
			}
			pc->client->useragent = strdup(buf);
		}

		/* lociterm1.x loci_telnet_init(pc); */

		/* loci_connect_to_game(pc,0); */
		/* Don't open up the connection to the game until the client
		 * specifically requests it. This is so that the client has a chance to
		 * send up any login or environment */
		break;

	case LWS_CALLBACK_WS_PEER_INITIATED_CLOSE:
		set_client_state(pc,PRXY_DOWN);
		break;

	case LWS_CALLBACK_CLOSED:
		pc->client->wsi_client = NULL;
		lws_set_opaque_user_data(wsi, NULL);
		set_client_state(pc,PRXY_DOWN);

		/* if the game side has either not opened, or has closed and cleaned
		 * itself up, we can get rid of the proxy_conn too and be all done. */
		if (get_game_state(pc) <= PRXY_DOWN) {
			/* The game side of the proxy is already gone... */
			locid_debug(DEBUG_CLIENT,pc,"client side full close");
			empty_proxy_queue(pc->client->client_q); 
			set_client_state(pc,PRXY_INIT);
			free_proxy_conn(pc);
			break;
		}

		/* The game side of the proxy is still alive... */
		locid_debug(DEBUG_CLIENT,pc,"client side half close");
		break;

	case LWS_CALLBACK_SERVER_WRITEABLE:
		/* this callback happens every three seconds while client is open, no matter what. */

		if(get_game_state(pc) == PRXY_BLOCKING) {
			locid_debug(DEBUG_CLIENT,pc,"Game side is blocking on security check.");
			break;
		}

		if (!pc || g_queue_is_empty(pc->client->client_q))
			break;
		
		msg = g_queue_pop_head(pc->client->client_q);
		data = ((uint8_t *)&msg[1]) + LWS_PRE;

		/* notice we allowed for LWS_PRE in the payload already */
		m = lws_write(wsi, data, msg->len, LWS_WRITE_BINARY);  /* jsj should this be LWS_WRITE_BINARY? */
		a = (int)msg->len;
		free(msg);

		if (m < a) {
			locid_debug(DEBUG_LWS,pc,"ERROR %d writing to ws", m);
			return -1;
		}

		/* and repeat while the queue contains messages. */
		if (!(g_queue_is_empty(pc->client->client_q))) {
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
		if(pc) {
			locid_debug(DEBUG_CLIENT,pc,"unhandled client callback %d.",reason);
		}
		break;
	}

	return 0;
}

/* parse verbose json data send from the web client.  */
int loci_client_json_cmd_parse(proxy_conn_t *pc,char *str, size_t len) {
	return(0);
}



/* msg is just ignored for now. Could be a subcommand later*/
void loci_client_game_list(proxy_conn_t *pc, char *msg) {

	json_object *jobj;
	char *jstr;

	jobj = game_db_get_server_list();
	jstr = json_object_to_json_string(jobj);

	loci_client_send_cmd(pc,GAME_LIST,jstr,strlen(jstr));
	json_object_put(jobj);

	return;
}

/* msg is a jobj string of host/port/ssl. */
void loci_client_more_info(proxy_conn_t *pc, char *msg) {

	json_object *request;

	if(!(request = json_tokener_parse(msg))) {
		locid_debug(DEBUG_CLIENT,pc,"%s Bad more_info request %s", pc->client->hostname,msg);
		return;
	}

	char *host = json_object_get_string(json_object_object_get(request,"host"));
	int port = json_object_get_int(json_object_object_get(request,"port"));
	int ssl = json_object_get_boolean(json_object_object_get(request,"ssl"));

	json_object *jobj = game_db_mssplookup(host,port,ssl);

	char *jstr = json_object_to_json_string(jobj);

	loci_client_send_cmd(pc,MORE_INFO,jstr,strlen(jstr));
	json_object_put(jobj);

	return;
}
