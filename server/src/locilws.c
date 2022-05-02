/* locilws.c - LociTerm websocket bindings */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: locilws.c,v 1.2 2022/05/02 03:18:36 malakai Exp $*/

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

/* functions */


/* init a new proxy_conn_t */
proxy_conn_t *new_proxy_conn() {
	proxy_conn_t *n;

	n = (proxy_conn_t *)malloc(sizeof(proxy_conn_t));
	/* lws example code always does this to its embedded struct lws's. Doesn't
	 * hurt to do it to the whole proxy_conn_t.*/
	memset(n, 0, sizeof(*n));  
	
	n->client_q = g_queue_new();
	n->hostname = NULL;
	n->ttype_state = 0;
	n->width = 80;
	n->height = 25;

	n->game_q = g_queue_new();
	n->game_telnet = NULL;
	n->environment = NULL;

	return(n);
}

/* ditch an existing proxy_conn_t */
void free_proxy_conn(proxy_conn_t *f) {

	empty_proxy_queue(f->client_q);
	g_queue_free(f->client_q);
	f->client_q = NULL;
	if(f->hostname) {
		free(f->hostname);
	}

	empty_proxy_queue(f->game_q);
	g_queue_free(f->game_q);
	f->game_q = NULL;

	loci_telnet_free(f);
	loci_environment_free(f);

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

