/* gamedb.c - <comment goes here> */
/* Created: Sun Aug 18 10:43:34 AM EDT 2024 malakai */
/* Copyright © 2024 Jeffrika Heavy Industries */
/* $Id: gamedb.c,v 1.1 2024/09/19 17:03:30 malakai Exp $ */

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

#include <glib.h>
#include <stdio.h>
#include <ctype.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <json-c/json.h>
#include <sqlite3.h>

#include "locid.h"
#include "debug.h"
#include "libtelnet.h"

#include "gamedb.h"

/* local #defines */

/* structs and typedefs */

/* local variable declarations */

char *dbstatus_str[] = {
	[DBSTATUS_NULL] = 			"Unknown",
	[DBSTATUS_APPROVED] = 		"Approved",
	[DBSTATUS_NOT_CHECKED] =	"Not Checked",
	[DBSTATUS_NO_ANSWER] = 		"No Answer",
	[DBSTATUS_BAD_PROTOCOL] =	"Bad Protocol",
	[DBSTATUS_BANNED] = 		"Banned",
	[DBSTATUS_MAX] = 			"Max"
};

char database_definition[] = \
	"CREATE TABLE IF NOT EXISTS DBVERSION ( "
		"VERSION TEXT,"
		"CREATED DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP "
	");"
	"CREATE TABLE IF NOT EXISTS GAMEDBSTATUS ("
		"ID INTEGER NOT NULL PRIMARY KEY, "
		"STATUS TEXT "
	");"
	"CREATE TABLE IF NOT EXISTS GAMEDB ( "
		"ID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "
		"NAME TEXT, "
		"HOST TEXT NOT NULL, "
		"PORT INTEGER NOT NULL, "
		"SSL INTEGER NOT NULL, "
		"DEFAULT_GAME INTEGER NOT NULL DEFAULT 0, "
		"STATUS INTEGER, "
		"CREATED DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
		"LAST_CONNECTION DATETIME, "
		"LAST_MSSP DATETIME, "
		"LAST_UPDATE DATETIME, "
		"WEBSITE TEXT, "
		"ICON TEXT, "
		"MSSP JSONB, "
		"SUGGESTED_BY TEXT, "
		"UNIQUE (HOST, PORT, SSL), "
		"FOREIGN KEY(STATUS) REFERENCES GAMEDBSTATUS(ID) "
	");";

/* local function declarations */
int game_db_port_is_banned(int port);
int game_db_exec(proxy_conn_t *pc,char *sqlstr);

/* Creates a new DB if configured one can't be opened. */
int game_db_init(char *filename) {

	sqlite3 *db;
	sqlite3_stmt *stmt;
	char *sqlstr;
	char *errmsg;

	FILE *cin;
	if( (cin=fopen(filename,"r+")) ) {
		fclose(cin);
		locid_debug(DEBUG_DB,NULL,"db already exists.",filename);
		return(1);
	}

	locid_debug(DEBUG_DB,NULL,"db %s doesn't exist.",filename);

	/* create the db. */
	if ( (sqlite3_open(config->db_location, &db) != SQLITE_OK) ) {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(-1);
	}

	if ( (sqlite3_exec(db, database_definition, NULL, NULL, &errmsg)) != SQLITE_OK ) {
		locid_debug(DEBUG_DB,NULL,"Ooops. %s",errmsg);
		if(errmsg) sqlite3_free(errmsg);
		sqlite3_close(db);
		return(-1);
	}

	/* add the dbstatus definitions. */
	for(int i=1;i<DBSTATUS_MAX;i++) {
		sqlstr = sqlite3_mprintf(
			"INSERT INTO GAMEDBSTATUS (ID,STATUS) VALUES (%d, %Q);",
			i, dbstatus_str[i]
		);
		if ( (sqlite3_exec(db, sqlstr, NULL, NULL, &errmsg)) != SQLITE_OK ) {
			locid_debug(DEBUG_DB,NULL,"Ooops. '%s' %s",sqlstr,errmsg);
			if(errmsg) sqlite3_free(errmsg);
		}
		sqlite3_free(sqlstr);
	}

	/* insert the default game from the config file. */
	sqlstr = sqlite3_mprintf(
		"INSERT INTO \
			GAMEDB (host,port,ssl,name,default_game,status) \
			VALUES (%Q,%d,%d,%Q,%d,%d) \
		;",
		config->game_host,
		config->game_port,
		config->game_usessl,
		config->game_name,
		1,  /* this IS a default game. */
		DBSTATUS_APPROVED /* ...and is pre-approved. */
	);
			
	if ( (sqlite3_exec(db, sqlstr, NULL, NULL, &errmsg)) != SQLITE_OK ) {
		locid_debug(DEBUG_DB,NULL,"Ooops. %s",errmsg);
		if(errmsg) sqlite3_free(errmsg);
		sqlite3_free(sqlstr);
		sqlite3_close(db);
		return(0);
	}

	sqlite3_free(sqlstr);
	sqlite3_close(db);

	char *ver = get_proxy_name();
	sqlstr = sqlite3_mprintf(
		"INSERT INTO \
			DBVERSION (VERSION) \
			VALUES (%Q) \
		;",
		ver
	);
	game_db_exec(NULL,sqlstr);
	free(ver);
	sqlite3_free(sqlstr);

	locid_debug(DEBUG_DB,NULL,"db created.",filename);

	return(1);
}

