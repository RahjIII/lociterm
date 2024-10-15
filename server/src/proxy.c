/* proxy.c - LociTerm protocol bridge */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: proxy.c,v 1.5 2024/10/15 02:30:44 malakai Exp $*/

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

#include "proxy.h"

#include "client.h"
#include "game.h"
#include "libtelnet.h"
#include "telnet.h"
#include "gamedb.h"
#include "debug.h"

/* structures and types */

/* local function declarations */
void empty_proxy_queue(GQueue *q);

/* locals */
char *proxy_state_str[] = {
	[PRXY_NULL] = "NULL",
	[PRXY_INIT] = "INIT",
	[PRXY_DOWN] = "DOWN",
	[PRXY_CONNECTING] = "CONNECTING",
	[PRXY_UP] = "UP",
	[PRXY_BLOCKING] = "BLOCKING",
	[PRXY_RECONNECTING] = "RECONNECTING",
	[PRXY_CLOSING] = "CLOSING",
	[PRXY_STATE_MAX] = "UNKNOWN"
};

/* idle_proxy_timeout is how long a proxy connection will hang around waiting
 * for a reconnect if one of its sides is not up.  This could be made tunable
 * in the config file sometime, I suppose. */
struct timeval idle_proxy_timeout = {
	.tv_sec = 3600,
	.tv_usec = 0
};

/* this is a global list of all the proxied connections. */
GList *proxyconns = NULL;

/* functions */


/* init a new proxy_conn_t */
proxy_conn_t *new_proxy_conn() {
	proxy_conn_t *n;
	static int id = 0;

	n = (proxy_conn_t *)malloc(sizeof(proxy_conn_t));

	n->id = id++;

	n->client = new_client_conn();
	n->client->pc = n;

	n->game = new_game_conn();
	n->game->pc = n;

	gettimeofday(&(n->watchdog),NULL);

	n->mssp = NULL;
	n->game_db_entry = NULL;

	n->environment = NULL;

	proxyconns=g_list_append(proxyconns,n);

	return(n);
}

void free_proxy_conn(proxy_conn_t *f) {

	if(f->client) free_client_conn(f->client);
	f->client = NULL;

	if(f->game) free_game_conn(f->game);
	f->game = NULL;

	if(f->mssp) json_object_put(f->mssp);
	f->mssp = NULL;

	if(f->game_db_entry) json_object_put(f->game_db_entry);
	f->game_db_entry = NULL;

	loci_environment_free(f);

	proxyconns=g_list_remove(proxyconns,f);

	locid_debug(DEBUG_PROXY,f,"proxy %d is free.",f->id);

	f->id = -1;
	free(f);

}

void free_proxyconns(void) {
	proxy_conn_t *pc;
	while(proxyconns) {
		pc = proxyconns->data;
		locid_info(pc,"Proxy session freed.");
		proxyconns = g_list_remove(proxyconns,pc);
		free_proxy_conn(pc);
	}
}

/* chuck any messages waiting the q. */
void empty_proxy_queue(GQueue *q) {

	gpointer data;
	
	while(!g_queue_is_empty(q)) {
		if ((data = g_queue_pop_head(q))) {
			free(data);
		}
	}

}

void move_proxy_queue(GQueue *dst, GQueue *src) {

	gpointer data;
	
	while(!g_queue_is_empty(src)) {
		if ((data = g_queue_pop_head(src))) {
			g_queue_push_tail(dst,data);
		}
	}

}

/* simple gcompare style function for searching the proxyconn list */
gint uuidcomp (proxy_conn_t *a, char *uuid) {
	if (!(a && a->game)) return(-1);
	if(!(a->game->uuid)) {
		return(-1);
	}
	if(!*uuid) {
		return(1);
	}
	return(strcmp(a->game->uuid,uuid));
}

/* return a pointer to the requested pc, or NULL if it doesn't exist */
proxy_conn_t *find_proxy_conn_by_uuid(char *uuid) {

	GList* pcl; /* proxyconn list item */

	if(!uuid || !*uuid) {
		return(NULL);
	}

	pcl = g_list_find_custom ( proxyconns, uuid, (GCompareFunc)uuidcomp );
	if(!pcl) {
		return(NULL);
	} 
	return(pcl->data);

}

