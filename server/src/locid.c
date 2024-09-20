/* locid.c - LociTerm main entry and config parsing */
/* Created: Wed Apr 27 11:11:03 AM EDT 2022 malakai */
/* $Id: locid.c,v 1.17 2024/09/20 17:08:29 malakai Exp $ */

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


#include <getopt.h>
#include <glib.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <signal.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <libwebsockets.h>
#include <sys/wait.h>

#include "libtelnet.h"

#include "debug.h"
#include "proxy.h"
#include "client.h"
#include "game.h"
#include "gamedb.h"

#include "locid.h"

#ifndef CONFIG_FILE
#define CONFIG_FILE "/etc/locid.conf"
#endif

static int interrupted;
struct locid_conf *config;

static const lws_retry_bo_t retry = {
	.secs_since_valid_ping = 3,
	.secs_since_valid_hangup = 10,
};

static struct lws_protocols protocols[] = {
	{ "http", lws_callback_http_dummy, 0, 0, 0, NULL, 0 },
	{ "loci-client", callback_loci_client, 0, 1024, 0, NULL, 0 },
	{ "loci-game", callback_loci_game, 0, 1024, 0, NULL, 0 },
	LWS_PROTOCOL_LIST_TERM
};

void sigint_handler(int sig)
{
	interrupted = 1;
}

void sigchld_handler(int sig) {
	while (waitpid((pid_t) (-1), 0, WNOHANG) > 0) {}
}

void launch_web_browser(struct locid_conf *config) {

	int child=0;
	int clientssl=0;
	char url[1024];
	char err[1024];

	if( !(strcmp(config->client_security ,"ssl") )) {
		clientssl = 1;
	}

	g_snprintf(url,sizeof(url),"%s://localhost:%d",
		(clientssl==1)?"https":"http",
		config->listening_port
	);

	locid_log("Running %s %s .",config->client_launcher,url);

	signal(SIGCHLD, sigchld_handler);

	if( (child=fork()) == 0) {
		/* I am the child. */
		usleep(500000);  /* take a short nap... */
		if( (execlp(config->client_launcher,config->client_launcher,url,(char*)NULL) == -1) ) {
			g_snprintf(err,sizeof(err),"Couldn't exec '%s %s'",config->client_launcher,url);
			perror(err);
			exit(errno);
		}
	}
}

char *get_proxy_name(void) {
	char buf[8192];
	sprintf(buf,"%s-%s",
		LOCID_SHORTNAME,
		LOCITERM_VERSION
	);
	return(strdup(buf));
}

/* keyfile parsing simplified. */
char *get_conf_string(GKeyFile * gkf, gchar * group, gchar * key, gchar * def) {
	gchar *gs = NULL;

	if ((gs = g_key_file_get_string(gkf, group, key, NULL))) {
		return (gs);
	} else {
		return (strdup(def));
	}
}

/* keyfile parsing simplified. */
int get_conf_int(GKeyFile * gkf, gchar * group, gchar * key, int def) {
	gint gs;
	GError *error = NULL;

	gs = g_key_file_get_integer(gkf, group, key, &error);
	if (error == NULL) {
		return (gs);
	} else {
		return (def);
	}
}

/* keyfile parsing simplified. */
int get_conf_boolean(GKeyFile * gkf, gchar * group, gchar * key, int def) {
	gint gs;
	GError *error = NULL;

	gs = g_key_file_get_boolean(gkf, group, key, &error);
	if (error == NULL) {
		return (gs);
	} else {
		return (def);
	}

}

struct locid_conf *new_config(char *filename) {
	struct locid_conf *c;
	GKeyFile *gkf;
	struct servent *srv;
	char *tmpstr;

	c = (struct locid_conf *)malloc(sizeof(struct locid_conf));

	gkf = g_key_file_new();

	if(!g_key_file_load_from_file(gkf,filename,G_KEY_FILE_NONE,NULL)){
		fprintf(stderr,"Couldn't read config file %s\n",CONFIG_FILE);
	}

	/* set config file variables */
	c->client_service = get_conf_string(gkf,"client","service","4005");
	c->listening_port = 4005;
	if ( !(c->listening_port = atoi(c->client_service)) ) {
		if( (srv = getservbyname(c->client_service,"tcp")) ) {
			c->listening_port = ntohs(srv->s_port);
		} else {
			c->listening_port = 4005;
		}
	}

