/* connect.c - <comment goes here> */
/* Created: Sun Aug  4 10:09:40 PM EDT 2024 malakai */
/* $Id: connect.c,v 1.6 2024/11/26 05:33:10 malakai Exp $ */

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

#include <glib.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <libwebsockets.h>
#include <json-c/json.h>

#include "libtelnet.h"
#include "locid.h"
#include "proxy.h"
#include "telnet.h"
#include "debug.h"
#include "game.h"
#include "gamedb.h"
#include "client.h"

#include "connect.h"

/* local #defines */

/* structs and typedefs */

/* local variable declarations */

/* local function declarations */

int loci_connect_verbose(proxy_conn_t *pc, char *msg) {

	int ret = -1;
	int done = 0;
	json_object *request;
	int badrequest = 0;

	/* The format of the connect message is roughly: 

		{	"reconnect":"4a7dd557-d8a4-4704-9f05-f349567bdba8",
			"host":"last-outpost.com",
			"port":"4000",
			"ssl":true
		}

	All of the fields are optional!  A default connect message is simply an
	empty json object. */
	if((request = json_tokener_parse(msg))) {
		/* something already pending?  Ditch it. */
		if(pc->client->requested_game) {
			json_object_put(pc->client->requested_game);
		}
		pc->client->requested_game = request;
	} else {
		locid_debug(DEBUG_CLIENT,pc,"%s Bad connection request %s", pc->client->hostname,msg);
		return(-1);
	}

	locid_debug(DEBUG_CLIENT,pc,"%s asked to connect to %s",pc->client->hostname,msg);

	char *uuid = json_object_get_string(json_object_object_get(request,"reconnect"));
	if(uuid != NULL) {	
		if(find_proxy_conn_by_uuid(uuid) == pc) {
			locid_debug(DEBUG_CLIENT,pc,"%s is already connected to that uuid, so ignoring.", pc->client->hostname,msg);
			return(1);
		}
	}

	/* if the proxy is already connected to a game, save the request as a json
	 * object in the proxy_conn, schedule a disconnect event on the game side,
	 * and yield control back to libwesocket.  It'll close down the game side.
	 * There'll be some other logic elsewhere to realize that the saved request
	 * needs to be handled.  */
	if(pc->game->wsi_game != NULL) {
		locid_debug(DEBUG_CLIENT,pc,"must close existing wsi_game connection"); 
		set_game_state(pc,PRXY_RECONNECTING);
		/* trigger a close event.  */
		lws_wsi_close(pc->game->wsi_game, LWS_TO_KILL_ASYNC);
		/* be done. */
		return(1);
	}

	return(loci_connect_requested_game(pc));
}


int loci_connect_requested_game(proxy_conn_t *pc) {

	int ret=0;
	int done=0;
	int dbstatus;

	if(!pc->client->requested_game) {
		locid_debug(DEBUG_CLIENT,pc,"Called with no request."); 
		pc->client->requested_game = json_object_new_object();
	}

	json_object *request = pc->client->requested_game;

	/* json_object_get_string is a reference, not an allocation. No need to
	 * free these string pointers. */
	char *uuid = json_object_get_string(json_object_object_get(request,"reconnect"));
	char *hostname = json_object_get_string(json_object_object_get(request,"host"));

	/* check for and honor a reconnect key first. */
	if(uuid) {
		if (loci_connect_to_game_uuid(pc,uuid) != -1) {
			loci_client_send_connectmsg(pc,"reconnect","");
			/* success! */
			return(0);
		}
	}

	/* maybe there was a specific hostname requested. */
	if(hostname) {
		if(!hostname_looks_valid(hostname)) {
			locid_debug(DEBUG_DB,NULL,"The hostname '%s' doesn't look valid.",hostname);
			loci_client_send_connectmsg(pc,"banned",NULL);
			return(-1);
		} else {
			int port = json_object_get_int(json_object_object_get(request,"port"));
			int ssl = json_object_get_boolean(json_object_object_get(request,"ssl"));
			dbstatus = game_db_suggest(pc,hostname,port,ssl);

			switch (dbstatus) {
				case DBSTATUS_APPROVED:
				case DBSTATUS_REDACTED: 
					/* redacted is approved- it doesn't show up in the main list. */
					/* approved means it doesn't have to pass any protocol checks. */
					loci_client_send_connectmsg(pc,"approved","");
					security_require(pc,0,0);
					ret = loci_connect_to_game_host(pc,hostname,port,ssl);
					return(ret);
				case DBSTATUS_NOT_CHECKED:
					/* not_checked means its still ok to try and connect, to
					 * see if protocol checks pass.*/
					loci_client_send_connectmsg(pc,"checking","Thanks for the suggestion!");
					/* DO enforce security checks. */
					security_require(pc,config->db_min_protocol,3);
					ret = loci_connect_to_game_host(pc,hostname,port,ssl);
					return(ret);
				case DBSTATUS_BANNED:
				case DBSTATUS_BAD_PROTOCOL:
				case DBSTATUS_NO_ANSWER:
				default:
					/* These other responses mean we aren't going to try to
					 * connect again. Admin can review and delete/redact/accept
					 * whatever manually.*/
					loci_client_send_connectmsg(pc,"banned","Couldn't connect.");
					/* return will leave user hanging, break will load the default game. */
					/* return(-1); */
					break;
			}
		}
	}

	/* No uuid, no hostname, try to connect to the default game. */
	locid_info(pc,"Connecting to default game.");
	security_require(pc,0,0);
	ret = loci_connect_to_game_host(pc,
		config->game_host,
		config->game_port,
		(config->game_usessl)?1:0
	);
	loci_client_send_connectmsg(pc,"default","Connecting to server default.");

	return(ret);

}

