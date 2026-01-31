/* proxy.c - LociTerm protocol bridge */
/* Created: Sun May  1 10:42:59 PM EDT 2022 malakai */
/* $Id: proxy.c,v 1.9 2024/12/06 04:59:51 malakai Exp $*/

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

#include "proxy.h"

#include "client.h"
#include "game.h"
#include "libtelnet.h"
#include "telnet.h"
#include "gamedb.h"
#include "debug.h"
#include "scan.h"
#include "charset.h"


/* structures and types */

/* local function declarations */
void empty_proxy_queue(GQueue *q);

/* locals */
char *proxy_state_str[] = {
	[PRXY_NULL] = "NULL",
	[PRXY_INIT] = "INIT",
	[PRXY_DOWN] = "DOWN",
	[PRXY_CONNECTING] = "CONNECTING",
	[PRXY_UP] = "UP",
	[PRXY_BLOCKING] = "BLOCKING",
	[PRXY_RECONNECTING] = "RECONNECTING",
	[PRXY_CLOSING] = "CLOSING",
	[PRXY_STATE_MAX] = "UNKNOWN"
};

/* idle_proxy_timeout is how long a proxy connection will hang around waiting
 * for a reconnect if one of its sides is not up.  This could be made tunable
 * in the config file sometime, I suppose. */
struct timeval idle_proxy_timeout = {
	.tv_sec = 3600,
	.tv_usec = 0
};

/* this is a global list of all the proxied connections. */
GList *proxyconns = NULL;

/* functions */


/* init a new proxy_conn_t */
proxy_conn_t *new_proxy_conn() {
	proxy_conn_t *n;
	static int id = 0;

	n = (proxy_conn_t *)malloc(sizeof(proxy_conn_t));

	n->id = id++;

	n->client = new_client_conn();
	n->client->pc = n;

	n->scanner = NULL;

	n->game = new_game_conn();
	n->game->pc = n;

	gettimeofday(&(n->watchdog),NULL);

	n->mssp = NULL;
	n->game_db_entry = NULL;

	n->environment = NULL;
	n->charset = strdup(loci_charset_get_default());

	proxyconns=g_list_append(proxyconns,n);

	return(n);
}

void free_proxy_conn(proxy_conn_t *f) {

	if(f->scanner) free_scan_tbd_entry(f->scanner);
	f->scanner = NULL;

	if(f->client) free_client_conn(f->client);
	f->client = NULL;

	if(f->game) free_game_conn(f->game);
	f->game = NULL;

	if(f->mssp) json_object_put(f->mssp);
	f->mssp = NULL;

	if(f->game_db_entry) json_object_put(f->game_db_entry);
	f->game_db_entry = NULL;

	loci_environment_free(f);

	if(f->charset) {
		free(f->charset);
		f->charset = NULL;
	}

	proxyconns=g_list_remove(proxyconns,f);

	locid_debug(DEBUG_PROXY,f,"proxy %d is free.",f->id);

	f->id = -1;
	free(f);

}

