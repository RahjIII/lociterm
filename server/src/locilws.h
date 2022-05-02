/* locilws.h - <comment goes here> */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* Copyright © 1991-2022 The Last Outpost Project */
/* $Id: locilws.h,v 1.1 2022/05/02 02:35:25 malakai Exp $ */

#ifndef LO_LOCILWS_H
#define LO_LOCILWS_H

/* global #defines */

/* structs and typedefs */

/* one of these created for each pending message that is to be forwarded */
typedef struct proxy_conn {
	
	/* client side elements */
	struct lws *wsi_client;
	GQueue *client_q;
	char *hostname;
	int ttype_state;
	int width;
	int height;
	
	/* game side elements */
	struct lws *wsi_game; 
	GQueue *game_q;
	telnet_t *game_telnet;
	GList *environment;

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
void free_proxy_conn(proxy_conn_t *f);
void empty_proxy_queue(GQueue *q);

#endif /* LO_LOCILWS_H */
