/* telnet.c - LociTerm libtelnet event handling code */
/* Created: Fri Apr 29 03:01:13 PM EDT 2022 malakai */
/* $Id: telnet.c,v 1.2 2022/05/02 03:18:36 malakai Exp $ */

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

#include <glib.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <signal.h>
#include <libwebsockets.h>

#include "libtelnet.h"

#include "debug.h"
#include "locilws.h"
#include "client.h"
#include "game.h"

#include "telnet.h"

/* local #defines */
#define ARRAY_SIZE(array) (sizeof(array) / sizeof(array[0]))

/* local structs and typedefs */

/* global variable declarations */

const telnet_telopt_t fixed_telopts[] = {
	{ TELNET_TELOPT_ECHO,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_SGA,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_TTYPE,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_NEW_ENVIRON,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_NAWS,		TELNET_WILL,	TELNET_DONT },
	{ -1, 0 ,0 }
};

/* function declarations */
void send_next_ttype(proxy_conn_t *pc);

/* code starts here. */

/* cycle through ttypes. */
void send_next_ttype(proxy_conn_t *pc) {

	/* TODO make this come from the config file. */
	char *mtts[] = {
		"lociterm",
		"XTERM",
		"MTTS 943",
		""
	};

	if(pc->ttype_state == ARRAY_SIZE(mtts)-1) {
		telnet_ttype_is(pc->game_telnet,mtts[pc->ttype_state-1]);
		pc->ttype_state = 0;
	} else {
		telnet_ttype_is(pc->game_telnet,mtts[pc->ttype_state]);
		pc->ttype_state++;
	}

}

struct telnet_environ_t *loci_new_env_var(int type, char *var, char *value) {
	struct telnet_environ_t *env;
	env = (struct telnet_environ_t*)malloc(sizeof(struct telnet_environ_t));
	env->type = type;
	env->var = strdup(var);
	env->value = strdup(value);
	return(env);
}

void loci_free_env_var(struct telnet_environ_t *f) {
	if(!f) return;
	if(f->var) free(f->var);
	if(f->value) free(f->value);
}

/* creates a reasonable set of telnet env vars for the connection. */
void loci_environment_init(proxy_conn_t *pc) {

	if(!pc) return;
	if(pc->hostname) {
		pc->environment = g_list_append(pc->environment,
			loci_new_env_var(TELNET_ENVIRON_VAR,"IPADDRESS",pc->hostname)
		);
	}
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_NAME","locid") /* FIXME, should follow LOCID_SHORTNAME */
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_VERSION","0.0") /* FIXME, same... */
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CHARSET","UTF-8")
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"TERMINAL_TYPE","XTERM") 
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"MTTS","193") /* FIXME, should be dynamic. */
	);

	return;

}

void loci_environment_free(proxy_conn_t *f) {
	if(!f) return;

	g_list_free_full(f->environment,(GDestroyNotify)loci_free_env_var);
	return;

}

void loci_send_env_var(struct telnet_environ_t *env, telnet_t *telnet) {

	locid_log("ENV send: %s = %s",env->var,env->value);

	telnet_begin_newenviron(telnet,TELNET_ENVIRON_IS);
	telnet_newenviron_value(telnet,env->type,env->var);
	telnet_newenviron_value(telnet,TELNET_ENVIRON_VALUE,env->value);
	telnet_finish_newenviron(telnet);

}

void loci_telnet_send_naws(telnet_t *telnet, int width, int height) {

	char encoding[4];

	encoding[0]=width>>8;
	encoding[1]=width&0xFF;
	encoding[2]=height>>8;
	encoding[3]=height&0xFF;
	
	telnet_begin_sb(telnet,TELNET_TELOPT_NAWS);
	telnet_send(telnet,encoding,sizeof(encoding));
	telnet_finish_sb(telnet);
	locid_log("sent naws (%dx%d)",width,height);
}

void loci_telnet_handler(telnet_t *telnet, telnet_event_t *event, void *user_data) {

	proxy_conn_t *pc = (proxy_conn_t *)user_data;

	switch (event->type) {
	case TELNET_EV_DATA:
		loci_client_write(pc,event->data.buffer,event->data.size);
		break;
	case TELNET_EV_SEND:
		loci_game_write(pc,event->data.buffer,event->data.size);
		break;
	case TELNET_EV_ERROR:
		locid_log("TELNET error: %s", event->error.msg);
		break;
	case TELNET_EV_WARNING:
		locid_log("TELNET warning: %s", event->error.msg);
		break;
	case TELNET_EV_WILL:
		locid_log("TELNET TELNET_EV_WILL: %d", event->neg.telopt);
		break;
	case TELNET_EV_DO:
		switch(event->neg.telopt) {
		case TELNET_TELOPT_NAWS:
			locid_log("TELNET TELNET_EV_DO TELNET_TELOPT_NAWS");
			loci_telnet_send_naws(pc->game_telnet, pc->width, pc->height);
			break;
		case TELNET_TELOPT_NEW_ENVIRON:
			locid_log("TELNET TELNET_EV_DO TELNET_TELOPT_NEW_ENVIRON");
			break;
		case TELNET_TELOPT_TTYPE:
			locid_log("TELNET TELNET_EV_DO TELNET_TELOPT_TTYPE");
			break;
		default:
			locid_log("TELNET TELNET_EV_DO: unhandled %d", event->neg.telopt);
			break;
		}
		break;
	case TELNET_EV_DONT:
		switch(event->neg.telopt) {
		case TELNET_TELOPT_TTYPE:
			locid_log("TELNET TELNET_EV_DONT TELNET_TELOPT_TTYPE");
			pc->ttype_state = 0;
			break;
		default:
			locid_log("TELNET TELNET_EV_DONT: unhandled %d", event->neg.telopt);
			break;
		}
	case TELNET_EV_SUBNEGOTIATION:
		switch (event->sub.telopt) {
		case TELNET_TELOPT_NEW_ENVIRON:
		case TELNET_TELOPT_TTYPE:
			/* ignore, handled by its own ev type. */
			break;
		default:
			locid_log("TELNET TELNET_EV_SUBNEGOTIATION: %d", event->sub.telopt);
			break;
		}
		break;
	case TELNET_EV_TTYPE:
		if(event->ttype.cmd == TELNET_TTYPE_SEND) {
			send_next_ttype(pc);
		}
		break;
	case TELNET_EV_ENVIRON:
		locid_log("TELNET TELNET_EV_ENVIRON: (%d requests) (cmd %d)", event->environ.size, event->environ.cmd);
		if(event->environ.cmd == TELNET_ENVIRON_SEND) {
			if(event->environ.size == 0) {
				/* send 'em all */
				locid_log("Send all env vars.");
				g_list_foreach(pc->environment,(GFunc)loci_send_env_var,pc->game_telnet);
				//loci_send_env_var(pc->environment->data,pc->game_telnet);
			}
		}
		break;
	default:
		locid_log("TELNET unhandled: %d", event->type);
		break;
	}
}


telnet_t *loci_telnet_init(proxy_conn_t *pc) {
	if(!pc) {
		return(NULL);
	}
	
	loci_environment_init(pc);

	pc->game_telnet = telnet_init(fixed_telopts,loci_telnet_handler, 0, (void *)pc);

	return(pc->game_telnet);
}

void loci_telnet_free(proxy_conn_t *pc) {
	if(pc && pc->game_telnet) {
		telnet_free(pc->game_telnet);
		pc->game_telnet = NULL;
	}
}

