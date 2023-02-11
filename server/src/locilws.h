/* locilws.h - LociTerm libwebsocket handlers */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: locilws.h,v 1.4 2023/02/11 03:22:23 malakai Exp $ */

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


#ifndef LO_LOCILWS_H
#define LO_LOCILWS_H

/* global #defines */

/* structs and typedefs */

/* one of these created for each pending message that is to be forwarded */
typedef struct proxy_conn {

	int id;
	/* client side elements */
	struct lws *wsi_client;
	GQueue *client_q;
	char *hostname;
	int ttype_state;
	int width;
	int height;
	GList *environment;
	gchar *useragent;
	
	/* game side elements */
	struct lws *wsi_game; 
	GQueue *game_q;
	telnet_t *game_telnet;
	gchar *uuid;

} proxy_conn_t;

typedef struct proxy_msg {
	size_t			len;
	/* LWS-
	 * the packet content is overallocated here, if p is a pointer to
	 * this struct, you can get a pointer to the message contents by
	 * ((uint8_t)&p[1]) + LWS_PRE.
	 *
	 * Notice we additionally take care to overallocate LWS_PRE before the
	 * actual message data, so we can simplify sending it.
	 */
	 /* JSJ- the lower level lws write code wants to send a 16 byte header
	  * before sending your data.  Presumably to save a pointer and avoid doing
	  * either two writes, or a buffer copy and a single write, they suggest
	  * you preallocate the LWS_PRE header space in front of the data as they
	  * do throughout the example code.  This makes for some less than easy to
	  * read data structures, and a lot of comments about "note that we have
	  * pre-allocated LWS_PRE" everywhere.  I'm not sure I agree with this
	  * optimization... but I'm rolling with it 'cause its the LWS way. */
} proxy_msg_t;


/* exported global variable declarations */

/* exported function declarations */

proxy_conn_t *new_proxy_conn(void);
void free_proxy_conn(proxy_conn_t *f);				/* full close */
void free_proxy_conn_game_side(proxy_conn_t *f);    /* half close */
void free_proxy_conn_client_side(proxy_conn_t *f);  /* half close */

void empty_proxy_queue(GQueue *q);
void move_proxy_queue(GQueue *dst, GQueue *src);

proxy_conn_t *find_proxy_conn_by_uuid(char *uuid);

#endif /* LO_LOCILWS_H */
