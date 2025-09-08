/*
 * mccpx/none.c - 'none' compression module for libtelnet MCCPX
 *
 * Jeff Jahr
 * <rahjiii@jeffrika.com>
 *
 * The author or authors of this code dedicate any and all copyright interest
 * in this code to the public domain. We make this dedication for the benefit
 * of the public at large and to the detriment of our heirs and successors. We
 * intend this dedication to be an overt act of relinquishment in perpetuity of
 * all present and future rights to this code under copyright law.
 */

/* "none" compression functions. */

mccpx_init_fn_t mccpx_none_init;
mccpx_send_fn_t mccpx_none_send;
mccpx_recv_fn_t mccpx_none_recv;
mccpx_free_fn_t mccpx_none_free;

mccpx_compression_t mccpx_none = {
	.name = "none",
	.init = mccpx_none_init,
	.send = mccpx_none_send,
	.recv = mccpx_none_recv,
	.free = mccpx_none_free
};

/* -- MCCPX "none" encoding BEGIN.  */

/* MCCPX "none" init. */
telnet_error_t mccpx_none_init(telnet_t *telnet, mccpx_stream_t *stream) {
	z_stream *z;
	int rs;
	int err_fatal = 1;

	if(stream->ctx != NULL) 
		return _error(telnet, __LINE__, __func__, TELNET_EBADVAL,
				err_fatal, "cannot initialize MCCP4 twice.");

	/* going to alloc a string here, to test that the free function gets rid of it. */
	if(stream->direction == STREAM_SEND) {
		stream->ctx = strdup("none compression init");
	} else {
		stream->ctx = strdup("none decompression init");
	}

	return TELNET_EOK;
}

/* MCCPX "none" send. */
/* all none encoding does is send the data.*/
telnet_error_t mccpx_none_send( telnet_t *telnet, mccpx_stream_t *stream, const char *buffer, size_t size) {
	mccpx_compressed_out(telnet,buffer,size);
	return TELNET_EOK;
}

/* MCCPX "none" recv. */
/* all none encoding does is route the raw data to _process .*/
telnet_error_t mccpx_none_recv( telnet_t *telnet, mccpx_stream_t *stream, const char *buffer, size_t size) {
	mccpx_decompressed_out(telnet,buffer,size);
	return TELNET_EOK;
}

/* MCCPX "none" free. */
void mccpx_none_free(telnet_t *telnet, mccpx_stream_t *stream) {

	if(stream->ctx == NULL) return;
	/* going to de-alloc a string here, to test that the free function gets rid of it. */
	if(stream->direction == STREAM_SEND) {
		free(stream->ctx);
	} else {
		free(stream->ctx);
	}
	stream->ctx = NULL;
}

/* -- MCCPX "none" encoding END.  */
