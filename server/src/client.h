/* client.h - <comment goes here> */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* Copyright © 1991-2022 The Last Outpost Project */
/* $Id: client.h,v 1.1 2022/05/02 02:35:25 malakai Exp $ */

#ifndef LO_CLIENT_H
#define LO_CLIENT_H

/* global #defines */

// to web client message
#define OUTPUT '0'
#define SET_WINDOW_TITLE '1'
#define SET_PREFERENCES '2'

// from web client message
#define INPUT '0'
#define RESIZE_TERMINAL '1'
#define PAUSE '2'
#define RESUME '3'
#define JSON_DATA '{'

/* structs and typedefs */


/* exported global variable declarations */

/* exported function declarations */

void loci_client_write(proxy_conn_t *pc, char *in, size_t len);

int callback_loci_client(
	struct lws *wsi, enum lws_callback_reasons reason,
	void *user, void *in, size_t len
);

#endif /* LO_CLIENT_H */
