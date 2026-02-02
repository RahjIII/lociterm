/* telnet.c - LociTerm libtelnet event handling code */
/* Created: Fri Apr 29 03:01:13 PM EDT 2022 malakai */
/* $Id: telnet.c,v 1.19 2024/12/06 04:59:51 malakai Exp $ */

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
#include <arpa/inet.h>
#define TELOPTS
#define TELCMDS
#include <arpa/telnet.h>
#include <signal.h>
#include <libwebsockets.h>

#include "libtelnet.h"

#include "locid.h"
#include "debug.h"
#include "proxy.h"
#include "client.h"
#include "game.h"
#include "gamedb.h"
#include "charset.h"

#include "telnet.h"

/* ---- local #defines */
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
#define MTTS_TRUECOLOR 256
#define MTTS_MNES 512
#define MTTS_MSLP 1024
#define MTTS_SSL 2048

/* sometime, make it so the MTTS reported bitfield is controlable from the
 * config file.  For now though... */
#define MTTS_BITS (MTTS_ANSI|MTTS_VT100|MTTS_UTF8|MTTS_256_COLOR|MTTS_MOUSETRACKING|MTTS_PROXY|MTTS_TRUECOLOR|MTTS_MNES|MTTS_SSL)

/* local structs and typedefs */

/* global variable declarations */

const telnet_telopt_t supported_telopts[] = {
	{ TELNET_TELOPT_BINARY,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_ECHO,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_SGA,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_CHARSET,	TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_TTYPE,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_EOR,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_MCCPX,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_MCCP2,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_NEW_ENVIRON,TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_NAWS,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_GMCP,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_MSSP,		TELNET_WONT,	TELNET_DO },
	{ -1, 0 ,0 }
};

const telnet_telopt_t nomssp_telopts[] = {
	{ TELNET_TELOPT_BINARY,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_ECHO,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_SGA,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_CHARSET,	TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_TTYPE,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_EOR,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_MCCPX,		TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_MCCP2,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_NEW_ENVIRON,TELNET_WILL,	TELNET_DO },
	{ TELNET_TELOPT_NAWS,		TELNET_WILL,	TELNET_DONT },
	{ TELNET_TELOPT_GMCP,		TELNET_WONT,	TELNET_DO },
	{ TELNET_TELOPT_MSSP,		TELNET_WONT,	TELNET_DONT },
	{ -1, 0 ,0 }
};

/* function declarations */
void send_next_ttype(proxy_conn_t *pc);
void loci_client_gmcp_will(proxy_conn_t *pc);
void loci_client_gmcp_wont(proxy_conn_t *pc);
json_object *mssp_to_json(struct mssp_t *mssp);
int set_echosga(int state, int telopt, int yesno);

/* code starts here. */

/* cycle through ttypes. */
void send_next_ttype(proxy_conn_t *pc) {

	/* TODO make this selectable from the config file?  */

	gchar **mtts;
	char str[256];

	if(pc->scanner) {
		g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
		g_strv_builder_add (builder, "locibot");
		g_strv_builder_add (builder, "XTERM");
		g_snprintf(str,sizeof(str),"MTTS %d",(MTTS_BITS & (~MTTS_PROXY)));
		g_strv_builder_add (builder, str);
		g_strv_builder_add (builder, "");
		mtts = g_strv_builder_end (builder);
	} else {
		g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
		g_strv_builder_add (builder, "lociterm");
		g_strv_builder_add (builder, "XTERM");
		g_snprintf(str,sizeof(str),"MTTS %d",(MTTS_BITS | MTTS_PROXY));
		g_strv_builder_add (builder, str);
		g_strv_builder_add (builder, "");
		mtts = g_strv_builder_end (builder);
	}

	int length=0;
	for(;*mtts[length];length++);

	if(pc->game->ttype_state == length) {
		telnet_ttype_is(pc->game->game_telnet,mtts[pc->game->ttype_state-1]);
		pc->game->ttype_state = 0;
	} else {
		telnet_ttype_is(pc->game->game_telnet,mtts[pc->game->ttype_state]);
		pc->game->ttype_state++;
	}

	g_strfreev(mtts);
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
	free(f);
}

