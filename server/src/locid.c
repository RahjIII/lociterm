/* locid.c - LociTerm main entry and config parsing */
/* Created: Wed Apr 27 11:11:03 AM EDT 2022 malakai */
/* $Id: locid.c,v 1.26 2024/11/30 16:46:52 malakai Exp $ */

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
#include <uv.h>

#include "libtelnet.h"

#include "debug.h"
#include "proxy.h"
#include "client.h"
#include "game.h"
#include "gamedb.h"
#include "scan.h"

#include "locid.h"

#ifndef CONFIG_FILE
#define CONFIG_FILE "/etc/locid.conf"
#endif

static int interrupted;
struct locid_conf *config;
static	struct lws_context *locid_default_lws_context;

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

struct lws_protocol_vhost_options *extra_mimetypes(void);
void free_extra_mimetypes(struct lws_protocol_vhost_options *f);

void sigint_handler(int sig) {
	uv_stop(uv_default_loop());
	interrupted = 1;
}

void sigchld_handler(int sig) {
	while (waitpid((pid_t) (-1), 0, WNOHANG) > 0) {}
}

/* a libuv signal handler callback */
void signal_callback(uv_signal_t *watcher, int sig) {
	switch(sig) {
		case SIGINT:
			sigint_handler(sig);
			break;
		case SIGCHLD:
			sigchld_handler(sig);
			break;
		case SIGUSR1:
		case SIGUSR2:
		case SIGHUP:
			loci_proxy_log_status();
			break;
		default:
			break;
	}
}

void signal_callback_lws(void *handle, int sig) {
	signal_callback(handle,sig);
}

void signals_init(uv_loop_t *uvloop) {
	static uv_signal_t sigint_h;
	uv_signal_init(uvloop, &sigint_h);
	uv_signal_start(&sigint_h, signal_callback, SIGINT);

	static uv_signal_t sighup_h;
	uv_signal_init(uvloop, &sighup_h);
	uv_signal_start(&sighup_h, signal_callback, SIGHUP);

	static uv_signal_t sigchld_h;
	uv_signal_init(uvloop, &sigchld_h);
	uv_signal_start(&sigchld_h, signal_callback, SIGCHLD);

	static uv_signal_t sigusr1_h;
	uv_signal_init(uvloop, &sigusr1_h);
	uv_signal_start(&sigusr1_h, signal_callback, SIGUSR1);

	return;
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

	/* signal(SIGCHLD, sigchld_handler); */

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
		fprintf(stderr,"Ooops! Can't read config file '%s'\n",filename);
		return(NULL);
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
	c->origin = get_conf_string(gkf, "locid", "origin", ""); 
	if( !strcmp(c->origin,"") ) {
		fprintf(stderr,"Ooops! Can't find '[locid] origin' in '%s'.\n",filename);
		free(c);
		g_key_file_free(gkf);
		return(NULL);
	}

	c->default_doc = get_conf_string(gkf, "locid", "default_doc", "index.html");

	c->locid_debugflags = g_key_file_get_string_list (
		gkf, "locid", "debug", NULL, NULL
	);
	if(c->locid_debugflags == NULL) {
		g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
		g_strv_builder_add (builder, "log");
		c->locid_debugflags = g_strv_builder_end (builder);
	}
	set_debug_from_strvec(c->locid_debugflags);

	c->client_security = get_conf_string(gkf,"client","security","none");
	c->client_launcher = get_conf_string(gkf,"client","launcher","xdg-open");

	c->game_usessl = 0;
	c->game_security = get_conf_string(gkf,"game","security","none");
	if(!strcasecmp("ssl",c->game_security)) {
		c->game_usessl = 1;
	}
	c->game_host = get_conf_string(gkf,"game","host","localhost");
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

	/* c->db_engine = get_conf_string(gkf, "game-db", "engine", "sqlite3"); */
	c->db_engine = get_conf_string(gkf, "game-db", "engine", "none");
	c->db_location = get_conf_string(gkf, "game-db", "location", "locid.db");

	tmpstr = get_conf_string(gkf, "game-db", "suggestions", "open");
	if (!strcasecmp(tmpstr,"open")) {
		c->db_suggestions = DBSTATUS_APPROVED;
	} else if (!strcasecmp(tmpstr,"queued")) {
		c->db_suggestions = DBSTATUS_NO_ANSWER; /* no answer until an admin allows it. */
	} else {
		c->db_suggestions = DBSTATUS_BANNED;
	}
	free(tmpstr);

	/*tmpstr = get_conf_string(gkf, "game-db", "min_protocol", "mud"); */
	tmpstr = get_conf_string(gkf, "game-db", "min_protocol", "none");
	if (!strcasecmp(tmpstr,"mssp")) {
		c->db_min_protocol = CHECK_MSSP;
	} else if (!strcasecmp(tmpstr,"mud")) {
		c->db_min_protocol = CHECK_MUD;
	} else if (!strcasecmp(tmpstr,"telnet")) {
		c->db_min_protocol = CHECK_TELNET;
	} else if (!strcasecmp(tmpstr,"none")) {
		c->db_min_protocol = 0;
	} else {
		/* make an unknown value default to CHECK TELNET */
		c->db_min_protocol = CHECK_TELNET;
	}
	free(tmpstr);

	tmpstr = get_conf_string(gkf, "game-db", "allow_numeric_ip", "no");
	if (!strcasecmp(tmpstr,"yes")) {
		c->db_allow_numeric_ip = 1;
	} else {
		c->db_allow_numeric_ip = 0;
	}

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

	c->mssp_crawl_delay = atoi(get_conf_string(gkf,"mssp","crawl_delay","0"));
	c->mssp_recently_updated = atoi(get_conf_string(gkf,"mssp","recently_updated","168"));

	c->mssp_notable_fields = g_key_file_get_string_list (
		gkf, "mssp", "notable_fields", NULL, NULL
	);
	if(c->mssp_notable_fields == NULL) {
		g_autoptr(GStrvBuilder) builder = g_strv_builder_new ();
		g_strv_builder_add (builder, "CODEBASE");
		g_strv_builder_add (builder, "DISCORD");
		g_strv_builder_add (builder, "WEBSITE");
		g_strv_builder_add (builder, "ICON");
		g_strv_builder_add (builder, "CONTACT");
		g_strv_builder_add (builder, "STATUS");
		c->mssp_notable_fields = g_strv_builder_end (builder);
	}

	c->scan_enabled = get_conf_boolean(gkf,"scan","enabled",0);
	c->scan_dry_run = get_conf_boolean(gkf,"scan","dry_run",0);
	c->scan_check_interval = get_conf_int(gkf,"scan","check_interval",15);
	c->scan_expired = get_conf_int(gkf,"scan","expired",23);
	c->scan_down = get_conf_int(gkf,"scan","down",168);
	c->scan_batch_size = get_conf_int(gkf,"scan","batch_size",5);
	c->scan_batch_delay = get_conf_int(gkf,"scan","batch_delay",10);

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
	if(c->locid_debugflags) {
		g_strfreev(c->locid_debugflags);
	}
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
	if(c->mssp_notable_fields) {
		g_strfreev(c->mssp_notable_fields);
	}

	free(c);
}



