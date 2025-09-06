/*
 * mccpx/zstd.c - "zstd" compression functions for libtelnet MCCPX
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

#include <zstd.h>

/* "zstd" compression functions. */
mccpx_init_fn_t mccpx_zstd_init;
mccpx_send_fn_t mccpx_zstd_send;
mccpx_recv_fn_t mccpx_zstd_recv;
mccpx_free_fn_t mccpx_zstd_free;

mccpx_compression_t mccpx_zstd = {
	.name = "zstd",
	.init = mccpx_zstd_init,
	.send = mccpx_zstd_send,
	.recv = mccpx_zstd_recv,
	.free = mccpx_zstd_free
};

/* -- MCCPX "zstd" encoding BEGIN.  */
/* MCCPX "zstd" init. */
telnet_error_t mccpx_zstd_init(telnet_t *telnet, mccpx_stream_t *stream) {

	int err_fatal = 1;

	/* if MMCP123 compression is already enabled, fail loudly */
	if (telnet->z != 0)
		return _error(telnet, __LINE__, __func__, TELNET_EBADVAL,
			err_fatal, "cannot initialize MCCPX while MCCP123 is active."
		);

	if(stream->ctx != NULL) 
		return _error(telnet, __LINE__, __func__, TELNET_EBADVAL,
			err_fatal, "cannot initialize MCCP4 twice."
		);
	
	switch (stream->direction) {
		case STREAM_SEND: {

			ZSTD_CCtx* const ctx = ZSTD_createCCtx();
			if(ctx == NULL) {
				return _error(telnet, __LINE__, __func__, TELNET_ECOMPRESS,
					err_fatal, "zstdInit() failed"
				);
			}
			// Set zstd options here.
			// ZSTD_CCtx_setParameter(cctx, ZSTD_c_compressionLevel, cLevel);
			// ZSTD_CCtx_setParameter(cctx, ZSTD_c_checksumFlag, 1);
			stream->ctx = ctx;
			return TELNET_EOK;
		}
		case STREAM_RECV: {
			ZSTD_DCtx* const ctx = ZSTD_createDCtx();
			if(ctx == NULL) {
				return _error(telnet, __LINE__, __func__, TELNET_ECOMPRESS,
					err_fatal, "zstdInit() failed"
				);
			}
			stream->ctx = ctx;
			return TELNET_EOK;
		}
		default: {
			return TELNET_EBADVAL;
		}
	}
}

/* MCCPX "zstd" send. */
/* all zstd encoding does is send the data.*/
telnet_error_t mccpx_zstd_send( telnet_t *telnet, mccpx_stream_t *stream, const char *buffer, size_t size) {

	telnet_event_t ev;

	ZSTD_CCtx* const cctx = stream->ctx;
	size_t const buffOutSize = ZSTD_CStreamOutSize();
	void*  const buffOut = malloc(buffOutSize);

	//ZSTD_EndDirective const mode = ZSTD_e_end;
	//ZSTD_EndDirective const mode = ZSTD_e_continue;
	ZSTD_EndDirective const mode = ZSTD_e_flush;
	ZSTD_inBuffer input = { buffer, size, 0 };
	
	int finished = 0;
	
	do {
		ZSTD_outBuffer output = { buffOut, buffOutSize, 0 };
		size_t const remaining = ZSTD_compressStream2(cctx, &output , &input, mode);
		/* should be an error check here on remaining? */
		if(ZSTD_isError(remaining)) {
			_error(telnet, __LINE__, __func__, TELNET_ECOMPRESS, 1,
				"%s",ZSTD_getErrorName(remaining)
			);
			free(buffOut);
			/* on error */
			mccpx_end(telnet,stream->direction);
			return TELNET_ECOMPRESS;
		}
		
		if(output.pos > 0) {
			mccpx_compressed_out(telnet,buffOut,output.pos);
		}
		finished = (input.pos == input.size);
	} while (!finished);

	if(input.pos != input.size) {
		_error(telnet, __LINE__, __func__, TELNET_ECOMPRESS, 1,
			"zstd failed impossible"
		);
		free(buffOut);
		/* on error */
		mccpx_end(telnet,stream->direction);
		return TELNET_ECOMPRESS;
	}

	free(buffOut);

	return TELNET_EOK;
}

/* MCCPX "zstd" recv. */
/* all zstd encoding does is route the raw data to _process .*/
telnet_error_t mccpx_zstd_recv( telnet_t *telnet, mccpx_stream_t *stream, const char *buffer, size_t size) {

	telnet_event_t ev;

	if(size == 0) {
		return TELNET_EOK;
	}

	ZSTD_DCtx* const dctx = stream->ctx;

	size_t const buffOutSize = ZSTD_DStreamOutSize();
	void*  const buffOut = malloc(buffOutSize);

	size_t const toRead = size;
	size_t lastRet = 0;

	ZSTD_inBuffer input = { buffer, size, 0 };

	while (input.pos < input.size) {

		ZSTD_outBuffer output = { buffOut, buffOutSize, 0 };

		size_t const ret = ZSTD_decompressStream(dctx, &output , &input);
		
		/* error check here? */
		if(ZSTD_isError(ret)) {
			_error(telnet, __LINE__, __func__, TELNET_ECOMPRESS, 1,
				"%s",ZSTD_getErrorName(ret)
			);
			free(buffOut);
			/* on error */
			mccpx_end(telnet,stream->direction);
			return TELNET_ECOMPRESS;
		}

		/* write out the data  */
		if(output.pos != 0) {
			mccpx_decompressed_out(telnet,buffOut,output.pos);
		}
		lastRet = ret;
	}

	free(buffOut);

	if(lastRet == 0) {
		mccpx_end(telnet,stream->direction);
		return TELNET_ECOMPRESS;
	}

	return TELNET_EOK;
}

/* MCCPX "zstd" free. */
void mccpx_zstd_free(telnet_t *telnet, mccpx_stream_t *stream) {

	if(stream->ctx == NULL) return;

	switch (stream->direction) {
		case STREAM_SEND: {
			ZSTD_freeCCtx(stream->ctx);
			break;
		}
		case STREAM_RECV: {
			ZSTD_freeDCtx(stream->ctx);
			break;
		}
		default:
			break;
	}
	stream->ctx = NULL;
}
/* -- MCCPX "zstd" encoding END.  */