char *get_proxy_state_str(proxy_state_t state) {
	if(	(state < PRXY_INIT) ||
		(state > PRXY_STATE_MAX)
	) {
		state = PRXY_STATE_MAX;
	} 

	return(proxy_state_str[state]);
}

proxy_state_t get_game_state(proxy_conn_t *pc) {
	if(!(pc && pc->game)) return(PRXY_NULL);
	return(pc->game->game_state);
}

proxy_state_t get_client_state(proxy_conn_t *pc) {
	if(!(pc && pc->client)) return(PRXY_NULL);
	return(pc->client->client_state);
}

void set_game_state(proxy_conn_t *pc, proxy_state_t state) {
	proxy_state_t *was = &(pc->game->game_state);

	locid_debug(DEBUG_GAME,pc,"%s -> %s",
		get_proxy_state_str(*was),
		get_proxy_state_str(state)
	);
	*was = state;
}

void set_client_state(proxy_conn_t *pc, proxy_state_t state) {

	proxy_state_t *was = &(pc->client->client_state);

	locid_debug(DEBUG_CLIENT,pc,"%s -> %s",
		get_proxy_state_str(*was),
		get_proxy_state_str(state)
	);
	*was = state;
}

int security_checked(proxy_conn_t *pc,int security_flags) {
	int old_check = pc->game->check_protocol;
	pc->game->check_protocol &= ~(security_flags);

	if(pc->game->check_protocol != old_check) {
		locid_debug(DEBUG_GAME,pc,"Passed check %d, %d -> %d",
			security_flags,
			old_check,
			pc->game->check_protocol
		);
	}
	return(pc->game->check_protocol);
}

void security_require(proxy_conn_t *pc,int security_flags,int timeout) {

	int now = time(0);

	if(security_flags == 0) {
		pc->game->check_protocol = 0;
		pc->game->check_wait = 0;
		return;
	}

	pc->game->check_protocol = security_flags;
	pc->game->check_wait = now + timeout;
	if(pc->game->wsi_game) {
		lws_set_timeout(pc->game->wsi_game,PENDING_TIMEOUT_USER_OK,timeout);
	}
	locid_debug(DEBUG_GAME,pc,"Check Required = %d, wait = %d (%d sec)",
		pc->game->check_protocol,
		pc->game->check_wait
	);
}

void security_enforcement(proxy_conn_t *pc) {
	if(!pc) return;
	if(get_game_state(pc) == PRXY_BLOCKING) {
		int now = time(0);
		if( (pc->game->check_wait >0) &&
			(pc->game->check_wait <= now) &&
			(pc->game->check_protocol != 0)
		) {
			locid_debug(DEBUG_CLIENT,pc,"FAILED SECURITY ALARM - closing game side");
			locid_info(pc,"game failed protocol requirements.");
			game_db_update_status(pc,DBSTATUS_BAD_PROTOCOL);
			empty_proxy_queue(pc->client->client_q);
			/* close the game side. */
			set_game_state(pc,PRXY_CLOSING);
			if(pc->game->wsi_game) {
				lws_wsi_close(pc->game->wsi_game, LWS_TO_KILL_ASYNC);
			}
			pc->game->check_wait = 0;
		}
	}
}

const char *loci_get_client_hostname(proxy_conn_t *pc) {
	if(pc && pc->client) {
		return(pc->client->hostname );
	} else {
		return(NULL);
	}
}

const char *loci_get_game_uuid(proxy_conn_t *pc) {
	if(pc && pc->game) {
		return(pc->game->uuid);
	} else {
		return(NULL);
	}
}

