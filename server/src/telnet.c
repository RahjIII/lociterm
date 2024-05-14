/* telnet.c - LociTerm libtelnet event handling code */
/* Created: Fri Apr 29 03:01:13 PM EDT 2022 malakai */
/* $Id: telnet.c,v 1.9 2024/05/14 21:02:30 malakai Exp $ */

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

#include "locid.h"
#include "debug.h"
#include "locilws.h"
#include "client.h"
#include "game.h"

#include "telnet.h"

/* local #defines */
#define ARRAY_SIZE(array) (sizeof(array) / sizeof(array[0]))

/* these are MTTS bitfield definitions. */
#define MTTS_ANSI 1
#define MTTS_VT100 2
#define MTTS_UTF8 4
#define MTTS_256_COLOR 8
#define MTTS_MOUSETRACKING 16
#define MTTS_OSC_COLOR 32
#define MTTS_SCREEN_READER 64
#define MTTS_PROXY 128
#define MTTS_TRUECOLOR 128
#define MTTS_MNES 512
#define MTTS_MSLP 1024
#define MTTS_SSL 2048

/* sometime, make it so the MTTS reported bitfield is controlable from the
 * config file.  For now though... */
#define MTTS_VALUE "943"


/* local structs and typedefs */

/* global variable declarations */

const telnet_telopt_t fixed_telopts[] = {
	{ TELNET_TELOPT_ECHO,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_SGA,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_TTYPE,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_MCCP2,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_NEW_ENVIRON,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_NAWS,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_GMCP,		TELNET_WILL,	TELNET_DO },
	{ -1, 0 ,0 }
};

/* function declarations */
void send_next_ttype(proxy_conn_t *pc);
void loci_client_gmcp_will(proxy_conn_t *pc);
void loci_client_gmcp_wont(proxy_conn_t *pc);

/* code starts here. */

/* cycle through ttypes. */
void send_next_ttype(proxy_conn_t *pc) {

	/* TODO make this selectable from the config file? */
	char *mtts[] = {
		"lociterm",
		"XTERM",
		"MTTS " MTTS_VALUE,
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

	char buf[1024];

	if(!pc) return;
	if(pc->environment) {
		locid_log("[%d] Environment already exists at loci_environment_init.",pc->id);
		loci_environment_free(pc);
	}
	if(pc->hostname) {
		pc->environment = g_list_append(pc->environment,
			loci_new_env_var(TELNET_ENVIRON_VAR,"IPADDRESS",pc->hostname)
		);
	}
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_NAME",LOCID_SHORTNAME)
	);
	snprintf(buf,sizeof(buf),"%d.%d",LOCID_MAJOR_VER,LOCID_MINOR_VER);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_VERSION",buf)
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CHARSET","UTF-8")
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"TERMINAL_TYPE","XTERM") 
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"MTTS",MTTS_VALUE) /* FIXME, should be dynamic. */
	);
	/* TODO make this controllable from the config file too. */
	if(pc->useragent) {
		pc->environment = g_list_append(pc->environment,
			loci_new_env_var(TELNET_ENVIRON_VAR,"HTTP_USER_AGENT",pc->useragent)
		);
	}

	return;

}

void loci_environment_free(proxy_conn_t *f) {
	if(!f) return;

	g_list_free_full(f->environment,(GDestroyNotify)loci_free_env_var);
	f->environment = NULL;
	return;

}

void loci_send_env_var(struct telnet_environ_t *env, telnet_t *telnet) {

	lwsl_user("ENV send: %s = %s",env->var,env->value);

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
	lwsl_user("sent naws (%dx%d)",width,height);
}

