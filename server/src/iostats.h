/* iostats.h - per connection io statistics */
/* Created: Fri Feb 16 11:16:41 AM EST 2024 malakai */
/* Copyright © 1991-2024 The Last Outpost Project */
/* $Id: iostats.h,v 1.1 2024/09/19 17:03:30 malakai Exp $ */

#ifndef LO_IOSTATS_H
#define LO_IOSTATS_H

/* global #defines */

/* structs and typedefs */

struct iostat_counter {
	struct timeval ts;
	long int in;
	long int out;
};

struct iostat_data {
	struct iostat_counter lifetime;
	struct iostat_counter checkpoint;
	struct iostat_counter rate;
};

/* exported global variable declarations */

/* exported function declarations */
struct iostat_data *iostat_new(void);
void iostat_free(struct iostat_data *ios);
void iostat_init(struct iostat_data *ios);
void iostat_incr(struct iostat_data *ios,int in, int out);
int iostat_printraw(char *buf, size_t len, struct iostat_data *ios);
int iostat_printhuman(char *buf, size_t len, struct iostat_data *ios);
int iostat_printhrate(char *buf, size_t len, struct iostat_data *ios);
void iostat_checkpoint(struct iostat_data *ios,double weight);

#endif /* LO_IOSTATS_H */