int hostname_looks_valid(char *host) {

	int someletter=0;

	if(!host) return(0);
	if(!*host) return(0);
	if(strlen(host) > 253) return(0);
	for(char *c=host;*c;c++) {
		if( isalpha(*c) ) {
			someletter++;
		}
		if( !isalnum(*c) ) {
			if( (*c != '.') && 
				(*c != '-') &&
				(*c != ':')
			) {
				return(0);
			}
		}
	}
	if(someletter == 0) {
		return(0);
	}
	return(1);
}

/* return a jobj from db if host and port exist in it.  This is the format used
 * by pc->game_db_entry! */
json_object *game_db_gamelookup(char *host, int port, int ssl) {

	sqlite3 *db;
	sqlite3_stmt *stmt;
	json_object *jobj=NULL;
	char *sqlstr;

	if(!config->db_inuse) { 
		return(NULL);
	}

	/* host should already have been validated, but this is important enough to
	 * check again, because it is going into a sql statement as a string. */
	if( !hostname_looks_valid(host) ) {
		return(NULL);
	}

	if ( (sqlite3_open(config->db_location, &db) != SQLITE_OK) ) {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(NULL);
	}

	sqlstr = sqlite3_mprintf(
		"SELECT DISTINCT JSON_OBJECT( \
			'id',ID, \
			'host',HOST,'port',PORT,'ssl',SSL, \
			'default_game',default_game, \
			'icon',icon, \
			'status',status \
		) FROM GAMEDB \
			WHERE \
			HOST IS %Q COLLATE NOCASE AND \
			PORT IS %d AND \
			SSL IS %d \
		;",
		host,port,ssl
	);

	if ( (sqlite3_prepare(db,sqlstr,-1,&stmt,NULL) != SQLITE_OK) ){
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		sqlite3_free(sqlstr);
		sqlite3_close(db);
		return(NULL);
	}

	int row=0;
	while (sqlite3_step(stmt) != SQLITE_DONE) {
		locid_debug(DEBUG_DB,NULL,"Row %d, has %d columns",
			row,
			sqlite3_column_count(stmt)
		);
		locid_debug(DEBUG_DB,NULL,"%s",sqlite3_column_text(stmt, 0));
		jobj = json_tokener_parse((const char*)sqlite3_column_text(stmt, 0));
	}

	sqlite3_free(sqlstr);
	sqlite3_finalize(stmt);
	sqlite3_close(db);

	return(jobj);
}

int game_db_port_is_banned(int port) {

	GList *i = config->db_banned_ports;
	for(;i;i=i->next) {
		if( *(int*)(i->data) == port ) {
			return(1);
		}
	}
	return(0);

}