int main(int argc, char **argv) {

	/* local variables. */
	char *configfilename = NULL;
	int debug = 0;
	int localmode = 0;
	int listmode = -1;
	int listscan = 0;
	int listinfo = -1;
	int dbinfo_id = 0;
	int dbupdate_id = -1;
	game_db_status_t dbupdate_status = DBSTATUS_NOT_CHECKED;
	struct lws_context_creation_info info;
	struct lws_context *context;
	struct lws_http_mount *mount;
	char *s;
	char buf[1024];
	sigset_t mask;
	char filename[PATH_MAX];

	/* ...and begin. */

	while(1) {
		char *short_options = "hbc:dvalsA:B:R:D:i:";
		static struct option long_options[] = {
			{"help", no_argument,0,'h'},
			{"browser", no_argument,0,'b'},
			{"version", no_argument,0,'v'},
			{"config",required_argument,0,'c'},
			{"debug", no_argument,0,'d'},
			{"version", no_argument,0,'v'},
			{"list-approved", no_argument,0,'a'},
			{"list-denied", no_argument,0,'l'},
			{"list-scan", no_argument,0,'s'},
			{"approve", required_argument,0,'A'},
			{"ban", required_argument,0,'B'},
			{"redact", required_argument,0,'R'},
			{"delete", required_argument,0,'D'},
			{"info", required_argument,0,'i'},
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
			case 's':
				listscan = 1;
				break;
			case 'A':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_APPROVED;
				break;
			case 'B':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_BANNED;
				break;
			case 'R':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_REDACTED;
				break;
			case 'D':
				dbupdate_id = atoi(optarg);
				dbupdate_status = DBSTATUS_NULL;
				break;
			case 'i':
				listinfo = 1;
				dbinfo_id = atoi(optarg);
				break;
			case 'h':
			default:
				fprintf(stdout,"Usage: %s [options]\n",argv[0]);
				fprintf(stdout,"\t-c / --config        specify location of config file\n");
				fprintf(stdout,"\t-d / --debug         run in debug mode\n");
				fprintf(stdout,"\t-h / --help          this message\n");
				fprintf(stdout,"\t-b / --browser       launch a browser\n");
				fprintf(stdout,"\t-v / --version       show the version\n");
				fprintf(stdout,"\t-a / --list-approved list approved games by id\n");
				fprintf(stdout,"\t-l / --list-denied   list denied games by id\n");
				fprintf(stdout,"\t-s / --list-scan     list scaned down games by id\n");
				fprintf(stdout,"\t-i / --info          show game info for id\n");
				fprintf(stdout,"\t-A / --approve <id>  Mark game approved\n");
				fprintf(stdout,"\t-R / --redact <id>   Mark game approved/redacted\n");
				fprintf(stdout,"\t-B / --ban <id>      Mark game banned\n");
				fprintf(stdout,"\t-D / --delete <id>   Remove game from DB\n");
				exit(EXIT_SUCCESS);
		}
	}

	/* begin init */
	/* there was no config provided on the command line?  */
	if(configfilename == NULL) {
		/* check if a ~/.locid.conf exists.*/
		const gchar *homedir;
		if( (homedir = g_get_home_dir()) ) {
			g_snprintf(filename,sizeof(filename),"%s/.locid.conf",homedir);
			FILE *t;
			if((t = fopen(filename,"r"))) {
				/* ~/.locid.conf exists! */
				configfilename = filename;
				fclose(t);
			} else {
				/* try the one in CONFIG_FILE. */
				configfilename = CONFIG_FILE;
			}
		}
	}

	if (! (config = new_config(configfilename)) ) {
		exit(EXIT_FAILURE);
	}

	int lwslogs = LLL_ERR | LLL_WARN;
	if(debug) {
		// enable lws library debug messages if DEBUG_LWS is enabled.
		if(global_debug_facility & DEBUG_LWS) {
			lwslogs |= LLL_USER;
			lwslogs |= LLL_NOTICE | LLL_CLIENT | LLL_HEADER;
			lwslogs |= LLL_INFO | LLL_DEBUG;
		}
	} else {
		global_debug_facility = DEBUG_OFF;
	}
	lws_set_log_level(lwslogs, (lws_log_emit_t)locid_log_lws);

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

	if(listscan == 1) {
		game_db_list_down();
		exit(EXIT_SUCCESS);
	}

	if(listinfo > 0) {
		game_db_list_info(dbinfo_id);
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
		int dbv = game_db_get_version();
		if(dbv != database_version) {
			locid_log("The game-db '%s' is an incompatible version.  See the docs for how to upgrade from version %d to version %d.",
				config->db_location,
				dbv,
				database_version
			);
			exit(EXIT_FAILURE);
		}
			
		locid_log("Banned port list contains %d ports.",g_list_length(config->db_banned_ports));

		game_db_update_telopt_names();
		
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
	mount->extra_mimetypes = extra_mimetypes();
	mount->cache_max_age = 86400;
	mount->cache_reusable = 1;
	mount->cache_revalidate = 1;
	mount->cache_intermediaries = 1;
	/* this does NOT mean 'do not cache', it means revalidate first. */
	/* It also doesn't appear to be in libwebsockets v4.3-stable. */
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
#ifdef LOCI_DISABLE_PMD
	locid_log("LWS permessage-deflate extention is DISABLED.\n");
#else
	/* Enable permessage deflate extension */
	info.extensions = extensions;
#endif

	/* will be using a libuv foreign loop */
	uv_loop_t *uvloop = uv_default_loop();
	info.options |= LWS_SERVER_OPTION_LIBUV;
	info.foreign_loops = (void **)&uvloop;

	/* associate the signal handler. */
	info.signal_cb = signal_callback_lws;

	locid_default_lws_context = context = lws_create_context(&info);
	if (!context) {
		locid_log("LWS init failed!\n");
		return 1;
	}

	/* add some signal handlers */
	signals_init(uvloop);

	/* add in the timer for the db scanner. */
	scanner_init(uvloop,config);

	/* end websocket init */
	locid_log("LociTerm server listening on port %d.", 
		config->listening_port
	);

	if(config->client_localmode == 1) {
		launch_web_browser(config);
	}
	
	/* Keep on giving good service... Its all event driven through the libuv
	 * loop from here. uv_run() is supposed to run forever, or until it is
	 * shutdown with a signal. */
	uv_run(uvloop,UV_RUN_DEFAULT);

	/* exit and cleanup */
	lws_context_destroy(context);
	uv_loop_close(uvloop);
	free_proxyconns();
	if(mount) free(mount);
	free_config(config);
	locid_log("Shutdown complete.");
}

struct lws_protocol_vhost_options *extra_mimetypes(void) {

	struct lws_protocol_vhost_options *new = NULL;
	struct lws_protocol_vhost_options *ret = NULL;
	char *mimetype[]= {
		".mp3","audio/mpeg",
		".webp","image/webp",
		NULL,NULL
	};

	for(int i=0;mimetype[i]!=NULL;i=i+2) {
		new = (struct lws_protocol_vhost_options *)malloc(sizeof(struct lws_protocol_vhost_options));
		new->next = ret;
		new->options = NULL;
		new->name = strdup(mimetype[i]);
		new->value = strdup(mimetype[i+1]);
		ret = new;
	};
	return(ret);
}

void free_extra_mimetypes(struct lws_protocol_vhost_options *f) {
	struct lws_protocol_vhost_options *n;
	while(f) {
		n = f->next;
		if(n->name) free(n->name);
		if(n->value) free(n->value);
		free(f);
		f = n;
	}
}

struct lws_context *locid_get_default_lws_context(void) {
	return(locid_default_lws_context);
}
