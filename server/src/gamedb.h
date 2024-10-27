/* gamedb.h - <comment goes here> */
/* Created: Sun Aug 18 10:43:34 AM EDT 2024 malakai */
/* $Id: gamedb.h,v 1.3 2024/10/27 04:28:55 malakai Exp $ */

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

#ifndef LOCI_GAMEDB_H
#define LOCI_GAMEDB_H

#include <json-c/json.h>
#include "libtelnet.h"

/* global #defines */

/* structs and typedefs */
typedef enum {
	DBSTATUS_NULL,			/* unknown */
	DBSTATUS_APPROVED,		/* Sure, that looks good. */
	DBSTATUS_NOT_CHECKED,	/* Suggested, but not yet tested. */
	DBSTATUS_NO_ANSWER,		/* Connection attempted, but no answer.  */
	DBSTATUS_BAD_PROTOCOL,	/* Connected to, but didn't pass telnet tests. */
	DBSTATUS_BANNED,		/* Nope, for whatever reason. */
	DBSTATUS_REDACTED,		/* Approved, but hidden from the public list */
	DBSTATUS_MAX			/* marker */
} game_db_status_t;

/* exported global variable declarations */
extern int database_version;

/* exported function declarations */

int game_db_init(char *filename);
int game_db_get_version(void);
int hostname_looks_valid(char *host);
int game_db_suggest(proxy_conn_t *pc, char *host, int port, int ssl);
json_object *game_db_gamelookup(char *host, int port, int ssl);
int game_db_update_status(proxy_conn_t *pc,int dbstatus);
int game_db_update_lastconnection(proxy_conn_t *pc);
int game_db_update_mssp(proxy_conn_t *pc);
int game_db_get_status(proxy_conn_t *pc);
int game_db_get_default_game(proxy_conn_t *pc);
json_object *game_db_get_server_list(void);
json_object *game_db_mssplookup(char *host, int port, int ssl);
void game_db_list(int approved);
void game_db_update(int id,game_db_status_t status);

#endif /* LOCI_GAMEDB_H */
