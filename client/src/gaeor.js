// gaeor.js - Telnet GA and EOR handler
// Created: Tue Nov 19 09:51:03 PM EST 2024
// $Id: gaeor.js,v 1.3 2024/11/30 16:46:52 malakai Exp $

// Copyright © 2024 Jeff Jahr <malakai@jeffrika.com>
//
// This file is part of LociTerm - Last Outpost Client Implementation Terminal
//
// LociTerm is free software: you can redistribute it and/or modify it under
// the terms of the GNU Lesser General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// LociTerm is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
// more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with LociTerm.  If not, see <https://www.gnu.org/licenses/>.


class GaEorHandler {

	constructor(lociterm) {

		this.lociterm = lociterm;  
		
		// locid can enable client EOR/GA processing based on its EOR protocol
		// negotiation.  It could also be enabled by a preference.
		this.enabled = false; 

		// Set preventDefault to true, and the terminal won't automatically
		// print data as it is streamed in.  Assumption is that the EOR handler
		// will decide what to print based on the buffer, when it is called.
		this.preventDefault = false;

		// This is where the record is buffered up.
		this.buffer = "";
		this.maxBufferSize = Math.pow(2,17); // 128KB is huge.

		/* set these to your favorite functions.  The arguments passed in will
		 * be (this.lociterm, this.buffer). */
		this.onEOR = undefined;
		this.onGA = undefined;
	}

	// Adds bytes to the gaeor buffer as they come in.
	write(str) {
		if( this.enabled === false) {
			// always print to terminal if gaeor processing is not enabled.
			return(false);
		}
		this.buffer += str;
		if(this.buffer.length > this.maxBufferSize) {
			// keep it under the maxBufferSize.
			this.buffer = this.buffer.slice(-this.maxBufferSize);
		}
		return(this.preventDefault);
	}

	// This is the parser for the lociclient command GAEOR
	command(msg) {
		if(msg.mark !== undefined) {
			if(msg.mark === "EOR") {
				if( (this.enabled === true) &&
					(this.onEOR !== undefined) 
				) {
					this.onEOR(this.lociterm,this.buffer);
				}
			} else if(msg.mark === "GA") {
				if( (this.enabled === true) &&
					(this.onGA !== undefined) 
				) {
					this.onGA(this.lociterm,this.buffer);
				}
			} else if(msg.mark === "enabled") {
				// sent by locid to indicate that upstream game has negotiated
				// eor protocol.
				console.log(`GAEOR enabled.`);
				this.enabled = true;
			} else if(msg.mark === "disabled") {
				// sent by locid to indicate that upstream game has NOT
				// negotiated eor protocol.
				console.log(`GAEOR disabled.`);
				this.enabled = false;
			} else {
				console.error(`Unhandled GAEOR command: ${msg}`);
			}

		/* always clear it. */
		this.buffer = "";
		}
	}

	// example handler
	// lociterm is the instance of lociterm that got the marker.
	// buffer is the string of bytes seen since the previous marker.
	// 
	// In, say, lociterm.js you might assign
	//		this.gaeor.onEOR = this.gaeor.example_handler;
	// to see how this handler works.
	example_handler(lociterm,buffer) {
		if(this.preventDefault == true) {
			// its my job to decide what goes to the terminal.
			lociterm.terminal.write(buffer);
		}
		lociterm.terminal.write(`\n──────── MARK ${buffer.length} BYTES ────────\n`);
	}

}

export { GaEorHandler };
