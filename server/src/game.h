/* game.h - <comment goes here> */
/* Created: Thu Apr 28 09:52:16 AM EDT 2022 malakai */
/* $Id: game.h,v 1.2 2022/05/02 03:18:36 malakai Exp $ */

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
