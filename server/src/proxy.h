/* proxy.h - LociTerm protocol bridge  */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: proxy.h,v 1.5 2024/11/26 15:41:08 malakai Exp $ */

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
#ifndef LO_PROXY_H
#define LO_PROXY_H

#include <glib.h>
#include <json-c/json.h>
#include "libtelnet.h"

/* global #defines */

#define IDLE_TIMER_USEC 10*1000000

/* structs and typedefs */

typedef enum {
	PRXY_NULL,
	PRXY_INIT,
	PRXY_DOWN,
	PRXY_CONNECTING,
	PRXY_UP,
	PRXY_BLOCKING,
	PRXY_RECONNECTING,
	PRXY_CLOSING,
	PRXY_STATE_MAX
} proxy_state_t;

#define CHECK_TELNET (1<<0)
#define CHECK_MUD (1<<1)
#define CHECK_MSSP (1<<2)

/* declared here, but defined further down. */
typedef struct client_conn client_conn_t;
typedef struct game_conn game_conn_t;

/* Main structure for a proxy connection. */
typedef struct proxy_conn {

	int id;
	client_conn_t *client;
	game_conn_t *game;

	struct timeval watchdog;

	json_object *game_db_entry;     /* contains hostname, port, ssl, ... */
	json_object *mssp;				/* TEMPORARY MSSP data recieved from game. */

	GList *environment;				/* proxied environment variables */


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

void empty_proxy_queue(GQueue *q);
void move_proxy_queue(GQueue *dst, GQueue *src);

proxy_conn_t *find_proxy_conn_by_uuid(char *uuid);

proxy_state_t get_game_state(proxy_conn_t *pc);
proxy_state_t get_client_state(proxy_conn_t *pc);
void set_game_state(proxy_conn_t *pc, proxy_state_t state);
void set_client_state(proxy_conn_t *pc, proxy_state_t state);
char *get_proxy_state_str(proxy_state_t state);
int security_checked(proxy_conn_t *pc,int security_flags);
void security_require(proxy_conn_t *pc,int security_flags,int pulses);
void security_enforcement(proxy_conn_t *pc);

const char *loci_get_client_hostname(proxy_conn_t *pc);
const char *loci_get_game_uuid(proxy_conn_t *pc);

void loci_client_shutdown(proxy_conn_t *pc);
void loci_client_send_echosga(proxy_conn_t *pc);
void loci_client_send_gaeor(proxy_conn_t *pc, const char *msg);
void loci_client_invalidate_key(proxy_conn_t *pc);
void loci_game_send(proxy_conn_t *pc, const char *buffer, size_t size);
void loci_game_send_gmcp(proxy_conn_t *pc, const char *buffer, size_t size);
void loci_game_send_naws(proxy_conn_t *pc);
void loci_game_shutdown(proxy_conn_t *pc);
int loci_proxy_watchdog(proxy_conn_t *pc);
void loci_proxy_shutdown(proxy_conn_t *pc);
void free_proxyconns(void);
#endif /* LO_PROXY_H */