/* Schedule the client side close process. */
void loci_client_shutdown(proxy_conn_t *pc) {

	if(!(pc && pc->client && pc->client->wsi_client)) return;

	set_client_state(pc,PRXY_CLOSING);
	loci_client_invalidate_key(pc);
	/* The LWS example code would close with
	 * lws_wsi_close(pc->client->wsi_client, LWS_TO_KILL_ASYNC) if the
	 * client queue was empty, but that seems too abrupt, in that the
	 * client side frequently didn't get the final "logout" message
	 * text before closing.  Taking the lws_set_timeout route allows
	 * some time for those last messages to be delivered. The number
	 * after the define is seconds.-jsj */

	lws_set_timeout(pc->client->wsi_client,
		PENDING_TIMEOUT_KILLED_BY_PROXY_CLIENT_CLOSE, 1
	); 
	return;

}

/* Schedule the game side close process. */
void loci_game_shutdown(proxy_conn_t *pc) {

	if(!(pc && pc->game && pc->game->wsi_game)) return;

	set_game_state(pc,PRXY_CLOSING);
	if(get_client_state(pc) == PRXY_UP) {
		loci_client_invalidate_key(pc);
	}

	lws_set_timeout(pc->game->wsi_game,
		PENDING_TIMEOUT_KILLED_BY_PROXY_CLIENT_CLOSE, 1
	); 
	return;

}

/* Trigger shutdown on any open proxy sides.  If none open, free the proxy. */
void loci_proxy_shutdown(proxy_conn_t *pc) {

	if(!pc) return;

	if(pc->game && pc->game->wsi_game) {
		loci_game_shutdown(pc);
		return;
	}

	if(pc->client && pc->client->wsi_client) {
		loci_client_shutdown(pc);
		return;
	}

	locid_info(pc,"Proxy session ends. [%d]",pc->id);
	free_proxy_conn(pc);

	return;

}

void loci_client_send_echosga(proxy_conn_t *pc) {

	json_object *jobj;
	char *jstr;

	if(pc->game->data_sent == 0) return;

	int mode = ( ((pc->game->echo_opt & 0x1)<<1) | (pc->game->sga_opt & 0x1));

	jobj = json_object_new_int(mode);

	jstr = json_object_to_json_string(jobj);

	loci_client_send_cmd(pc,ECHO_MODE,jstr,strlen(jstr));
	locid_debug(DEBUG_CLIENT,pc,"send ECHO_MODE '%s'",jstr);
	json_object_put(jobj);

}

void loci_client_invalidate_key(proxy_conn_t *pc) {
	json_object *r;
	char *jstr;

	r = json_object_new_object();
	json_object_object_add(r,"reconnect",json_object_new_string("invalidate"));

	jstr = json_object_to_json_string(r);

	loci_client_send_cmd(pc,CONNECT,jstr,strlen(jstr));
	locid_debug(DEBUG_CLIENT,pc,"sent invalidate '%s'",jstr);
	json_object_put(r);
}

void loci_game_send(proxy_conn_t *pc, const char *buffer, size_t size) {
	if( !(pc && pc->game && pc->game->game_telnet)) return;
	telnet_send_text(pc->game->game_telnet,buffer,size);
}

void loci_game_send_gmcp(proxy_conn_t *pc, const char *buffer, size_t size) {
	if( !(pc && pc->game && pc->game->game_telnet)) return;
	loci_telnet_send_gmcp(pc->game->game_telnet,buffer,size);
}

void loci_game_send_naws(proxy_conn_t *pc) {
	if( !(pc && pc->game && pc->game->game_telnet)) return;
	if( !(pc && pc->client)) return;
	loci_telnet_send_naws(pc->game->game_telnet,pc->client->width,pc->client->height);
}

/* returns 1 if the watchdog has expired and is barking, 0 otherwise. */
int loci_proxy_watchdog(proxy_conn_t *pc) {
	
	struct timeval now;
	struct timeval deltat;

	if(!pc) return(1);
	
	/* if both sides of the proxy are present, pat the doggie and we're good. */
	if( (get_game_state(pc) == PRXY_UP) && 
		(get_client_state(pc) == PRXY_UP) 
	) {
		gettimeofday(&(pc->watchdog),NULL);
		return(0);
	}

	gettimeofday(&now,NULL);
	timersub(&now,&(pc->watchdog),&deltat);

	if(timercmp(&(deltat),&(idle_proxy_timeout),>)) {
		/* watchdog has expired! */
		return(1);
	}

	return(0);

}
