/* locid.c - LociTerm main entry and config parsing */
/* Created: Wed Apr 27 11:11:03 AM EDT 2022 malakai */
/* $Id: locid.c,v 1.2 2022/05/02 03:18:36 malakai Exp $ */

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
#include <libwebsockets.h>

#include "libtelnet.h"

#include "debug.h"
#include "locilws.h"
#include "client.h"
#include "game.h"

#include "locid.h"

#define CONFIG_FILE "/etc/locid.conf"

char *locid_proxy_name;
static int interrupted;

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

char *get_proxy_name(void) {
	char buf[8192];
	sprintf(buf,"%s-%d.%d",
		LOCID_SHORTNAME,
		LOCID_MAJOR_VER,
		LOCID_MINOR_VER
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
int main(int argc, char **argv) {

	/* local variables. */
	char *configfilename = NULL;
	GKeyFile *gkf;
	int debug = 0;
	struct lws_context_creation_info info;
	struct lws_context *context;
	struct lws_http_mount *mount;

	/* ...and begin. */
	locid_proxy_name = get_proxy_name();

	while(1) {
		char *short_options = "hc:dv";
		static struct option long_options[] = {
			{"help", no_argument,0,'h'},
			{"config",required_argument,0,'c'},
			{"debug", no_argument,0,'d'},
			{"version", no_argument,0,'v'},
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
			case 'v':
				fprintf(stdout,"%s\n",locid_proxy_name);
				exit(EXIT_SUCCESS);
			case 'h':
			default:
				fprintf(stdout,"Usage: %s [options]\n",argv[0]);
				fprintf(stdout,"\t-c / --config   : specify location of config file\n");
				fprintf(stdout,"\t-d / --debug    : run in debug mode\n");
				fprintf(stdout,"\t-h / --help     : this message\n");
				exit(EXIT_SUCCESS);
		}
	}

	if(configfilename == NULL) {
		configfilename = CONFIG_FILE;
	}
	gkf = g_key_file_new();

	if(!g_key_file_load_from_file(gkf,configfilename,G_KEY_FILE_NONE,NULL)){
		fprintf(stderr,"Couldn't read config file %s\n",CONFIG_FILE);
		//exit(EXIT_FAILURE);
	}

	/* config file variables */
	int listening_port = get_conf_int(gkf,"locid","listen",4005);
	char *log_file = g_key_file_get_string(gkf, "locid", "log-file", NULL);
	char *vhost_name = get_conf_string(gkf, "locid", "vhost_name", "localhost");
	char *mountpoint = get_conf_string(gkf, "locid", "mountpoint", "/");
	char *origin = get_conf_string(gkf, "locid", "origin", "/var/www/loci");  /* shrug */
	char *default_doc = get_conf_string(gkf, "locid", "default_doc", "index.html");

	char *client_security = get_conf_string(gkf,"client","security","none");
	
	char *game_security = get_conf_string(gkf,"game","security","none");
	char *game_host = get_conf_string(gkf,"game","host","::");
	char *game_service = get_conf_string(gkf,"game","service","4000");

char *cert_file = get_conf_string(gkf,"ssl","cert","cert.pem");
	char *key_file = get_conf_string(gkf,"ssl","key","key.pem");
	char *chain_file = get_conf_string(gkf,"ssl","chain","");

	locid_log_init(log_file);
	locid_log("Starting %s", locid_proxy_name);
	locid_log("config file is %s", configfilename);
	locid_log("Mountpoint is %s", mountpoint);

	/* begin websocket init */
	// int lwslogs = LLL_USER | LLL_ERR | LLL_WARN | LLL_NOTICE;
	int lwslogs = LLL_ERR | LLL_WARN | LLL_NOTICE;
	lws_set_log_level(lwslogs, (lws_log_emit_t)locid_log_lws);

	/* init the mountpoint struct for lws's built in http server. */
	mount = (struct lws_http_mount *)malloc(sizeof(struct lws_http_mount));
	memset(mount, 0, sizeof *mount); /* otherwise uninitialized garbage */
	mount->mountpoint = mountpoint;
	mount->mountpoint_len = strlen(mountpoint);
	mount->origin = origin;
	mount->origin_protocol = LWSMPRO_FILE;
	mount->def = default_doc;


	/* init the info struct for lws's context. */
	memset(&info, 0, sizeof info); /* otherwise uninitialized garbage */
	info.port = listening_port;
	info.mounts = mount;
	info.protocols = protocols;
	info.vhost_name = vhost_name;
	//info.options = LWS_SERVER_OPTION_HTTP_HEADERS_SECURITY_BEST_PRACTICES_ENFORCE;
#if defined(LWS_WITH_TLS)
	if (!strcmp(client_security,"ssl")) {
		lwsl_user("Client side using TLS\n");
		info.options |= LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
		info.ssl_cert_filepath = cert_file;
		info.ssl_private_key_filepath = key_file;
	}
#endif
	/* could make this configurable later. */
	info.retry_and_idle_policy = &retry;

	context = lws_create_context(&info);
	if (!context) {
		lwsl_err("lws init failed\n");
		return 1;
	}

	/* turn on the signal handler. */
	signal(SIGINT, sigint_handler);

	/* end websocket init */

	/* Keep on giving good service... Its all event driven from here. */
	int retcode = 0;
	while (retcode >= 0 && !interrupted)
		retcode = lws_service(context, 0);

	/* exit and cleanup */
	lws_context_destroy(context);
	locid_log("Shutdown complete.");
}