/* creates a reasonable set of telnet env vars for the connection. */
void loci_environment_init(proxy_conn_t *pc) {

	char buf[1024];

	if(pc->environment) {
		locid_debug(DEBUG_TELNET,pc,"Environment already exists, reseting");
		loci_environment_free(pc);
	}
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_NAME",LOCID_SHORTNAME)
	);
	snprintf(buf,sizeof(buf),"%s",LOCITERM_VERSION);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_VERSION",buf)
	);
	if(pc->charset) {
		pc->environment = g_list_append(pc->environment,
			loci_new_env_var(TELNET_ENVIRON_VAR,"CHARSET",pc->charset)
		);
	} else {
		pc->environment = g_list_append(pc->environment,
			loci_new_env_var(TELNET_ENVIRON_VAR,"CHARSET",loci_charset_get_default())
		);
	}
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"TERMINAL_TYPE","XTERM") 
	); 
	if(pc->scanner) {
		snprintf(buf,sizeof(buf),"%d",(MTTS_BITS & (~MTTS_PROXY)));
	} else {
		snprintf(buf,sizeof(buf),"%d",(MTTS_BITS | MTTS_PROXY));
	}
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"MTTS",buf)
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"COLORTERM","truecolor")
	);

	/* The client code knows what version it supports and could report that up
	 * to the locid server directly, but there's no dedicated protocol message
	 * for reporting it yet.  For now... just hardcode it server side. */
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"UNICODE_VERSION","11.0.0")
	);

	/* some mudlet-ism's that some game servers look for. */
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"TRUECOLOR","1")
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"256_COLORS","1")
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_VAR,"ANSI","1")
	);

	/* OSC8 Hyperlink support reporting.  See: */
	/* https://wiki.mudlet.org/w/Area_51#OSC_8:_Hyperlink_Protocol.2C_PR_.237828.2C_.238262 */
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_USERVAR,"OSC_HYPERLINKS","1")
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_USERVAR,"OSC_HYPERLINKS_SEND","1")
	);
	pc->environment = g_list_append(pc->environment,
		loci_new_env_var(TELNET_ENVIRON_USERVAR,"OSC_HYPERLINKS_PROMPT","1")
	);


	if(pc->client) {
		if(pc->client->useragent) {
			/* TODO make this controllable from the config file too. */
			pc->environment = g_list_append(pc->environment,
				loci_new_env_var(TELNET_ENVIRON_VAR,"HTTP_USER_AGENT",pc->client->useragent)
			);
		}
		if(pc->client->hostname) {
			pc->environment = g_list_append(pc->environment,
				loci_new_env_var(TELNET_ENVIRON_VAR,"IPADDRESS",pc->client->hostname)
			);
		}
		pc->environment = g_list_append(pc->environment,
			loci_new_env_var(TELNET_ENVIRON_VAR,"CLIENT_STATE",
				get_proxy_state_str(get_client_state(pc))
			)
		);
	}

	pc->environment = g_list_reverse(pc->environment);

	return;

}

void loci_environment_free(proxy_conn_t *f) {

	g_list_free_full(g_steal_pointer (&(f->environment)), (GDestroyNotify)loci_free_env_var);
	f->environment = NULL;
	return;

}

void loci_send_env_var(struct telnet_environ_t *env, telnet_t *telnet) {

	locid_debug(DEBUG_TELNET,NULL,"ENV send IS: %s = %s",env->var,env->value);

	telnet_begin_newenviron(telnet,TELNET_ENVIRON_IS);
	telnet_newenviron_value(telnet,env->type,env->var);
	telnet_newenviron_value(telnet,TELNET_ENVIRON_VALUE,env->value);
	telnet_finish_newenviron(telnet);

}