	c->log_file = g_key_file_get_string(gkf, "locid", "log-file", NULL);
	c->vhost_name = get_conf_string(gkf, "locid", "vhost_name", "localhost");
	c->mountpoint = get_conf_string(gkf, "locid", "mountpoint", "/");
	c->origin = get_conf_string(gkf, "locid", "origin", "/var/www/loci");  /* shrug */
	c->default_doc = get_conf_string(gkf, "locid", "default_doc", "index.html");

	c->client_security = get_conf_string(gkf,"client","security","none");
	c->client_launcher = get_conf_string(gkf,"client","launcher","xdg-open");

	c->game_usessl = 0;
	c->game_security = get_conf_string(gkf,"game","security","none");
	if(!strcasecmp("ssl",c->game_security)) {
		c->game_usessl = 1;
	}
	c->game_host = get_conf_string(gkf,"game","host","::");
	c->game_service = get_conf_string(gkf,"game","service","4000");
	if ( !(c->game_port = atoi(c->game_service)) ) {
		if( (srv = getservbyname(c->game_service,"tcp")) ) {
			c->game_port = ntohs(srv->s_port);
		} else {
			c->game_port = 4000;
		}
	}
	c->game_name = get_conf_string(gkf,"game","name","Default Game");

	c->cert_file = get_conf_string(gkf,"ssl","cert","cert.pem");
	c->key_file = get_conf_string(gkf,"ssl","key","key.pem");
	c->chain_file = get_conf_string(gkf,"ssl","chain","");
	c->locid_proxy_name = get_proxy_name();

	c->db_engine = get_conf_string(gkf, "game-db", "engine", "sqlite3");
	c->db_location = get_conf_string(gkf, "game-db", "location", "locid.db");

	tmpstr = get_conf_string(gkf, "game-db", "suggestions", "open");
	if (!strcasecmp(tmpstr,"open")) {
		c->db_suggestions = DBSTATUS_APPROVED;
	} else if (!strcasecmp(tmpstr,"queued")) {
		c->db_suggestions = DBSTATUS_NOT_CHECKED;
	} else {
		c->db_suggestions = DBSTATUS_BANNED;
	}
	free(tmpstr);

	tmpstr = get_conf_string(gkf, "game-db", "min_protocol", "mud");
	if (!strcasecmp(tmpstr,"mssp")) {
		c->db_min_protocol = CHECK_MSSP;
	} else if (!strcasecmp(tmpstr,"mud")) {
		c->db_min_protocol = CHECK_MUD;
	} else if (!strcasecmp(tmpstr,"telnet")) {
		c->db_min_protocol = CHECK_TELNET;
	} else if (!strcasecmp(tmpstr,"none")) {
		c->db_min_protocol = 0;
	} else {
		/* make an unknown value default to CHECK MUD */
		c->db_suggestions = CHECK_MUD;
	}
	free(tmpstr);

	c->db_banned_ports = NULL;
	tmpstr = get_conf_string(gkf, "game-db", "banned_ports", 
		"7,9,19,20,21,22,25,26,80,110,143,465"
	);
	int bport;
	char *d = tmpstr;
	while(d && sscanf(d,"%d",&bport) ) {
		int *lport = (int*)malloc(1*sizeof(int));
		*lport = bport;
		c->db_banned_ports = g_list_append(c->db_banned_ports,lport);
		if( (d=strchr(d,','))) d++;
	}
	free(tmpstr);

	g_key_file_free(gkf);
	return(c);
}

void free_config(struct locid_conf *c) {

	if(!c) return;

	if(c->log_file) free(c->log_file);
	if(c->vhost_name) free(c->vhost_name);
	if(c->mountpoint) free(c->mountpoint);
	if(c->origin) free(c->origin);
	if(c->default_doc) free(c->default_doc);
	if(c->client_security) free(c->client_security);
	if(c->client_service) free(c->client_service);
	if(c->client_launcher) free(c->client_launcher);
	if(c->game_security) free(c->game_security);
	if(c->game_host) free(c->game_host);
	if(c->game_service) free(c->game_service);
	if(c->game_name) free(c->game_name);
	if(c->cert_file) free(c->cert_file);
	if(c->key_file) free(c->key_file);
	if(c->chain_file) free(c->chain_file);
	if(c->locid_proxy_name) free(c->locid_proxy_name);
	if(c->db_engine) free(c->db_engine);
	if(c->db_location) free(c->db_location);
	if(c->db_banned_ports) {
		g_list_free_full(c->db_banned_ports,free);
	}

	free(c);
}



