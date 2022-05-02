/* telnet.h - <comment goes here> */
/* Created: Fri Apr 29 03:01:13 PM EDT 2022 malakai */
/* Copyright © 1991-2022 The Last Outpost Project */
/* $Id: telnet.h,v 1.1 2022/05/02 02:35:25 malakai Exp $ */

#ifndef LO_TELNET_H
#define LO_TELNET_H

/* global #defines */

/* structs and typedefs */

/* exported global variable declarations */


/* exported function declarations */

void free_telopts(telnet_telopt_t *t);
telnet_t *loci_telnet_init(proxy_conn_t *pc);
void loci_telnet_free(proxy_conn_t *pc);
void loci_telnet_send_naws(telnet_t *telnet, int width, int height);
void loci_environment_init(proxy_conn_t *pc);
void loci_environment_free(proxy_conn_t *pc);

#endif /* LO_TELNET_H */
