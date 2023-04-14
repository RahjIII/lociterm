/* locid.h - LociTerm main and config */
/* Created: Wed Apr 27 11:11:03 AM EDT 2022 malakai */
/* $Id: locid.h,v 1.13 2023/04/14 17:51:14 malakai Exp $ */

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

#ifndef LO_LOCID_H
#define LO_LOCID_H

/* global #defines */
#define LOCID_SHORTNAME "locid"
#define LOCID_LONGNAME "Last Outpost Client Implementation Demon"

#ifndef LOCID_MAJOR_VER
#define LOCID_MAJOR_VER 1
#endif

#ifndef LOCID_MINOR_VER
#define LOCID_MINOR_VER 9
#endif

/* structs and typedefs */
struct locid_conf {
	int listening_port;
	char *log_file;
	char *vhost_name;
	char *mountpoint;
	char *origin;
	char *default_doc;
	char *client_security;
	char *client_service;
	char *game_security;
	char *game_host;
	char *game_service;
	char *cert_file;
	char *key_file;
	char *chain_file;
	char *locid_proxy_name;
	int game_port;
	int game_usessl;
};

/* exported global variable declarations */
extern struct locid_conf *config;

/* exported function declarations */


#endif /* LO_LOCID_H */