int main(int argc, char **argv) {

	/* local variables. */
	char *configfilename = NULL;
	int debug = 0;
	int localmode = 0;
	int listmode = -1;
	int dbupdate_id = -1;
	game_db_status_t dbupdate_status = DBSTATUS_NOT_CHECKED;
	struct lws_context_creation_info info;
	struct lws_context *context;
	struct lws_http_mount *mount;
	char *s;
	char buf[1024];
	sigset_t mask;

	static const struct lws_protocol_vhost_options pvo_mime = {
		NULL,				/* "next" pvo linked-list */
		NULL,				/* "child" pvo linked-list */
		".mp3",				/* file suffix to match */
		"audio/mpeg"		/* mimetype to use */
	};

	/* ...and begin. */

	while(1) {
		char *short_options = "hlc:dvalA:B:D:";
		static struct option long_options[] = {
			{"help", no_argument,0,'h'},
			{"browser", no_argument,0,'b'},
			{"version", no_argument,0,'v'},
			{"config",required_argument,0,'c'},
			{"debug", no_argument,0,'d'},
			{"version", no_argument,0,'v'},
			{"list-approved", no_argument,0,'a'},
			{"list-denied", no_argument,0,'l'},
			{"approve", required_argument,0,'A'},
			{"ban", required_argument,0,'B'},
			{"delete", required_argument,0,'D'},
			{NULL,no_argument,NULL,0}
		};
		int option_index = 0;
		int opt = getopt_long(argc,argv,short_options,long_options,&option_index);
		if(opt == -1) break;
		switch (opt) {
			case 'c':
				configfilename = optarg;
				break;
			case 'd':
				debug = 1;
				break;
			case 'b':
				localmode = 1;
				break;
			case 'v':
				s = get_proxy_name();
				fprintf(stdout,"%s\n",s);
				free(s);
				exit(EXIT_SUCCESS);
			case 'a':
				listmode = 1;
				break;
			case 'l':
				listmode = 0;
				break;
			case 'A':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_APPROVED;
				break;
			case 'B':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_BANNED;
				break;
			case 'D':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_NULL;
				break;
			case 'h':
			default:
				fprintf(stdout,"Usage: %s [options]\n",argv[0]);
				fprintf(stdout,"\t-c / --config        specify location of config file\n");
				fprintf(stdout,"\t-d / --debug         run in debug mode\n");
				fprintf(stdout,"\t-h / --help          this message\n");
				fprintf(stdout,"\t-l / --launch        launch a browser\n");
				fprintf(stdout,"\t-v / --version       show the version\n");
				fprintf(stdout,"\t-a / --list-approved list approved games by id\n");
				fprintf(stdout,"\t-l / --list-denied   list denied games by id\n");
				fprintf(stdout,"\t-A / --approve <id>  Mark game approved\n");
				fprintf(stdout,"\t-B / --ban <id>      Mark game banned\n");
				fprintf(stdout,"\t-D / --delete <id>   Remove game from DB\n");
				exit(EXIT_SUCCESS);
		}
	}

	/* begin websocket init */
	if(debug) {
		//int lwslogs = LLL_USER | LLL_ERR | LLL_WARN | LLL_NOTICE | LLL_CLIENT | LLL_HEADER | LLL_INFO | LLL_DEBUG;
		// enable lws library debug messages.
		//int lwslogs = LLL_USER | LLL_ERR | LLL_WARN | LLL_NOTICE;
		int lwslogs = LLL_ERR | LLL_WARN;
		lws_set_log_level(lwslogs, (lws_log_emit_t)locid_log_lws);

		// enable locid debug messages.  See debug.h for value of DEBUG_ON
		global_debug_facility = DEBUG_ON;
	} else {
		int lwslogs = LLL_ERR | LLL_WARN;
		lws_set_log_level(lwslogs, (lws_log_emit_t)locid_log_lws);
	}

	if(configfilename == NULL) {
		configfilename = CONFIG_FILE;
	}

	config = new_config(configfilename);
	locid_log_init(config->log_file);

	/* init the database. */
	if(strcasecmp(config->db_engine,"none")) {
		config->db_inuse = 1;
	} else {
		config->db_inuse = 0;
	}

	if(listmode != -1) {
		game_db_list(listmode);
		exit(EXIT_SUCCESS);
	}

	if( dbupdate_id > 0) {
		game_db_update(dbupdate_id,dbupdate_status);
		exit(EXIT_SUCCESS);
	}

	locid_log("Starting %s", config->locid_proxy_name);
	locid_log("Loaded config file %s", configfilename);
	locid_log("Mountpoint is %s", config->mountpoint);
	locid_log("Default game is %s %d security %s", 
		config->game_host, config->game_port,
		config->game_security
	);

	if(config->db_inuse == 1) {
		locid_log("Using %s database",config->db_engine);
		if ( (game_db_init(config->db_location) == -1) ) {
			locid_log("Unable to open game-db location '%s'.",config->db_location);
			exit(EXIT_FAILURE);
		}
		locid_log("Banned port list contains %d ports.",g_list_length(config->db_banned_ports));
	}

	config->client_localmode = localmode;


	/* init the mountpoint struct for lws's built in http server. */
	mount = (struct lws_http_mount *)malloc(sizeof(struct lws_http_mount));
	memset(mount, 0, sizeof *mount); /* otherwise uninitialized garbage */
	mount->mountpoint = config->mountpoint;
	mount->mountpoint_len = strlen(config->mountpoint);
	mount->origin = config->origin;
	mount->origin_protocol = LWSMPRO_FILE;
	mount->def = config->default_doc;
	mount->extra_mimetypes = &pvo_mime;
	mount->cache_max_age = 604800;
	mount->cache_reusable = 1;
	mount->cache_revalidate = 1;
	mount->cache_intermediaries = 1;
	/* this does NOT mean 'do not cache', it means revalidate first. */
	mount->cache_no = 1;  

	/* Enable permessage deflate extension */
	static const struct lws_extension extensions[] = {
		{
			"permessage-deflate",
			lws_extension_callback_pm_deflate,
			"permessage-deflate"
			 "; client_no_context_takeover"
			 "; client_max_window_bits"
		},
		{ NULL, NULL, NULL /* terminator */ }
	};

	/* init the info struct for lws's context. */
	memset(&info, 0, sizeof info); /* otherwise uninitialized garbage */
	if(config->client_localmode == 1) {
		info.iface = "lo"; /* local interface only. */
	}
	info.port = config->listening_port;
	info.mounts = mount;
	info.protocols = protocols;
	info.vhost_name = config->vhost_name;
	//info.options = LWS_SERVER_OPTION_HTTP_HEADERS_SECURITY_BEST_PRACTICES_ENFORCE;
	info.options |= LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;

	if (!strcasecmp(config->client_security,"ssl")) {
		locid_log("Client side using TLS\n");
		info.ssl_cert_filepath = config->cert_file;
		info.ssl_private_key_filepath = config->key_file;
	}

	/* could make this configurable later. */
	info.retry_and_idle_policy = &retry;
	/* Enable permessage deflate extension */
	info.extensions = extensions;


	context = lws_create_context(&info);
	if (!context) {
		locid_log("LWS init failed!\n");
		return 1;
	}

	locid_log("LociTerm server listening on port %d.", 
		config->listening_port
	);

	/* turn on the signal handler. */
	sigemptyset(&mask);
	sigaddset(&mask,SIGPIPE);
	sigprocmask(SIG_SETMASK,&mask,NULL);
	signal(SIGINT, sigint_handler);

	if(config->client_localmode == 1) {
		launch_web_browser(config);
	}

	/* end websocket init */

	/* Keep on giving good service... Its all event driven from here. */
	int retcode = 0;
	while (retcode >= 0 && !interrupted) {
		//locid_debug(DEBUG_LWS,NULL,"Boop.");
		retcode = lws_service(context, 0);
	}

	/* exit and cleanup */
	lws_context_destroy(context);
	free_proxyconns();
	if(mount) free(mount);
	free_config(config);
	locid_log("Shutdown complete.");
}
