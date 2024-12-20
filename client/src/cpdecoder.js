// cpdecode.js - last shot at tofu removal
// Created: Sat Dec  7 11:39:12 AM EST 2024
// $Id: cpdecoder.js,v 1.2 2024/12/10 03:29:15 malakai Exp $
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

class CpDecoder {

	constructor(encoding="cp437",options={}) {
		// suggestions taken from https://en.wikipedia.org/wiki/Code_page_437
		const cp437 = new Uint16Array( [
			0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7,
			0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf,
			0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
			0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
			0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
			0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
			0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
			0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f,
			0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,
			0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f,
			0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57,
			0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
			0x60, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,
			0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
			0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77,
			0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f,
			0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7,
			0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5,
			0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9,
			0x00FF, 0x00D6, 0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192,
			0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA,
			0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
			0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
			0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
			0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F,
			0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567,
			0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B,
			0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
			0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5, 0x03C4,
			0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229,
			0x2261, 0x00B1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248,
			0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F, 0x00B2, 0x25A0, 0x00A0
		] );
	
		if(encoding === "cp437") {
			this.encoding = cp437;
		} else {
			throw new RangeError(`The encoding label provided ('${encoding}') is invalid.`);
		}
	}

	decode(src) {
		if ( !(src instanceof ArrayBuffer) ) {
			throw new TypeError("src needs to be an ArrayBuffer");
		}
		let bytes = new Uint8Array(src);
		let str = bytes.reduce( (str,b)=>{ 
			return( str+=String.fromCharCode(this.encoding[b]) );
		},"");
		return(str);
	}

}

export { CpDecoder };
