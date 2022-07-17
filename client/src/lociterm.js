// lociterm.js - LociTerm xterm.js driver
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: lociterm.js,v 1.12 2022/07/17 15:55:31 malakai Exp $

// Copyright © 2022 Jeff Jahr <malakai@jeffrika.com>
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
//

import { Terminal } from 'xterm';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { MenuHandler } from './menuhandler.js';

// shamelessly borrowed from ttyd, as I was considering keeping the ws
// protocols compatible- but I didn't end up doing that.   Not all of these are
// implemented.
const Command = {
	// client message - these are RECEIVED
	OUTPUT: '0',
	SET_WINDOW_TITLE: '1',
	SET_PREFERENCES: '2',
	RECV_CMD: '3',

	// server message - these are SENT
	INPUT: '0',
	RESIZE_TERMINAL: '1',
	PAUSE: '2',
	RESUME: '3',
	CONNECT_GAME: '5',
	SEND_CMD: '6'
}

class LociTerm {

	constructor(mydiv,lociThemes=[]) {

		// set variables.
		this.mydiv = mydiv;
		this.lociThemes = lociThemes;
		this.terminal = new Terminal();
		this.fitAddon = new FitAddon();
		this.unicode11Addon = new Unicode11Addon();
		this.textEncoder = new TextEncoder();
		this.textDecoder = new TextDecoder();
		this.resizeTimeout = undefined;
		this.webLinksAddon = new WebLinksAddon();
		this.login = { requested: 0, name: "", password: "", remember: 1 };
		this.socket = undefined;
		this.themeLoaded = 0;
		this.url = "";

		// code. 
		this.terminal.loadAddon(this.unicode11Addon);
		this.terminal.unicode.activeVersion = '11';
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.webLinksAddon);
		this.terminal.onData((e) => this.onTerminalData(e) );
		this.terminal.onBinary((e) => this.onBinaryData(e) );

