/* locilws.c - LociTerm websocket bindings */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: locilws.c,v 1.4 2023/02/11 03:22:23 malakai Exp $*/

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
#include "telnet.h"


/* structures and types */

/* local function declarations */
void empty_proxy_queue(GQueue *q);

/* locals */

/* this is a global list of all the proxied connections. */
GList *proxyconns = NULL;

/* functions */


/* init a new proxy_conn_t */
proxy_conn_t *new_proxy_conn() {
	proxy_conn_t *n;
	static int id = 0;

	n = (proxy_conn_t *)malloc(sizeof(proxy_conn_t));
	/* lws example code always does this to its embedded struct lws's. Doesn't
	 * hurt to do it to the whole proxy_conn_t.*/
	memset(n, 0, sizeof(*n));  
	
	n->id = id++;

	n->client_q = g_queue_new();
	n->hostname = NULL;
	n->ttype_state = 0;
	n->width = 80;
	n->height = 25;
	n->useragent = NULL;

	n->game_q = g_queue_new();
	n->game_telnet = NULL;
	n->environment = NULL;
	n->uuid = g_uuid_string_random();

	proxyconns=g_list_append(proxyconns,n);
	
	return(n);
}

/* only frees the game-side parameters of a proxy_conn */
void free_proxy_conn_game_side(proxy_conn_t *f) {

	if(f->game_q) {
		empty_proxy_queue(f->game_q);
		g_queue_free(f->game_q);
		f->game_q = NULL;
	}
	if(f->uuid) g_free(f->uuid);
	f->uuid = NULL;

	loci_telnet_free(f);
	return;

}

void free_proxy_conn_client_side(proxy_conn_t *f) {

	if(f->client_q) {
		empty_proxy_queue(f->client_q);
		g_queue_free(f->client_q);
		f->client_q = NULL;
	}
	if(f->hostname) {
		free(f->hostname);
	}
	f->hostname = NULL;
	loci_environment_free(f);

	if(f->useragent) g_free(f->useragent);
	f->useragent = NULL;

	return;

}

/* ditch an existing proxy_conn_t */
void free_proxy_conn(proxy_conn_t *f) {


	free_proxy_conn_client_side(f); 
	free_proxy_conn_game_side(f); 

	proxyconns=g_list_remove(proxyconns,f);
	f->id = -1;

	free(f);
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
	if(!(a->uuid)) {
		return(-1);
	}
	if(!*uuid) {
		return(1);
	}
	return(strcmp(a->uuid,uuid));
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




