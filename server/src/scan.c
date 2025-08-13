/* scan.c - locibot game scanner and crawler */
/* Created: Sat Jan 25 01:55:54 PM EST 2025 malakai */
/* Copyright © 2025 Jeffrika Heavy Industries */
/* $Id: $ */

/* Copyright © 2022-2025 Jeff Jahr <malakai@jeffrika.com>
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
#include <glib.h>
#include <uv.h>
#include <sqlite3.h>

#include "debug.h"
#include "proxy.h"
#include "connect.h"
#include "gamedb.h"

#include "scan.h"

/* local #defines */

/* structs and typedefs */

/* local variable declarations */
static uv_timer_t scan_main_timer;
static uv_timer_t scan_batch_timer;

static uint64_t scan_interval = 60*60*1000;		/* 1hr in ms */
static uint64_t scan_batch_delay = 30*1000;	/* in ms */
static uint64_t scan_batch_size = 3;			/* three */
static uint64_t scan_older_than_s = 60*60;		/* 1hr in seconds */
static uint64_t scan_down_after_s = 60*60*24*7;		/* 1wk in seconds */

/* local function declarations */
void scanner_init(uv_loop_t *uvloop,struct locid_conf *config);
void scanner_main(uv_timer_t *handle);
struct scan_tbd_entry *new_scan_tbd_entry(void);
void free_scan_tbd_entry(struct scan_tbd_entry *f);
GList *scanner_tbd_list(void);
void scanner_dispatch(struct scan_tbd_entry *tbde);

/* ---- code starts here. ---- */
struct scan_tbd_entry *new_scan_tbd_entry(void) {
	struct scan_tbd_entry *new;
	new = (struct scan_tbd_entry *)malloc(sizeof(struct scan_tbd_entry));
	new->host = NULL;
	new->laststatus = 0;
	new->status = 0;
	return(new);
}

void free_scan_tbd_entry(struct scan_tbd_entry *f) {
	if(!f) return;
	if(f->host) {
		free(f->host);
	}
	free(f);
}

/* called to set up the scanner events. */
void scanner_init(uv_loop_t *uvloop,struct locid_conf *config) {

	if( (config->scan_enabled == 0) ) {
		locid_debug(DEBUG_SCAN,NULL,"Config [scan]->enabled is false.");
		return;
	}

	if (config->db_inuse != 1) {
		locid_debug(DEBUG_SCAN,NULL,"Config [scan]->enabled is true, but there is no DB in use.");
		return;
	}

	scan_interval = (config->scan_check_interval * 60*1000); /* minutes to ms */
	scan_older_than_s = config->scan_expired * 60 * 60; /* hours to seconds */
	scan_down_after_s = config->scan_down * 60 * 60; /* hours to seconds */
	scan_batch_size = config->scan_batch_size;  /* Same units */
	scan_batch_delay = config->scan_batch_delay * 1000; /* seconds to ms */

	locid_debug(DEBUG_SCAN,NULL,"interval=%d->%d, older_than_s=%d->%d, batch_delay=%d->%d",
		config->scan_check_interval, scan_interval,
		config->scan_expired, scan_older_than_s,
		config->scan_batch_delay, scan_batch_delay
	);

	/* init the batch loop timer, but don't start it yet.*/
	uv_timer_init(uvloop,&scan_batch_timer);

	/* init the main loop timer, and start it up one second from now.*/
	uv_timer_init(uvloop,&scan_main_timer);
	uv_timer_start(&scan_main_timer, scanner_main, 1000, scan_interval);

	locid_log("Scanner Enabled.");
}

/* Called by uv_timers to handle creation and dispatching of scan requests. */
void scanner_main(uv_timer_t *handle) {

	static GList *tbd = NULL;
	struct scan_tbd_entry *tbde;

	if(tbd == NULL) {
		tbd = scanner_tbd_list();
		if(g_list_length(tbd) != 0) {
			locid_log("Scanner found %d games to refresh.",g_list_length(tbd));
		}
	}

	/* dispatch some of the hosts on the tbd list. */
	for(int i=0;tbd && i<scan_batch_size;i++) {
		tbde = tbd->data;
		tbd = g_list_remove(tbd,tbde);
		/* the tbde gets free'd from scanner_finalize.*/
		/* dispatch it! */
		scanner_dispatch(tbde);
	}

	if(tbd) {
		/* If there is more to do, call again in a short interval. */
		uv_timer_start(&scan_batch_timer, scanner_main, scan_batch_delay,0);
		locid_debug(DEBUG_SCAN,NULL,"%d more to do, dispatch in %d ms",
			g_list_length(tbd), scan_batch_delay
		);
	} else {
		locid_debug(DEBUG_SCAN,NULL,"Scanner dispatch complete.");
	}
	uv_timer_again(handle);

	return;
}


