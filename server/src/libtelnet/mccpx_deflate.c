/*
 * mccpx/deflate.c - 'deflate' compression functions for libtelnet mccpx
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

#include <zlib.h>

/* "deflate" compression functions. */
mccpx_init_fn_t mccpx_deflate_init;
mccpx_send_fn_t mccpx_deflate_send;
mccpx_recv_fn_t mccpx_deflate_recv;
mccpx_free_fn_t mccpx_deflate_free;
mccpx_compression_t mccpx_deflate = {
	.name = "deflate",
	.init = mccpx_deflate_init,
	.send = mccpx_deflate_send,
	.recv = mccpx_deflate_recv,
	.free = mccpx_deflate_free
};

/* -- MCCPX "deflate" encoding BEGIN.  */
/* MCCPX "deflate" init. */
telnet_error_t mccpx_deflate_init(telnet_t *telnet, mccpx_stream_t *stream) {
	z_stream *z;
	int rs;
	int err_fatal = 1;

	/* if MMCP123 compression is already enabled, fail loudly */
	if (telnet->z != 0)
		return _error(telnet, __LINE__, __func__, TELNET_EBADVAL,
				err_fatal, "cannot initialize MCCPX while MCCP123 is active.");

	if(stream->ctx != NULL) 
		return _error(telnet, __LINE__, __func__, TELNET_EBADVAL,
				err_fatal, "cannot initialize MCCP4 twice.");

	/* allocate zstream box */
	if ((z = (z_stream *)calloc(1, sizeof(z_stream))) == 0)
		return _error(telnet, __LINE__, __func__, TELNET_ENOMEM, err_fatal,
				"malloc() failed: %s", strerror(errno));

	if(stream->direction == STREAM_SEND) {
		if ((rs = deflateInit(z, Z_DEFAULT_COMPRESSION)) != Z_OK) {
			free(z);
			return _error(telnet, __LINE__, __func__, TELNET_ECOMPRESS,
					err_fatal, "deflateInit() failed: %s", zError(rs));
		}
	} else {
		if ((rs = inflateInit(z)) != Z_OK) {
			free(z);
			return _error(telnet, __LINE__, __func__, TELNET_ECOMPRESS,
					err_fatal, "inflateInit() failed: %s", zError(rs));
		}
	}
	stream->ctx = z;

	return TELNET_EOK;
}

/* MCCPX "deflate" send. */
/* all deflate encoding does is send the data.*/
telnet_error_t mccpx_deflate_send( telnet_t *telnet, mccpx_stream_t *stream, const char *buffer, size_t size) {

	char deflate_buffer[1024];
	int rs;
	z_stream *z = stream->ctx;

	/* initialize z state */
	z->next_in = (unsigned char *)buffer;
	z->avail_in = (unsigned int)size;
	z->next_out = (unsigned char *)deflate_buffer;
	z->avail_out = sizeof(deflate_buffer);

	/* deflate until buffer exhausted and all output is produced */
	while (z->avail_in > 0 || z->avail_out == 0) {
		/* compress */
		if ((rs = deflate(z, Z_SYNC_FLUSH)) != Z_OK) {
			_error(telnet, __LINE__, __func__, TELNET_ECOMPRESS, 1,
					"deflate() failed: %s", zError(rs));

			mccpx_end(telnet,stream->direction);
			break;
		}

		/* send event */
		mccpx_compressed_out(telnet,deflate_buffer,(sizeof(deflate_buffer) - z->avail_out));

		/* prepare output buffer for next run */
		z->next_out = (unsigned char *)deflate_buffer;
		z->avail_out = sizeof(deflate_buffer);
	}

	return TELNET_EOK;
}

/* MCCPX "deflate" recv. */
/* all deflate encoding does is route the raw data to _process .*/
telnet_error_t mccpx_deflate_recv( telnet_t *telnet, mccpx_stream_t *stream, const char *buffer, size_t size) {

	z_stream *z = stream->ctx;
	telnet_event_t ev;

	char inflate_buffer[1024];
	int rs;

	/* initialize zlib state */
	z->next_in = (unsigned char*)buffer;
	z->avail_in = (unsigned int)size;
	z->next_out = (unsigned char *)inflate_buffer;
	z->avail_out = sizeof(inflate_buffer);

	/* inflate until buffer exhausted and all output is produced */
	while (z->avail_in > 0 || z->avail_out == 0) {
		/* reset output buffer */

		/* decompress */
		rs = inflate(z, Z_SYNC_FLUSH);

		/* process the decompressed bytes on success */
		if (rs == Z_OK || rs == Z_STREAM_END) {
			mccpx_decompressed_out(telnet,inflate_buffer,(sizeof(inflate_buffer) -z->avail_out));
		} else
			_error(telnet, __LINE__, __func__, TELNET_ECOMPRESS, 1,
					"inflate() failed: %s", zError(rs));

		/* prepare output buffer for next run */
		z->next_out = (unsigned char *)inflate_buffer;
		z->avail_out = sizeof(inflate_buffer);

		/* on error (or on end of stream) disable further inflation */
		if (rs != Z_OK) {
			if(rs == Z_STREAM_END) {
				mccpx_inform_ev(telnet,STREAM_RECV,TELNET_EOK,"Z_STREAM_END");
			} else {
				mccpx_inform_ev(telnet,STREAM_RECV,TELNET_ECOMPRESS,"STREAM ERROR");
			}
			/* disable compression */
			mccpx_end(telnet,stream->direction);

			break;
		}
	}

	return TELNET_EOK;
}

/* MCCPX "deflate" free. */
void mccpx_deflate_free(telnet_t *telnet, mccpx_stream_t *stream) {

	if(stream->ctx == NULL) return;

	z_stream *z = stream->ctx;
	if(stream->direction == STREAM_SEND) {
		deflateEnd(z);
		free(z);
	} else {
		inflateEnd(z);
		free(z);
	}
	stream->ctx = NULL;
}
/* -- MCCPX "deflate" encoding END.  */