void free_proxyconns(void) {
	proxy_conn_t *pc;
	while(proxyconns) {
		pc = proxyconns->data;
		locid_info(pc,"Proxy session freed.");
		proxyconns = g_list_remove(proxyconns,pc);
		free_proxy_conn(pc);
	}
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

void move_proxy_queue(GQueue *dst, GQueue *src) {

	gpointer data;
	
	while(!g_queue_is_empty(src)) {
		if ((data = g_queue_pop_head(src))) {
			g_queue_push_tail(dst,data);
		}
	}

}

/* simple gcompare style function for searching the proxyconn list */
gint uuidcomp (proxy_conn_t *a, char *uuid) {
	if (!(a && a->game)) return(-1);
	if(!(a->game->uuid)) {
		return(-1);
	}
	if(!*uuid) {
		return(1);
	}
	return(strcmp(a->game->uuid,uuid));
}

/* return a pointer to the requested pc, or NULL if it doesn't exist */
proxy_conn_t *find_proxy_conn_by_uuid(char *uuid) {

	GList* pcl; /* proxyconn list item */

	if(!uuid || !*uuid) {
		return(NULL);
	}

	pcl = g_list_find_custom ( proxyconns, uuid, (GCompareFunc)uuidcomp );
	if(!pcl) {
		return(NULL);
	} 
	return(pcl->data);

}

char *get_proxy_state_str(proxy_state_t state) {
	if(	(state < PRXY_INIT) ||
		(state > PRXY_STATE_MAX)
	) {
		state = PRXY_STATE_MAX;
	} 

	return(proxy_state_str[state]);
}

proxy_state_t get_game_state(proxy_conn_t *pc) {
	if(!(pc && pc->game)) return(PRXY_NULL);
	return(pc->game->game_state);
}

proxy_state_t get_client_state(proxy_conn_t *pc) {
	if(!(pc && pc->client)) return(PRXY_NULL);
	return(pc->client->client_state);
}

void set_game_state(proxy_conn_t *pc, proxy_state_t state) {
	proxy_state_t *was = &(pc->game->game_state);

	locid_debug(DEBUG_GAME,pc,"%s -> %s",
		get_proxy_state_str(*was),
		get_proxy_state_str(state)
	);
	*was = state;
}

void set_client_state(proxy_conn_t *pc, proxy_state_t state) {

	proxy_state_t *was = &(pc->client->client_state);

	locid_debug(DEBUG_CLIENT,pc,"%s -> %s",
		get_proxy_state_str(*was),
		get_proxy_state_str(state)
	);
	*was = state;
	loci_environment_update(pc, TELNET_ENVIRON_VALUE, "CLIENT_STATE",
		get_proxy_state_str(get_client_state(pc))
	);
}

int security_checked(proxy_conn_t *pc,int security_flags) {
	int old_check = pc->game->check_protocol;
	pc->game->check_protocol &= ~(security_flags);

	if(pc->game->check_protocol != old_check) {
		locid_debug(DEBUG_GAME,pc,"Passed check %d, %d -> %d",
			security_flags,
			old_check,
			pc->game->check_protocol
		);
	}
	return(pc->game->check_protocol);
}

void security_require(proxy_conn_t *pc,int security_flags,int timeout) {

	int now = time(0);

	if(security_flags == 0) {
		pc->game->check_protocol = 0;
		pc->game->check_wait = 0;
		return;
	}

	pc->game->check_protocol = security_flags;
	pc->game->check_wait = now + timeout;
	if(pc->game->wsi_game) {
		lws_set_timeout(pc->game->wsi_game,PENDING_TIMEOUT_USER_OK,timeout);
	}
	locid_debug(DEBUG_GAME,pc,"Check Required = %d, wait = %d (%d sec)",
		pc->game->check_protocol,
		pc->game->check_wait
	);
}

void security_enforcement(proxy_conn_t *pc) {
	if(!pc) return;
	if(get_game_state(pc) == PRXY_BLOCKING) {
		int now = time(0);
		if( (pc->game->check_wait >0) &&
			(pc->game->check_wait <= now) &&
			(pc->game->check_protocol != 0)
		) {
			locid_debug(DEBUG_CLIENT,pc,"FAILED SECURITY ALARM - closing game side");
			locid_info(pc,"game failed protocol requirements.");
			game_db_update_status(pc,DBSTATUS_BAD_PROTOCOL);
			empty_proxy_queue(pc->client->client_q);
			/* close the game side. */
			set_game_state(pc,PRXY_CLOSING);
			if(pc->game->wsi_game) {
				lws_wsi_close(pc->game->wsi_game, LWS_TO_KILL_ASYNC);
			}
			pc->game->check_wait = 0;
		}
	}
}

const char *loci_get_client_hostname(proxy_conn_t *pc) {
	if(pc && pc->client) {
		return(pc->client->hostname );
	} else {
		return(NULL);
	}
}

const char *loci_get_game_uuid(proxy_conn_t *pc) {
	if(pc && pc->game) {
		return(pc->game->uuid);
	} else {
		return(NULL);
	}
}

/* Schedule the client side close process. */
void loci_client_shutdown(proxy_conn_t *pc) {

	if(!(pc && pc->client && pc->client->wsi_client)) return;

	set_client_state(pc,PRXY_CLOSING);
	loci_client_invalidate_key(pc);
	/* The LWS example code would close with
	 * lws_wsi_close(pc->client->wsi_client, LWS_TO_KILL_ASYNC) if the
	 * client queue was empty, but that seems too abrupt, in that the
	 * client side frequently didn't get the final "logout" message
	 * text before closing.  Taking the lws_set_timeout route allows
	 * some time for those last messages to be delivered. The number
	 * after the define is seconds.-jsj */

	lws_set_timeout(pc->client->wsi_client,
		PENDING_TIMEOUT_KILLED_BY_PROXY_CLIENT_CLOSE, 1
	); 
	return;

}

/* Schedule the game side close process. */
void loci_game_shutdown(proxy_conn_t *pc) {

	if(!(pc && pc->game && pc->game->wsi_game)) return;

	set_game_state(pc,PRXY_CLOSING);
	if(get_client_state(pc) == PRXY_UP) {
		loci_client_invalidate_key(pc);
	}

	lws_set_timeout(pc->game->wsi_game,
		PENDING_TIMEOUT_KILLED_BY_PROXY_CLIENT_CLOSE, 1
	); 
	return;

}

/* Trigger shutdown on any open proxy sides.  If none open, free the proxy. */
void loci_proxy_shutdown(proxy_conn_t *pc) {

	if(!pc) return;

	scanner_finalize(pc);

	if(pc->game && pc->game->wsi_game) {
		loci_game_shutdown(pc);
		return;
	}

	if(pc->client && pc->client->wsi_client) {
		loci_client_shutdown(pc);
		return;
	}

	locid_info(pc,"Proxy session ends. [%d]",pc->id);
	free_proxy_conn(pc);

	return;

}

void loci_client_send_echosga(proxy_conn_t *pc) {

	json_object *jobj;
	char *jstr;

	if(pc->game->data_sent == 0) return;

	int mode = ( 
		((loci_game_telopt_active(pc,TELNET_TELOPT_ECHO) & 0x1)<<1) |
		(loci_game_telopt_active(pc,TELNET_TELOPT_SGA) & 0x1)
	);

	jobj = json_object_new_int(mode);

	jstr = json_object_to_json_string(jobj);

	loci_client_send_cmd(pc,ECHO_MODE,jstr,strlen(jstr));
	locid_debug(DEBUG_CLIENT,pc,"send ECHO_MODE '%s'",jstr);
	json_object_put(jobj);

}

void loci_client_send_gmcp(proxy_conn_t *pc) {

	if(loci_game_telopt_active(pc,TELNET_TELOPT_GMCP)) { 
		char module[]="Core.Enable";
		loci_client_send_cmd(pc,GMCP_DATA,module,strlen(module));
	} else {
		char module[]="Core.Disable";
		loci_client_send_cmd(pc,GMCP_DATA,module,strlen(module));
	}

}

void loci_client_send_gaeor(proxy_conn_t *pc, const char *msg) {
	json_object *r;
	char *jstr;

	/* not going to validate the msg- but valid messages are: 
		enable disable GA EOR
	*/

	r = json_object_new_object();

	if( msg == NULL) {
		char *status;
		if(loci_game_telopt_active(pc,TELNET_TELOPT_EOR)) { 
			status = "enabled";
		} else {
			status = "disabled";
		}
		json_object_object_add(r,"mark",json_object_new_string(status));
	} else {
		json_object_object_add(r,"mark",json_object_new_string(msg));
	}
	
	jstr = json_object_to_json_string(r);
	loci_client_send_cmd(pc,GAEOR,jstr,strlen(jstr));

	locid_debug(DEBUG_CLIENT,pc,"sent GAEOR '%s'",jstr);
	json_object_put(r);

}

void loci_client_invalidate_key(proxy_conn_t *pc) {
	json_object *r;
	char *jstr;

	if(!pc) return;

	r = json_object_new_object();
	json_object_object_add(r,"reconnect",json_object_new_string("invalidate"));

	jstr = json_object_to_json_string(r);
	loci_client_send_cmd(pc,CONNECT,jstr,strlen(jstr));
	
	locid_debug(DEBUG_CLIENT,pc,"sent invalidate '%s'",jstr);
	json_object_put(r);
}

void loci_game_send(proxy_conn_t *pc, const char *buffer, size_t size) {
	if( !(pc && pc->game && pc->game->game_telnet)) return;
	telnet_send_text(pc->game->game_telnet,buffer,size);
}

void loci_game_send_gmcp(proxy_conn_t *pc, const char *buffer, size_t size) {
	if( !(pc && pc->game && pc->game->game_telnet)) return;
	if( (loci_game_telopt_active(pc,TELNET_TELOPT_GMCP))) {
		loci_telnet_send_gmcp(pc->game->game_telnet,buffer,size);
	}
}


void loci_game_send_naws(proxy_conn_t *pc) {
	if( !(pc && pc->game && pc->game->game_telnet)) return;
	if( !(pc && pc->client)) return;
	if( (loci_game_telopt_active(pc,TELNET_TELOPT_NAWS))) {
		loci_telnet_send_naws(pc->game->game_telnet,pc->client->width,pc->client->height);
	}
}

/* returns 1 if the watchdog has expired and is barking, 0 otherwise. */
int loci_proxy_watchdog(proxy_conn_t *pc) {
	
	struct timeval now;
	struct timeval deltat;

	if(!pc) return(1);
	
	/* if both sides of the proxy are present, pat the doggie and we're good. */
	if( (get_game_state(pc) == PRXY_UP) && 
		(get_client_state(pc) == PRXY_UP) 
	) {
		gettimeofday(&(pc->watchdog),NULL);
		return(0);
	}

	gettimeofday(&now,NULL);
	timersub(&now,&(pc->watchdog),&deltat);

	if(timercmp(&(deltat),&(idle_proxy_timeout),>)) {
		/* watchdog has expired! */
		return(1);
	}

	return(0);

}

// return a count of how many scan connections are still running.
int get_active_scan_count(void) {

	GList *l;
	proxy_conn_t *pc;
	int count = 0;

	for(l = proxyconns;l;l=l->next) {
		pc = (proxy_conn_t *)(l->data);
		if(pc->scanner) count++;
	}
	return(count);
}

void loci_proxy_log_status(void) {

	GList *l;
	proxy_conn_t *pc;

	locid_log_reinit(config->log_file);

	locid_log("SIG There are %d active proxy sessions.",g_list_length(proxyconns));
	for(l = proxyconns;l;l=l->next) {
		pc = (proxy_conn_t *)(l->data);
		if(pc->client && pc->game) {
			locid_log("SIG [%d] %s (%s) -> %s (%s)",
				pc->id,
				(pc->client->hostname)?(pc->client->hostname):"NONE",
				get_proxy_state_str(get_client_state(pc)),
				(pc->game->hostname)?(pc->game->hostname):"NONE",
				get_proxy_state_str(get_game_state(pc))
			);
		} else {
			locid_log("SIG [%d] (incomplete)",pc->id);
		}
	}
}

void loci_client_send_netstat(proxy_conn_t *pc) {

	json_object *jobj;
	json_object *cobj;
	json_object *gobj;
	json_object *tobj;
	char *jstr;
	client_conn_t *cc;
	game_conn_t *gc;
	char buf[1024];
	int ssl;

	if(!pc) return;
	if(!(cc=pc->client)) return;
	gc = pc->game;

	jobj = json_object_new_object();

	// client side info
	cobj = json_object_new_object();
	json_object_object_add(jobj,"client",cobj);

	json_object_object_add(cobj,"state",
		json_object_new_string(
			get_proxy_state_str(get_client_state(pc))
		)
	);

	if( !(strcmp(config->client_security ,"ssl") )) {
		ssl = 1;
	} else {
		ssl = 0;
	}

	json_object_object_add(cobj,"ssl",
		json_object_new_int(ssl)
	);

	json_object_object_add(cobj,"host",
		json_object_new_string(cc->hostname)
	);
	json_object_object_add(cobj,"forwarder",
		json_object_new_string(cc->hostforwarder)
	);
	json_object_object_add(cobj,"connections",
		json_object_new_int(cc->connections)
	);

	iostat_printhuman(buf,sizeof(buf),cc->ios);
	json_object_object_add(cobj,"data",
		json_object_new_string(buf)
	);
	iostat_printhrate(buf,sizeof(buf),cc->ios);
	json_object_object_add(cobj,"rate",
		json_object_new_string(buf)
	);
	json_object_object_add(cobj,"rtt",
		json_object_new_int(
			pc->client->tcp_info.tcpi_rtt
		)
	);
	json_object_object_add(cobj,"rttvar",
		json_object_new_int(
			pc->client->tcp_info.tcpi_rttvar
		)
	);

	// game side info
	gobj = json_object_new_object();
	json_object_object_add(jobj,"server",gobj);

	json_object_object_add(gobj,"state",
		json_object_new_string(
			get_proxy_state_str(get_game_state(pc))
		)
	);
	if(gc) {
		if(gc->hostname) {
			json_object_object_add(gobj,"host",
				json_object_new_string(gc->hostname)
			);
		} else {
			json_object_object_add(gobj,"host",
				json_object_new_string("none")
			);
		}
		json_object_object_add(gobj,"port",
			json_object_new_int(gc->port)
		);
		json_object_object_add(gobj,"ssl",
			json_object_new_int(gc->ssl)
		);
		json_object_object_add(gobj,"reconnections",
			json_object_new_int(gc->reconnections)
		);

		iostat_printhuman(buf,sizeof(buf),gc->ios);
		json_object_object_add(gobj,"data",
			json_object_new_string(buf)
		);
		iostat_printhrate(buf,sizeof(buf),gc->ios);
		json_object_object_add(gobj,"rate",
			json_object_new_string(buf)
		);
		json_object_object_add(gobj,"rtt",
			json_object_new_int(
				pc->game->tcp_info.tcpi_rtt
			)
		);
		json_object_object_add(gobj,"rttvar",
			json_object_new_int(
				pc->game->tcp_info.tcpi_rttvar
			)
		);

	}

	// proxy specific stuff
	json_object_object_add(jobj,"proxycount",
		json_object_new_int(g_list_length(proxyconns))
	);

	// telnet protocols
	if(gc->game_telnet) {
		tobj = json_object_new_object();
		int *inq = telnet_option_list(gc->game_telnet);
		for(int i=0;inq[i]!=-1;i++) {
			int us, them;
			if (telnet_check_option(gc->game_telnet,inq[i],&us,&them)) {
				json_object *cs = json_object_new_object();
				json_object_object_add(cs,"c",json_object_new_int(us));
				json_object_object_add(cs,"s",json_object_new_int(them));
				json_object_object_add(tobj,telopt_name(inq[i]),cs);
			}
		}
		json_object_object_add(jobj,"telnet",tobj);
	}

	// gmcp?

	// and ship it.
	jstr = json_object_to_json_string(jobj);

	loci_client_send_cmd(pc,NETSTAT,jstr,strlen(jstr));
	locid_debug(DEBUG_CLIENT,pc,"send NETSTAT '%s'",jstr);

	json_object_put(jobj);

}

/* command the charset down to the client. */
void loci_client_send_charset(proxy_conn_t *pc) {
	loci_client_send_cmd(pc,CHARSET,pc->charset,strlen(pc->charset));
}

/* command the charset down to the server. */
void loci_game_send_charset(proxy_conn_t *pc) {
	loci_charset_send_request(pc);
}

/* set the charset value in the proxy.  Note that this doesn't inform either
 * the client or game. Caller should also call loci_client_send_charset or
 * loci_game_send_charset (or both) depending on the direction required. */
void loci_proxy_set_charset(proxy_conn_t *pc, const char *charset) {
	char *s = strdup(charset);
	if(pc->charset) free(pc->charset);
	pc->charset = s;
	loci_environment_update(pc,TELNET_ENVIRON_VAR,"CHARSET",charset);
}