		window.addEventListener('resize', (e) => this.onWindowResize(e) );
		this.loadDefaultTheme();
		this.menuhandler = new MenuHandler(this);
		this.terminal.open(mydiv);
		this.fitAddon.fit();
		this.focus();
	}

	// call this as an event listener handler
	onWindowResize() {
		this.fitAddon.fit();
		// the point of this foolisheness is to limit the resize updates being
		// sent across the network to a more resonable rate.
		clearTimeout(this.resizeTimeout); 
		this.resizeTimeout = setTimeout(() => this.doWindowResize() , 200.0); 
	}

	doWindowResize() {
		this.sendMsg(Command.RESIZE_TERMINAL,`${this.terminal.cols} ${this.terminal.rows}`);
	}

	// Connect to the n'th game on the server's list
	doConnectGame(n=0) {
		console.log(`Connecting to game ${n}.`);
		this.sendMsg(Command.CONNECT_GAME,n);
	}

	focus(data) {
		return(this.terminal.focus());
	}

	sendMsg(cmd,data) {
		if(this.socket == undefined) {
			// never even connected yet..
			console.log(`No socket for message '${data}'`);
			return;
		}
		if(this.socket.readyState == 1) {  // OPEN
			this.socket.send( this.textEncoder.encode(cmd + data) );
		} else if(this.socket.readyState == 3) {  // CLOSED
			this.connect();
		} else {
			// message is lost..
			console.log(`Lost message '${data}'`);
		}
	}

	onTerminalData(data) {
		this.sendMsg(Command.INPUT,data);
	}

	onBinaryData(data) {
		this.sendBinaryMsg(Command.INPUT,data);
	}

	paste(data) {
		this.sendMsg(Command.INPUT,data);
	}

	doSendCMD(obj) {
		this.sendBinaryMsg(Command.SEND_CMD,JSON.stringify(obj));
	}


	connect(url=this.url) {
		if(this.themeLoaded == false) {
			console.log("Delaying connection for themes to load...");
			this.terminal.write(`\r`);
			setTimeout(() => this.connect(url) , 10.0); 
			return;
		}
		this.url = url;
		//this.terminal.write(`\r\nTrying ${url}... `);
		console.log(`Connecting to ${url} . `);
		this.socket = new WebSocket(this.url, ['loci-client'],
			{
				rejectUnauthorized: false,
			}
		);
		this.socket.binaryType = 'arraybuffer';
		this.socket.onopen = (e) => this.onSocketOpen(e);
		this.socket.onmessage = (e) => this.onSocketData(e);
		this.socket.onclose = (e) => this.onSocketClose(e);
		this.socket.onerror = (e) => this.onSocketError(e);
	}

	onSocketOpen(e) {
		console.log("Socket open!" + e);
		//this.terminal.write(`Connected!\r\n`);
		// Send the window size to the game side so that it can be made
		// available to the mud at connection time.
		this.doWindowResize();
		// Request connection to the default game.  (doConnectGame takes an
		// argument... but there's only the default game so far.)
		this.doConnectGame(0);
	}

	onSocketData(event) {

		let str = "";
		let rawbuffer = event.data;
		let rawbytes = new Uint8Array(rawbuffer);

		let cmd = new TextDecoder('utf8').decode(rawbuffer).charAt(0);

		switch(cmd) {
			case Command.OUTPUT:
				var output;
				var outbytes;

				if( this.leftover != undefined ) {
					// There were some trailing UTF bytes left over from the last
					// OUTPUT message that we would like to combine into this message.
					// (See the large comment block below.)
					let leftbytes = new Uint8Array(this.leftover);
					output = new ArrayBuffer( this.leftover.byteLength + rawbytes.byteLength-1 );
					outbytes = new Uint8Array(output);
					outbytes.set(leftbytes.slice(0,leftbytes.byteLength),0);
					outbytes.set(rawbytes.slice(1,rawbytes.byteLength),leftbytes.byteLength);
					this.leftover = undefined;
				} else {
					// No leftover utf bytes, just need to remove the first byte command.
					output = new ArrayBuffer( rawbytes.byteLength-1 );
					outbytes = new Uint8Array(output);
					outbytes.set(rawbytes.slice(1,rawbytes.bytelength),0);
				}

				// ok... its possible that there is a dangling utf sequence at the end
				// of this uint8 ArrayBuffer, due to the sequence being split across a
				// packet boundary.  The text decoder would fail because of that, and
				// try to sub in a ? character.  Rather than leave the bad data as a
				// substitute character, we are gonna try to fix it, by removing the
				// partial utf sequence from the end, and saving it for transmission
				// with the next message.

				try {
					// fatal:true here because we want the thing to fail if there's a
					// partial sequence.
					str = new TextDecoder('utf8', {fatal:true}).decode(output);
				} catch {
					let v = new DataView(output);
					let i=v.byteLength -1;
					/* skip backwards from the last byte, over any sequence bytes */
					while( (v.getUint8(i) & 0xc0) == 0x80 ) {
						i--;
					}
					// the retry chunk has had the partial utf sequence removed.
					let retry = (output).slice(0,i);
					// this.leftover chunk contains the partial utf sequence for the
					// next send attempt.
					this.leftover = (output).slice(i,v.byteLength);

					// fatal:false, cause there's nothing else we know how to fix.  If
					// they get garbage chars at this point, oh ??ell.
					str = new TextDecoder('utf8', {fatal:false}).decode(retry);
				}

				this.terminal.write(str);
				break;
			case Command.RECV_CMD:
				let msg = new TextDecoder('utf8').decode(rawbuffer).charAt(1);
				let obj = JSON.parse(msg);
				// Of course, there's nothing implemented yet so...
				console.warn("Unhandled recv_json: " + msg);
			default:
				console.warn("Unhandled command " + cmd);
				break;
		}
	}

	onSocketClose(e) {
		console.log("Socket Close." + e);
		this.terminal.write(`\r\n┅┅┅┅┅ Disconnected ┅┅┅┅┅\r\n`);
	}

	onSocketError(e) {
		this.terminal.write(`\r\n┅┅┅┅┅ Can't reach the Loci server! ┅┅┅┅┅\r\n`);
		console.log("Socket Error." + e);
	}

	loadDefaultTheme() {
		let defaultTheme = this.lociThemes[0];
		let defaultThemeName = localStorage.getItem("locithemename");
		for (let i=0;i<this.lociThemes.length;i++) {
			if(this.lociThemes[i].name == defaultThemeName) {
				console.log("Found stored theme name " + defaultThemeName);
				defaultTheme = this.lociThemes[i];
				break;
			}
		}

		// these should probably be in an array to be looped over...
		let fingerSize = localStorage.getItem("fingerSize");
		if (fingerSize != undefined) {
			defaultTheme.fingerSize = fingerSize;
		}
		let fontSize = localStorage.getItem("fontSize");
		if (fontSize != undefined) {
			defaultTheme.fontSize = fontSize;
			defaultTheme.xtermoptions.fontSize = parseFloat(fontSize);
		}
		let menuFade = localStorage.getItem("menuFade");
		if (menuFade != undefined) {
			defaultTheme.menuFade = menuFade;
		}
			
		
		this.applyTheme(defaultTheme);
	}

	applyThemeNo(no=-1) {
		
		if( (no < 0) || (no >= this.lociThemes.length) ) {
			return;
		}
		this.applyTheme(this.lociThemes[no]);
	}

	async applyTheme(theme) {

		this.themeLoaded = 0;
		// Apply the lociterm specific theme items.  This should probably be
		// some kind of loop.
		if(theme.fingerSize != undefined) {
			document.documentElement.style.setProperty('--finger-size', theme.fingerSize);
			localStorage.setItem("fingerSize",theme.fingerSize);
		}
		if(theme.fontSize != undefined) {
			document.documentElement.style.setProperty('--font-size', theme.fontSize);
			localStorage.setItem("fontSize",theme.fontSize);
		}
		if(theme.menuFade != undefined) {
			document.documentElement.style.setProperty('--menufade-hidden', theme.menuFade);
			localStorage.setItem("menuFade",theme.menuFade);
		}

		// Apply the xtermjs specific theme items.
		if(theme.xtermoptions != undefined) {
			// If there's an xterm fontFamily specified, check if that font is
			// already loaded.  If it is not, ask for it to be loaded, and
			// trigger an async function to recall applyTheme when it is ready.
			if(theme.xtermoptions.fontFamily != undefined) {
				let familylist = theme.xtermoptions.fontFamily.split(",");
				for (let f=0; f<familylist.length; f++) {
					let fontname = "16px " + familylist[f];
					if( document.fonts.check(fontname) == false ) {
						console.log(`Loading ${fontname}`);
						document.fonts.load(fontname);
					}
				}
				await document.fonts.ready;
			}
			this.terminal.options = Object.assign(theme.xtermoptions);
			this.terminal.refresh(0,this.terminal.rows-1);
			this.fitAddon.fit();
			this.doWindowResize();
		}
		if(theme.name != undefined) {
			localStorage.setItem("locithemename",theme.name);
			this.themeName = theme.name;
		}
		this.themeLoaded = 1;
	}

	debug() {
		debugger
	}

}

export { LociTerm }