/* returns a GList of games to be scanned. */
GList *scanner_tbd_list(void) {

	char *sqlstr;
	GList *tbd = NULL;
	sqlite3 *db;
	sqlite3_stmt *stmt;
	struct scan_tbd_entry *tbde;

	if(!config->db_inuse) { 
		return(NULL);
	}

	if ( (sqlite3_open(config->db_location, &db) != SQLITE_OK) ) {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(NULL); 
	}

	sqlstr = sqlite3_mprintf(
		"SELECT G.ID, G.HOST, G.PORT, G.SSL, S.STATUS "
			"FROM GAMEDB AS G "
		"LEFT JOIN SCAN AS S ON S.GAME = G.ID "
		"WHERE G.STATUS IS %d AND "
		"( S.LASTSCAN IS NULL OR "
			"unixepoch(CURRENT_TIMESTAMP) - unixepoch(S.LASTSCAN) >= %d"
		") AND "
		"( ( S.STATUS != %d ) AND "
			"(S.SINCE IS NULL or unixepoch(CURRENT_TIMESTAMP) - unixepoch(S.SINCE) < %d)"
		")"
		"ORDER BY G.LAST_CONNECTION ASC"
		";",
		DBSTATUS_APPROVED,
		scan_older_than_s,
		DBSTATUS_APPROVED,
		scan_down_after_s
	);

	if ( (sqlite3_prepare(db,sqlstr,-1,&stmt,NULL) == SQLITE_OK) ){
		while (sqlite3_step(stmt) == SQLITE_ROW) {
			tbde = new_scan_tbd_entry();
			tbde->id = sqlite3_column_int(stmt,0);
			tbde->host = (strdup((char *)sqlite3_column_text(stmt,1)));
			tbde->port = sqlite3_column_int(stmt,2);
			tbde->ssl = sqlite3_column_int(stmt,3);
			tbde->status = sqlite3_column_int(stmt,4);
			tbde->laststatus = tbde->status;
			tbd = g_list_append(tbd,tbde);
		}
		sqlite3_finalize(stmt);
	} else {
		locid_debug(DEBUG_DB,NULL,"Ooops.  %s",sqlite3_errmsg(db));
		return(NULL); 
	}

	/* cleanup: */
	sqlite3_free(sqlstr);
	sqlite3_close(db);
	return(tbd);

}

/* creates a client-less proxy connection to a game. */
void scanner_dispatch(struct scan_tbd_entry *tbde) {

	proxy_conn_t *pc;

	if(!tbde) return;

	pc = new_proxy_conn();
	locid_info(pc,"New proxy connection [%d] for scanner.", pc->id);
	pc->scanner = tbde;

	locid_info(pc,"%sScanning game %d %s %d %s",
		(config->scan_dry_run)?"DRY RUN ":"",
		tbde->id,
		tbde->host,
		tbde->port,
		(tbde->ssl)?"SSL":"TCP"
	);

	/* dry_run isn't documented in the config file, but if it is set, the
	 * scanner will do everything except actually connect to the game in
	 * question.  Useful for testing scan parameters and stuff. */
	if(config->scan_dry_run) {
		/* simulate an answer, but do not actually connect. */
		scanner_update_status(pc,DBSTATUS_NOT_CHECKED);
		loci_proxy_shutdown(pc);
	} else {
		/* MAKE IT SO! ENGAGE! TO INFINITY AND BEYOND! DAMN THE TORPEDOES!
		 * MUSH, YOU HUSKIES! MAKE IT BE HAPPENING! SAFETIES OFF WEAPONS HOT.
		 * OPEN FIRE, ALL WEAPONS! ...and dispatch War Rocket Ajax to bring
		 * back his body. */
		loci_connect_to_game_host(pc,tbde->host,tbde->port,tbde->ssl);
	}

	return;
}

/* called by loci_proxy_shutdown when it sees there is a scanner entry on the
 * PC.  Writes the final result of the host scan to the database. */
void scanner_finalize(proxy_conn_t *pc) {
	

	if(!(pc && pc->scanner)) return;

	locid_info(pc,"Scanned game %s %d %s is %s",
		pc->scanner->host,
		pc->scanner->port,
		(pc->scanner->ssl)?"SSL":"TCP",
		(pc->scanner->status==DBSTATUS_APPROVED)?"UP":"DOWN"
	);

	locid_debug(DEBUG_SCAN,NULL,"Finalizing scan of game %d, status %d",
		pc->scanner->id,
		pc->scanner->status
	);

	char *sqlstr = NULL;
	if(pc->scanner->status != pc->scanner->laststatus) {
		/* change of status */
		sqlstr = sqlite3_mprintf(
			"insert into scan ( game, lastscan, status, since ) "
			"values ( %d, CURRENT_TIMESTAMP, %d, CURRENT_TIMESTAMP ) "
			"on CONFLICT (game) do update set "
			"lastscan = CURRENT_TIMESTAMP, "
			"status=excluded.STATUS, "
			"since= CURRENT_TIMESTAMP "
			";",
			pc->scanner->id,
			pc->scanner->status
		);
	} else {
		sqlstr = sqlite3_mprintf(
			"insert into scan ( game, lastscan, status ) "
			"values ( %d, CURRENT_TIMESTAMP, %d) "
			"on CONFLICT (game) do update set "
			"lastscan = CURRENT_TIMESTAMP, "
			"status=excluded.STATUS "
			";",
			pc->scanner->id,
			pc->scanner->status
		);
	}

	game_db_exec(pc,sqlstr);
	sqlite3_free(sqlstr);

	free_scan_tbd_entry(pc->scanner);
	pc->scanner = NULL;

}

/* called by game.c and scan.c to update the scan status at various points in
 * the connection establishment. */
void scanner_update_status(proxy_conn_t *pc,int dbstatus) {
	
	if(!(pc && pc->scanner)) return;
	pc->scanner->status = dbstatus;
}