/* returns 1 if ok to connect to, 0 otherwise. */
int game_db_suggest(proxy_conn_t *pc, char *host, int port, int ssl) {

	sqlite3 *db;
	sqlite3_stmt *stmt;
	char *sqlstr;
	char *errmsg;
	json_object *jobj=NULL;
	json_object *lookup=NULL;
	int dbstatus;

	/* downcase the hostname. */
	for(char *c=host;*c;c++) {
		*c = tolower(*c);
	}

	locid_info(pc,"Client requests connection to '%s' port %d%s.",
		host,port,
		(ssl)?" SSL":""
	);

	/* host should already have been validated, but this is important enough to
	 * check again, because it is going into a sql statement as a string. */
	
	if( !hostname_looks_valid(host) ) {
		locid_debug(DEBUG_DB,NULL,"The hostname '%s' doesn't look valid.",host);
		return(DBSTATUS_BANNED);
	}

	if(!config->db_inuse) { 
		/* Should still enforce port ban on db-less suggestion.*/
		if(game_db_port_is_banned(port)) {
			return(DBSTATUS_BANNED);
		}
		return(DBSTATUS_NOT_CHECKED);
	}

	/* it is already in the db? */
	if( (lookup=game_db_gamelookup(host,port,ssl)) ) {
		dbstatus = json_object_get_int(json_object_object_get(lookup,"status"));
		json_object_put(lookup);
		/* if its in the database, return its status with no other checks.*/
		return(dbstatus);
	} else {
		locid_debug(DEBUG_DB,NULL,"%s %d is a new db entry.",host,port);
	}

	if ( (sqlite3_open(config->db_location, &db) != SQLITE_OK) ) {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(DBSTATUS_NOT_CHECKED);
	}

	/* if the port is on the banned list, add this request to the db for
	 * posterity and mark it rejected. */
	if(game_db_port_is_banned(port)) {
		dbstatus = DBSTATUS_BANNED;
	} else {
		dbstatus = DBSTATUS_NOT_CHECKED;
	}

	sqlstr = sqlite3_mprintf(
		"INSERT INTO \
			GAMEDB (suggested_by,host,port,ssl,status) \
			VALUES (%Q,%Q,%d,%d,%d) \
		;",
		loci_get_client_hostname(pc),
		host,port,ssl,
		dbstatus
	);
			
	if ( (sqlite3_exec(db, sqlstr, NULL, NULL, &errmsg)) != SQLITE_OK ) {
		locid_debug(DEBUG_DB,NULL,"Ooops. %s",errmsg);
		if(errmsg) sqlite3_free(errmsg);
		sqlite3_free(sqlstr);
		sqlite3_close(db);
		return(dbstatus);
	}

	sqlite3_free(sqlstr);
	sqlite3_close(db);

	return(dbstatus);

}

/* zero on success, non zero on error. */
int game_db_update_status(proxy_conn_t *pc,int dbstatus) {

	char *sqlstr=NULL;
	int id = json_object_get_int(json_object_object_get(pc->game_db_entry,"id"));

	if(id == 0) return(-1);

	sqlstr = sqlite3_mprintf(
		"UPDATE GAMEDB \
			SET STATUS = %d \
			WHERE \
			ID IS %d \
		;",
		dbstatus,id
	);

	int ret = game_db_exec(pc,sqlstr);
	sqlite3_free(sqlstr);
	return(ret);

}

/* zero on success, non zero on error. */
int game_db_update_lastconnection(proxy_conn_t *pc) {

	char *sqlstr=NULL;
	int id = json_object_get_int(json_object_object_get(pc->game_db_entry,"id"));

	if(id == 0) return(-1);

	sqlstr = sqlite3_mprintf(
		"UPDATE GAMEDB \
			SET LAST_CONNECTION = CURRENT_TIMESTAMP \
			WHERE \
			ID IS %d \
		;",
		id
	);

	int ret = game_db_exec(pc,sqlstr);
	sqlite3_free(sqlstr);
	return(ret);

}

/* returns 0 on success (SQLITE_OK).  Non-zero on error.*/
int game_db_exec(proxy_conn_t *pc,char *sqlstr) {

	sqlite3 *db;
	char *errmsg;
	int ret;
	int id;

	if ( (ret=sqlite3_open(config->db_location, &db)) != SQLITE_OK ) {
		locid_debug(DEBUG_DB,pc,"Ooops.  %s",sqlite3_errmsg(db));
		return(ret);
	}


	if ( (ret=sqlite3_exec(db, sqlstr, NULL, NULL, &errmsg)) != SQLITE_OK ) {
		locid_debug(DEBUG_DB,pc,"Ooops. '%s' -> %s",sqlstr, errmsg);
		if(errmsg) sqlite3_free(errmsg);
	} 
	sqlite3_close(db);

	return(ret);
}


/* zero on success, non zero on error. */
int game_db_update_mssp(proxy_conn_t *pc) {

	char *sqlstr=NULL;
	int id = json_object_get_int(json_object_object_get(pc->game_db_entry,"id"));

	if(id == 0) return(-1);

	/* TODO - This is where you sould get the stored MSSP, compare it to the new MSSP,
	 * and update the LAST_UPDATE time if needed. */

	/* store the new MSSP data. */

	if (game_db_get_default_game(pc) == 1) {
		/* don't override the name. */
		sqlstr = sqlite3_mprintf(
			"UPDATE GAMEDB SET "
				"LAST_MSSP = CURRENT_TIMESTAMP, "
				"WEBSITE = %Q, "
				"ICON = %Q, "
				"MSSP = %Q "
				"WHERE ID IS %d "
			";",
			json_object_get_string(json_object_object_get(pc->mssp,"WEBSITE")),
			json_object_get_string(json_object_object_get(pc->mssp,"ICON")),
			json_object_to_json_string(pc->mssp),
			id
		);
	} else {
		sqlstr = sqlite3_mprintf(
			"UPDATE GAMEDB SET "
				"LAST_MSSP = CURRENT_TIMESTAMP, "
				"NAME = %Q, "
				"WEBSITE = %Q, "
				"ICON = %Q, "
				"MSSP = %Q "
				"WHERE ID IS %d "
			";",
			json_object_get_string(json_object_object_get(pc->mssp,"NAME")),
			json_object_get_string(json_object_object_get(pc->mssp,"WEBSITE")),
			json_object_get_string(json_object_object_get(pc->mssp,"ICON")),
			json_object_to_json_string(pc->mssp),
			id
		);
	}

	int ret = game_db_exec(pc,sqlstr);
	sqlite3_free(sqlstr);
	return(ret);

}