void loci_send_env_var_info(struct telnet_environ_t *env, telnet_t *telnet) {

	locid_debug(DEBUG_TELNET,NULL,"ENV send INFO: %s = %s",env->var,env->value);

	telnet_begin_newenviron(telnet,TELNET_ENVIRON_INFO);
	telnet_newenviron_value(telnet,env->type,env->var);
	telnet_newenviron_value(telnet,TELNET_ENVIRON_VALUE,env->value);
	telnet_finish_newenviron(telnet);

}

void loci_environment_update(proxy_conn_t *pc, int type, char *var, char *value) {

	GList *l;
	struct telnet_environ_t *t;

	for(l=pc->environment;l;l=l->next) {
		t = l->data;
		if (!strcmp(t->var,var)) {
			/* found the variable. */
			if(t->value) {
				free(t->value);
			}
			t->value = strdup(value);
			break;
		}
	}
	if(l == NULL) {
		t=loci_new_env_var(TELNET_ENVIRON_VAR,var,value);
		pc->environment = g_list_append(pc->environment,t);
	}
	
	if( pc->game && 
		pc->game->game_telnet &&
		loci_game_telopt_active(pc,TELNET_TELOPT_NEW_ENVIRON)
	) {
		loci_send_env_var_info(t, pc->game->game_telnet);
	}

}


void loci_telnet_send_naws(telnet_t *telnet, int width, int height) {

	char encoding[4];
	if (!telnet) return;

	encoding[0]=width>>8;
	encoding[1]=width&0xFF;
	encoding[2]=height>>8;
	encoding[3]=height&0xFF;

	telnet_begin_sb(telnet,TELNET_TELOPT_NAWS);
	telnet_send(telnet,encoding,sizeof(encoding));
	telnet_finish_sb(telnet);
	locid_debug(DEBUG_TELNET,NULL,"sent naws (%dx%d)",width,height);
}

/* retrigger a WILL NEW_ENVIRON */
void loci_renegotiate_env(proxy_conn_t *pc) {
	if(pc && pc->game && pc->game->game_telnet) {
		telnet_negotiate(pc->game->game_telnet, TELNET_WILL, TELNET_TELOPT_NEW_ENVIRON);
	}
}

void loci_renegotiate_gmcp(proxy_conn_t *pc) {
	if(pc && pc->game && pc->game->game_telnet) {
		telnet_negotiate(pc->game->game_telnet, TELNET_WILL, TELNET_TELOPT_GMCP);
	}
	loci_client_gmcp_will(pc);
}


