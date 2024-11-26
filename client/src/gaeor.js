// gaeor.js - Telnet GA and EOR handler
// Created: Tue Nov 19 09:51:03 PM EST 2024
// $Id: gaeor.js,v 1.1 2024/11/26 17:34:40 malakai Exp $

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
		this.stack = [];
		this.enabled = false;
		this.buffer = "";
		this.maxBufferSize = Math.pow(2,17);
		/* set these to your favorite functions.  The arguments will be
		 * this.lociterm, this.buffer. */
		this.onEOR = undefined;
		this.onGA = undefined;
	}

	write(str) {
		if(this.enabled === true) {
			this.buffer += str;
			if(this.buffer.length > this.maxBufferSize) {
				// keep it under the maxBufferSize.
				this.buffer = this.buffer.slice(-this.maxBufferSize);
			}
		}
	}

	command(msg) {
		if(msg.mark !== undefined) {
			if(msg.mark === "EOR") {
				if(this.onEOR !== undefined) {
					this.onEOR(this.lociterm,this.buffer);
				}
			} else if(msg.mark === "GA") {
				if(this.onGA !== undefined) {
					this.onGA(this.lociterm,this.buffer);
				}
			} else if(msg.mark === "enabled") {
				this.enabled = true;
			} else if(msg.mark === "disabled") {
				this.enabled = false;
			}

		/* always clear it. */
		this.buffer = "";
		}
	}

	// example handler
	// In, say, lociterm.js you might assign
	//		this.gaeor.onEOR = this.gaeor.example_handler;
	example_handler(lociterm,buffer) {
		console.log(`gaeor: ${buffer.length} bytes in that record.`);
		lociterm.terminal.write(`\n──────── EOR ────────\n`);
	}
		
}

export { GaEorHandler };