int game_db_get_status(proxy_conn_t *pc) {
	return(json_object_get_int(json_object_object_get(pc->game_db_entry,"status")));
}

int game_db_get_default_game(proxy_conn_t *pc) {
	return(json_object_get_int(json_object_object_get(pc->game_db_entry,"default_game")));
}

/* return a jobj from db showing sorted list of playable games. */
json_object *game_db_get_server_list(void) {

	sqlite3 *db;
	sqlite3_stmt *stmt;
	json_object *jobj=NULL;
	json_object *sobj=NULL;
	json_object *aobj=NULL;
	json_object *dobj=NULL;
	char *sqlstr;

	if(!config->db_inuse) { 
		return(NULL);
	}

	if ( (sqlite3_open(config->db_location, &db) != SQLITE_OK) ) {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(NULL);
	}

	sqlstr = sqlite3_mprintf(
		"SELECT JSON_OBJECT("
			"'name',NAME, "
			"'host',HOST, "
			"'port',PORT, "
			"'ssl', SSL, "
			"'icon', ICON, "
			"'default_game', DEFAULT_GAME, "
			"'last_update', LAST_UPDATE "
		") FROM GAMEDB "
		"WHERE "
		"(STATUS IS %d) "
		"ORDER BY "
			"DEFAULT_GAME DESC, "
			"STATUS, "
			"LAST_CONNECTION DESC, "
			"SSL DESC"
		";",
		DBSTATUS_APPROVED
	);

	if ( (sqlite3_prepare(db,sqlstr,-1,&stmt,NULL) != SQLITE_OK) ){
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		sqlite3_free(sqlstr);
		sqlite3_close(db);
		return(NULL);
	}

	jobj = json_object_new_object();
	aobj = json_object_new_array();
	json_object_object_add(jobj, "servers", aobj);

	while (sqlite3_step(stmt) != SQLITE_DONE) {
		dobj = json_tokener_parse((const char*)sqlite3_column_text(stmt, 0));

		json_object_array_add( aobj, dobj );
	}

	locid_debug(DEBUG_DB,NULL,json_object_to_json_string(jobj));

	sqlite3_free(sqlstr);
	sqlite3_finalize(stmt);
	sqlite3_close(db);

	return(jobj);
}

json_object *game_db_mssplookup(char *host, int port, int ssl) {

	sqlite3 *db;
	sqlite3_stmt *stmt;
	json_object *jobj=NULL;
	char *sqlstr;

	if(!config->db_inuse) { 
		return(NULL);
	}

	/* host should already have been validated, but this is important enough to
	 * check again, because it is going into a sql statement as a string. */
	if( !hostname_looks_valid(host) ) {
		return(NULL);
	}

	if ( (sqlite3_open(config->db_location, &db) != SQLITE_OK) ) {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(NULL);
	}

	sqlstr = sqlite3_mprintf(
		"SELECT DISTINCT JSON_OBJECT("
			"'name',NAME, "
			"'host',HOST, "
			"'port',PORT, "
			"'ssl', SSL, "
			"'icon', ICON, "
			"'default_game', DEFAULT_GAME, "
			"'last_update', LAST_UPDATE, "
			"'mssp',MSSP "
		") FROM GAMEDB "
			"WHERE "
			"HOST IS %Q COLLATE NOCASE AND "
			"PORT IS %d AND "
			"SSL IS %d "
		";",
		host,port,ssl
	);

	if ( (sqlite3_prepare(db,sqlstr,-1,&stmt,NULL) != SQLITE_OK) ){
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		sqlite3_free(sqlstr);
		sqlite3_close(db);
		return(NULL);
	}

	int row=0;
	while (sqlite3_step(stmt) != SQLITE_DONE) {
		locid_debug(DEBUG_DB,NULL,"Row %d, has %d columns",
			row,
			sqlite3_column_count(stmt)
		);
		locid_debug(DEBUG_DB,NULL,"%s",sqlite3_column_text(stmt, 0));
		jobj = json_tokener_parse((const char*)sqlite3_column_text(stmt, 0));
	}

	sqlite3_free(sqlstr);
	sqlite3_finalize(stmt);
	sqlite3_close(db);

	return(jobj);
}