/* retrigger a WILL NEW_ENVIRON */
void loci_renegotiate_env(proxy_conn_t *pc) {
	if(pc->game_telnet) {
		telnet_negotiate(pc->game_telnet, TELNET_WILL, TELNET_TELOPT_NEW_ENVIRON);
	}
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
		lwsl_err("TELNET error: %s", event->error.msg);
		break;
	case TELNET_EV_WARNING:
		lwsl_warn("TELNET warning: %s", event->error.msg);
		break;
	case TELNET_EV_WILL:
		switch(event->neg.telopt) {
		case TELNET_TELOPT_GMCP:
			lwsl_user("TELNET TELNET_EV_WILL TELNET_TELOPT_GMCP");
			loci_client_gmcp_will(pc);
			break;
		default: 
			lwsl_user("TELNET TELNET_EV_WILL: %d", event->neg.telopt);
			break;
		}
		break;
	case TELNET_EV_WONT:
		switch(event->neg.telopt) {
		case TELNET_TELOPT_GMCP:
			lwsl_user("TELNET TELNET_EV_WONT TELNET_TELOPT_GMCP");
			loci_client_gmcp_wont(pc);
			break;
		default: 
			lwsl_user("TELNET TELNET_EV_WONT: %d", event->neg.telopt);
			break;
		}
		break;
	case TELNET_EV_DO:
		switch(event->neg.telopt) {
		case TELNET_TELOPT_NAWS:
			lwsl_user("TELNET TELNET_EV_DO TELNET_TELOPT_NAWS");
			loci_telnet_send_naws(pc->game_telnet, pc->width, pc->height);
			break;
		case TELNET_TELOPT_NEW_ENVIRON:
			lwsl_user("TELNET TELNET_EV_DO TELNET_TELOPT_NEW_ENVIRON");
			break;
		case TELNET_TELOPT_TTYPE:
			lwsl_user("TELNET TELNET_EV_DO TELNET_TELOPT_TTYPE");
			break;
		default:
			lwsl_user("TELNET TELNET_EV_DO: unhandled %d", event->neg.telopt);
			break;
		}
		break;
	case TELNET_EV_DONT:
		switch(event->neg.telopt) {
		case TELNET_TELOPT_TTYPE:
			lwsl_user("TELNET TELNET_EV_DONT TELNET_TELOPT_TTYPE");
			pc->ttype_state = 0;
			break;
		default:
			lwsl_user("TELNET TELNET_EV_DONT: unhandled %d", event->neg.telopt);
			break;
		}
	case TELNET_EV_SUBNEGOTIATION:
		switch (event->sub.telopt) {
		case TELNET_TELOPT_GMCP:
			lwsl_user("TELNET TELNET_EV_SUBNEGOTIATION GMCP");
			loci_client_send_cmd(pc,GMCP_OUTPUT,event->data.buffer,event->data.size);
			break;
		case TELNET_TELOPT_NEW_ENVIRON:
		case TELNET_TELOPT_TTYPE:
			/* ignore, handled by its own ev type. */
			break;
		default:
			lwsl_user("TELNET TELNET_EV_SUBNEGOTIATION: %d", event->sub.telopt);
			break;
		}
		break;
	case TELNET_EV_TTYPE:
		if(event->ttype.cmd == TELNET_TTYPE_SEND) {
			send_next_ttype(pc);
		}
		break;
	case TELNET_EV_ENVIRON:
		lwsl_user("TELNET TELNET_EV_ENVIRON: (%ld requests) (cmd %d)", event->environ.size, event->environ.cmd);
		if(event->environ.cmd == TELNET_ENVIRON_SEND) {
			if(event->environ.size == 0) {
				/* send 'em all */
				lwsl_user("Send all env vars.");
				g_list_foreach(pc->environment,(GFunc)loci_send_env_var,pc->game_telnet);
			}
		}
		break;
	default:
		lwsl_user("TELNET unhandled: %d", event->type);
		break;
	}
}


telnet_t *loci_telnet_init(proxy_conn_t *pc) {
	if(!pc) {
		return(NULL);
	}
	
	loci_environment_init(pc);
	if(pc->game_telnet) {
		locid_log("[%d] telnet already exists at loci_environment_init.",pc->id);
	} else {
		pc->game_telnet = telnet_init(fixed_telopts,loci_telnet_handler, 0, (void *)pc);
	}

	return(pc->game_telnet);
}

void loci_telnet_free(proxy_conn_t *pc) {
	if(pc && pc->game_telnet) {
		telnet_free(pc->game_telnet);
		pc->game_telnet = NULL;
	}
}

/* ---- GMCP proxy related stuff. ---- */

void loci_client_gmcp_will(proxy_conn_t *pc) {
	char module[]="Core.Enable";
	loci_client_send_cmd(pc,GMCP_OUTPUT,module,strlen(module));
}

void loci_client_gmcp_wont(proxy_conn_t *pc) {
	char module[]="Core.Disable";
	loci_client_send_cmd(pc,GMCP_OUTPUT,module,strlen(module));
}

void loci_telnet_send_gmcp(telnet_t *telnet, const char *buffer, size_t size) {
	telnet_begin_sb(telnet,TELNET_TELOPT_GMCP);
	telnet_send(telnet,buffer,size);
	telnet_finish_sb(telnet);
	lwsl_user("sent gmcp message (%ld bytes)",size);
}

