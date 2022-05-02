/* game.h - <comment goes here> */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* Copyright © 1991-2022 The Last Outpost Project */
/* $Id: game.h,v 1.1 2022/05/02 02:35:25 malakai Exp $ */

#ifndef LO_GAME_H
#define LO_GAME_H

/* global #defines */

/* structs and typedefs */


/* exported global variable declarations */

void loci_game_write(proxy_conn_t *pc, char *in, size_t len);

int callback_loci_game(
	struct lws *wsi, enum lws_callback_reasons reason,
	void *user, void *in, size_t len
);

#endif /* LO_GAME_H */