void loci_telnet_handler(telnet_t *telnet, telnet_event_t *event, void *user_data) {

	game_conn_t *gc = (game_conn_t *)user_data;
	proxy_conn_t *pc = gc->pc;
	
	locid_debug(DEBUG_EVENTNO,pc,"event %d", event->type);

	switch (event->type) {
	case TELNET_EV_DATA:
		if(!(gc->data_sent)) {
			gc->data_sent = 1;
			loci_client_send_echosga(pc);
		}
		loci_client_write(pc,event->data.buffer,event->data.size);

		break;
	case TELNET_EV_IAC: {
		switch(event->iac.cmd) {
		case TELNET_AYT:
			loci_game_write(pc,"\r\n[YES]\r\n",9);
			break;
		case TELNET_GA:
			loci_client_send_gaeor(pc, "GA");
			break;
		case TELNET_EOR:
			loci_client_send_gaeor(pc, "EOR");
			break;
		default:
			locid_debug(DEBUG_TELNET,pc,"Recieved IAC %d",event->iac.cmd);
			break;
		}
		break;
	}
	case TELNET_EV_SEND:
		loci_game_write(pc,event->data.buffer,event->data.size);
		break;
	case TELNET_EV_ERROR:
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_ERROR: %s",event->error.msg);
		break;
	case TELNET_EV_WARNING:
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_WARNING: %s",event->error.msg);
		break;
	case TELNET_EV_WILL:
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_WILL '%s'",telopt_name(event->neg.telopt));
		security_checked(pc,CHECK_TELNET);
		switch(event->neg.telopt) {
		case TELNET_TELOPT_ECHO:
			loci_client_send_echosga(pc);
			break;
		case TELNET_TELOPT_SGA:
			loci_client_send_echosga(pc);
			break;
		case TELNET_TELOPT_MSDP:
			security_checked(pc,CHECK_MUD);
			break;
		case TELNET_TELOPT_MCCP2:
			security_checked(pc,CHECK_MUD);
			break;
		case TELNET_TELOPT_GMCP:
			security_checked(pc,CHECK_MUD);
			loci_client_gmcp_will(pc);
			break;
		case TELNET_TELOPT_EOR:
			loci_client_send_gaeor(pc,NULL);
			break;
		case TELNET_TELOPT_MCCPX: {
			security_checked(pc,CHECK_MUD);
			/* send acceptable compression algos */
			/* if you ever want to make this a preference, Here, how you'd do it. */
			/* 
				char accept_encodings[]="x-testing,deflate,zstd,none";
				telnet_send_mccpx_accept(telnet,accept_encodings,strlen(accept_encodings));
				locid_debug(DEBUG_TELNET,pc,"MCCPX will accept encodings: '%s'",accept_encodings);
			*/
			locid_debug(DEBUG_TELNET,pc,"MCCPX will accept libtelnet default encodings.");
			telnet_send_mccpx_accept(telnet,NULL,0);
	
			/* Having detected server side availability, offer to get the
			 * client side compressing too, i.e. bidirectional compression.
			 * (This is because at time of writing, lociterm client telnet is
			 * completely passive, it only offers to do protocols that the
			 * server has offered up first.) */
			telnet_negotiate(telnet, TELNET_WILL, TELNET_TELOPT_MCCPX);
			break;
		}
		default: 
			break;
		}
		break;
	case TELNET_EV_WONT:
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_WONT '%s'",telopt_name(event->neg.telopt));
		security_checked(pc,CHECK_TELNET);
		switch(event->neg.telopt) {
		case TELNET_TELOPT_ECHO:
			loci_client_send_echosga(pc);
			break;
		case TELNET_TELOPT_SGA:
			loci_client_send_echosga(pc);
			break;
		case TELNET_TELOPT_GMCP:
			loci_client_gmcp_wont(pc);
			break;
		case TELNET_TELOPT_EOR:
			loci_client_send_gaeor(pc,NULL);
			break;
		case TELNET_TELOPT_MCCPX: {
			mccpx_inform_ev(telnet,STREAM_RECV,TELNET_EOK,"Compressor sent a WONT");
			mccpx_end(telnet,STREAM_RECV);
			break;
		}
		default: 
			break;
		}
		break;
	case TELNET_EV_DO:
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_DO '%s'",telopt_name(event->neg.telopt));
		security_checked(pc,CHECK_TELNET);
		switch(event->neg.telopt) {
		case TELNET_TELOPT_NAWS:
			loci_telnet_send_naws(gc->game_telnet, pc->client->width, pc->client->height);
			break;
		case TELNET_TELOPT_NEW_ENVIRON:
			break;
		case TELNET_TELOPT_TTYPE:
			break;
		case TELNET_TELOPT_SGA:
			loci_client_send_echosga(pc);
			break;
		case TELNET_TELOPT_CHARSET: {
			loci_charset_handler(telnet,event,user_data);
			break;
		}
		default:
			break;
		}
		break;
	case TELNET_EV_DONT:
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_DONT '%s'",telopt_name(event->neg.telopt));
		security_checked(pc,CHECK_TELNET);
		switch(event->neg.telopt) {
		case TELNET_TELOPT_TTYPE:
			gc->ttype_state = 0;
			break;
		case TELNET_TELOPT_SGA:
			loci_client_send_echosga(pc);
			break;
		case TELNET_TELOPT_MCCPX: {
			mccpx_inform_ev(telnet,STREAM_RECV,TELNET_EOK,"Decompressor sent a DONT");
			mccpx_end(telnet,STREAM_SEND);
			break;
		}
		default:
			break;
		}
	case TELNET_EV_SUBNEGOTIATION:
		security_checked(pc,CHECK_TELNET);
		locid_debug(DEBUG_TELNET,pc,"TELNET_EV_SUBNEGOTIATION '%s'",telopt_name(event->sub.telopt));
		switch (event->sub.telopt) {
		case TELNET_TELOPT_GMCP:
			security_checked(pc,CHECK_MUD);
			loci_client_send_cmd(pc,GMCP_DATA,event->data.buffer,event->data.size);
			break;
		case TELNET_TELOPT_CHARSET: {
			loci_charset_handler(telnet,event,user_data);
			break;
		}
		case TELNET_TELOPT_NEW_ENVIRON:
		case TELNET_TELOPT_TTYPE:
			/* ignore, handled by its own ev type. */
			break;
		case TELNET_TELOPT_MSSP:
			security_checked(pc,CHECK_MSSP);
			break;
		default:
			break;
		}
		break;
	case TELNET_EV_TTYPE:
		if(event->ttype.cmd == TELNET_TTYPE_SEND) {
			send_next_ttype(pc);
		}
		break;
	case TELNET_EV_ENVIRON:
		locid_debug(DEBUG_TELNET,pc,"TELNET TELNET_EV_ENVIRON: (%ld requests) (cmd %d)", event->environ.size, event->environ.cmd);
		if(event->environ.cmd == TELNET_ENVIRON_SEND) {
			if(event->environ.size == 0) {
				/* send 'em all */
				locid_debug(DEBUG_TELNET,pc,"Send all env vars.");
				g_list_foreach(pc->environment,(GFunc)loci_send_env_var,gc->game_telnet);
			}
		}
		break;
	case TELNET_EV_MSSP: {
		security_checked(pc,CHECK_MUD);
		security_checked(pc,CHECK_MSSP);
		locid_debug(DEBUG_MSSP,pc,"MSSP event, size %d items.",event->mssp.size);
		if(pc->mssp) {
			locid_debug(DEBUG_MSSP,pc,"Already had mssp data in pc?  Replacing...");
			json_object_put(pc->mssp);
		}
		pc->mssp = mssp_to_json(&(event->mssp));
		game_db_update_mssp(pc);
		break;
	}
	case TELNET_EV_COMPRESS: {
		locid_debug(DEBUG_TELNET,pc,"MCCP[123] Compression %s.",
			event->compress.state?"Enabled":"Disabled"
		);
		break;
	}
	case TELNET_EV_MCCPX: {
		/* error message handling */
		if(event->mccpx.status == TELNET_EPROTOCOL) {
			locid_debug(DEBUG_TELNET,pc,"MCCPX %s peer only supports '%s'",
				(event->mccpx.direction == STREAM_SEND)?"SEND":"RECV",
				(event->mccpx.offered)
			);
			/* I could try to start mccp2 here if I wanted. */
			/* if(event->mccpx.direction == STREAM_SEND) {
				telnet_negotiate(telnet, TELNET_WILL, TELNET_TELOPT_MCCP2);
			}
			*/
		}
		locid_debug(DEBUG_TELNET,pc,"MCCPX %s '%s' code=%d: %s",
			(event->mccpx.direction == STREAM_SEND)?"SEND":"RECV",
			(event->mccpx.inuse),
			(event->mccpx.status),
			(event->mccpx.msg)
		);
		break;
	}
	default:
		locid_debug(DEBUG_TELNET,pc,"TELNET unhandled: %d", event->type);
		break;
	}
}