int loci_connect_to_game_host(proxy_conn_t *pc, char *hostname, int port, int ssl) {

	struct lws_client_connect_info info;

	if(pc && pc->game && pc->game->wsi_game) {
		locid_debug(DEBUG_GAME,pc,"%s: closing existing wsi_game connection."); 
		lws_wsi_close(pc->game->wsi_game, LWS_TO_KILL_ASYNC);
	}

	if(!hostname) return(-1);
	if(!hostname_looks_valid(hostname)) {
		locid_debug(DEBUG_DB,NULL,"The hostname '%s' doesn't look valid.",hostname);
		return(-1);
	}
	if((port<1)||(port>65535)) return(-1);

	if(pc->game_db_entry) {
		json_object_put(pc->game_db_entry);
	}
	pc->game_db_entry = game_db_gamelookup(hostname,port,ssl);

	/* lws example code likes to clear out structures before use */
	memset(&info, 0, sizeof(info));

	info.method = "RAW";
	info.context = lws_get_context(pc->client->wsi_client);
	info.port = port;
	info.address = hostname;
	info.host = hostname;
	if(ssl) {
		info.ssl_connection = 
			LCCSCF_USE_SSL |
			LCCSCF_ALLOW_SELFSIGNED |
			LCCSCF_SKIP_SERVER_CERT_HOSTNAME_CHECK |
			LCCSCF_ALLOW_EXPIRED |
			LCCSCF_ALLOW_INSECURE;

	} else {
		info.ssl_connection = 0;
	}

	info.protocol = "";
	info.local_protocol_name = "loci-game";
	/* also mark this onward conn with the proxy_conn.  This is take from
	 * the lws example code.  probably should be lws_set_opaque_user_data()
	 * instead for clarity and consistency, but whatever. */
	info.opaque_user_data = pc;
	/* if the connect_via_info call succeeds, it'll set the wsi into the
	 * location pointed to by info.pwsi, in this case, the wsi_game field
	 * of the proxy_conn. */
	info.pwsi = &pc->game->wsi_game;

	/* Perhaps also a good spot to send "opening..." to the client. */
	/*
	char buf[1024];
	int buflen = sprintf(buf,"Trying %s %d...\n",info.address,info.port);
	loci_client_write(pc,buf,buflen);
	*/

	if (!lws_client_connect_via_info(&info)) {
		locid_debug(DEBUG_CLIENT,pc,"client connect via info failed.");
		locid_info(pc,"game connect via info failed.");
		if(game_db_get_status(pc) == DBSTATUS_NOT_CHECKED) {
			game_db_update_status(pc,DBSTATUS_NO_ANSWER);
		}
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
	proxy_conn_t *tmppc;
	game_conn_t *tmpgc;

	if(!uuid || !*uuid) {
		return(-1);
	}

	oldpc = find_proxy_conn_by_uuid(uuid);

	/* if !found return(-1) */
	if(!oldpc) {
		locid_debug(DEBUG_CLIENT,pc,"client reconnect '%8.8s-...' NOT FOUND.",uuid);
		return(-1);
	}

	/* patch the found old pc gameside into this client pc */
	locid_debug(DEBUG_CLIENT,pc,"client reconnect %s found id %d",uuid,oldpc->id);
	locid_info(pc,"client reconnect takes game from [%d]",oldpc->id);

	tmpgc = pc->game;
	pc->game = oldpc->game;
	oldpc->game = tmpgc;

	pc->game->pc = pc;
	if(oldpc->game) {
		oldpc->game->pc = oldpc;
	}

	/* update the pc pointer in the game wsi. */
	lws_set_opaque_user_data(pc->game->wsi_game,pc);

	if(oldpc->game_db_entry) {
		json_object *tmp = pc->game_db_entry;
		pc->game_db_entry = oldpc->game_db_entry;
		oldpc->game_db_entry = tmp;
	}

	/* copy anything still buffered in the old client queue into the current
	 * client queue. */
	while (!g_queue_is_empty(oldpc->client->client_q)) {
		g_queue_push_tail(
			pc->client->client_q,
			g_queue_pop_head(oldpc->client->client_q)
		);
	}

	/* and now, get rid of it. */
	loci_proxy_shutdown(oldpc);

	loci_client_send_key(pc);
	loci_renegotiate_env(pc);
	loci_environment_update(pc, TELNET_ENVIRON_VALUE, "CLIENT_STATE",
		get_proxy_state_str(get_client_state(pc))
	);
	loci_client_send_echosga(pc);
	loci_telnet_send_naws(pc->game->game_telnet,pc->client->width,pc->client->height);
	
	return(0);
}
