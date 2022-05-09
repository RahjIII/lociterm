// lociterm.js - LociTerm xterm.js driver
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: lociterm.js,v 1.5 2022/05/09 05:16:14 malakai Exp $

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
import { MenuHandler } from './menuhandler.js';

// shamelessly borrowed from ttyd.
const Command = {
	// client message
	OUTPUT: '0',
	SET_WINDOW_TITLE: '1',
	SET_PREFERENCES: '2',

	// server message
	INPUT: '0',
	RESIZE_TERMINAL: '1',
	PAUSE: '2',
	RESUME: '3',
	JSON_DATA: '{'
}

class LociTerm {

	constructor(mydiv,lociThemes=[]) {

		// set variables.
		this.mydiv = mydiv;
		this.lociThemes = lociThemes;
		this.terminal = new Terminal();
		this.fitAddon = new FitAddon();
		this.textEncoder = new TextEncoder();
		this.textDecoder = new TextDecoder();
		this.resizeTimeout = undefined;
		this.webLinksAddon = new WebLinksAddon();
		this.socket = undefined;
		this.themeLoaded = 0;
		this.url = "";

		// code. 
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.webLinksAddon);
		this.terminal.onData((e) => this.onTerminalData(e) );
		this.terminal.onBinary((e) => this.onBinaryData(e) );

		window.addEventListener('resize', (e) => this.onWindowResize(e) );
		this.loadDefaultTheme();
		this.menuhandler = new MenuHandler(this);
		this.terminal.open(mydiv);
		this.fitAddon.fit();
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

	focus(data) {
		return(this.terminal.focus());
	}

	sendMsg(cmd,data) {
		if(this.socket == undefined) {
			// never even connected yet..
			return;
		}
		if(this.socket.readyState == 1) {  // OPEN
			this.socket.send( this.textEncoder.encode(cmd + data) );
		} else if(this.socket.readyState == 3) {  // CLOSED
			this.connect();
		} else {
			// message is lost..
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
		this.socket = new WebSocket(this.url, ['loci-client']);
		this.socket.binaryType = 'arraybuffer';
		this.socket.onopen = (e) => this.onSocketOpen(e);
		this.socket.onmessage = (e) => this.onSocketData(e);
		this.socket.onclose = (e) => this.onSocketClose(e);
		this.socket.onerror = (e) => this.onSocketError(e);
	}

	onSocketOpen(e) {
		console.log("Socket open!" + e);
		//this.terminal.write(`Connected!\r\n`);
		this.doWindowResize();
	}

	onSocketData(event) {
		
		let str = new TextDecoder().decode(event.data);
		let cmd = str.slice(0,1);
		let data = str.slice(1);

		switch(cmd) {
			case Command.OUTPUT:
				this.terminal.write(data);
				break;
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

		let fingerSize = localStorage.getItem("fingerSize");
		if (fingerSize != undefined) {
			defaultTheme.fingerSize = fingerSize;
		}
		let fontSize = localStorage.getItem("fontSize");
		if (fontSize != undefined) {
			defaultTheme.fontSize = fontSize;
			defaultTheme.xtermoptions.fontSize = parseFloat(fontSize);
		}
			
		
		this.applyTheme(defaultTheme);
	}

	async applyTheme(theme) {

		this.themeLoaded = 0;
		console.log("applying theme.");
		// Apply the lociterm specific theme items.
		if(theme.fingerSize != undefined) {
			document.documentElement.style.setProperty('--finger-size', theme.fingerSize);
			localStorage.setItem("fingerSize",theme.fingerSize);
		}
		if(theme.fontSize != undefined) {
			document.documentElement.style.setProperty('--font-size', theme.fontSize);
			localStorage.setItem("fontSize",theme.fontSize);
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
		}
		console.log("theme is ready.");
		this.themeLoaded = 1;
	}

	debug() {
		debugger
	}

}

export { LociTerm }