telnet_t *loci_telnet_init(game_conn_t *gc) {

	telnet_telopt_t *telopts=NULL;

	if(!gc) {
		return(NULL);
	}

	if(gc->request_mssp) {
		telopts = supported_telopts;
	} else {
		telopts = nomssp_telopts;
	}
	
	loci_environment_init(gc->pc);
	if(gc->game_telnet) {
		locid_debug(DEBUG_TELNET,gc->pc,"game_telnet already exists! re-using");
	} else {
		gc->game_telnet = telnet_init(telopts,loci_telnet_handler, 0 , (void *)gc);
	}

	/* I added this to trigger an active telnet negotiation from this client.
	 * If you want to be the first active participant to speak telnet,
	 * uncomment this.  Maybe a preference sometime?  After trying, it seems
	 * like pidgin telnet muds don't really like the client going first.
	
	for(int i=0;telopts[i].telopt>-1;i++) {
		telnet_negotiate(gc->game_telnet,telopts[i].us,telopts[i].telopt);
	}
	*/

	return(gc->game_telnet);
}

void loci_telnet_free(game_conn_t *gc) {
	if(gc && gc->game_telnet) {
		telnet_free(gc->game_telnet);
		gc->game_telnet = NULL;
	}
}

/* ---- GMCP proxy related stuff. ---- */

void loci_client_gmcp_will(proxy_conn_t *pc) {
	char module[]="Core.Enable";
	loci_client_send_cmd(pc,GMCP_DATA,module,strlen(module));
}

void loci_client_gmcp_wont(proxy_conn_t *pc) {
	char module[]="Core.Disable";
	loci_client_send_cmd(pc,GMCP_DATA,module,strlen(module));
}

void loci_telnet_send_gmcp(telnet_t *telnet, const char *buffer, size_t size) {
	telnet_begin_sb(telnet,TELNET_TELOPT_GMCP);
	telnet_send(telnet,buffer,size);
	telnet_finish_sb(telnet);
	locid_debug(DEBUG_TELNET,NULL,"sent gmcp message (%ld bytes)",size);
}

/* process a libtelnet mssp block into json object */
json_object *mssp_to_json(struct mssp_t *mssp) {
	
	json_object *blob;

	blob = json_object_new_object();

	for(int i=0;i<(mssp->size);i++) {
		struct telnet_environ_t *t = &(mssp->values[i]);
		/* I don't think I should have to do this check, but ansalon.net:8679
		 * crashes the code for some reason. */
		if(t->var && t->value) {
			locid_debug(DEBUG_MSSP,NULL,"%d: '%s' = '%s'",
				i,
				t->var,
				t->value
			);
			/* to hell with handling MSSP array type for now. */
			/* to hell with inferring MSSP types for now. */
			json_object_object_add(blob,t->var,json_object_new_string(t->value));
		}
	}
	locid_debug(DEBUG_MSSP,NULL,"%s",json_object_to_json_string(blob));
	return(blob);
}

int set_echosga(int state, int telopt, int yesno) {

	int newstate = state;

	switch (telopt) {
	case TELNET_TELOPT_ECHO:
		newstate = ( (state & 0x2) | (yesno & 0x1) );
		break;
	case TELNET_TELOPT_SGA:
		newstate = ( (state & 0x1) | (yesno & 0x2) );
		break;
	default:
		break;
	}

	return(newstate);
}

/* return pointer to a printable name for a telnet option. */
const char *telopt_name(uint8_t option) {

	static char buf[16];

	if (TELOPT_OK(option)) {
		return (telopts[option]);
	}
	switch (option) {
	case TELNET_TELOPT_GMCP:	return ("GMCP");
	case TELNET_TELOPT_CHARSET: return ("CHARSET");
	case TELNET_TELOPT_MSSP:	return ("MSSP");
	case TELNET_TELOPT_MCCP3:	return ("MCCP3");
	case TELNET_TELOPT_MCCP2:	return ("MCCP2");
	case TELNET_TELOPT_COMPRESS:return ("MCCP1");
	case TELNET_TELOPT_MSDP:	return ("MSDP");
	case TELNET_TELOPT_MSP:		return ("MSP");
	case TELNET_TELOPT_MXP:		return ("MXP");
	case TELNET_TELOPT_ATCP:	return ("ATCP");
	case TELNET_TELOPT_ZMP:		return ("ZMP");
	case TELNET_TELOPT_MUSHCLIENT:		return ("AARDWOLF MUSHCLIENT");
	case TELNET_TELOPT_MCCPX:		return ("MCCPX");
	default:
		break;
	}

	snprintf(buf,sizeof(buf),"UNKNOWN-%d", option);
	return (buf);

}

