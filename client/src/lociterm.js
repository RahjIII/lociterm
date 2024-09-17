// lociterm.js - LociTerm xterm.js driver
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: lociterm.js,v 1.34 2024/09/17 03:46:28 malakai Exp $

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

import { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { ImageAddon, IImageAddonOptions } from '@xterm/addon-image';
import { WebglAddon } from '@xterm/addon-webgl';

import { MenuHandler } from './menuhandler.js';
import { NerfBar } from './nerfbar.js';
import { GMCP } from './gmcp.js';
import { CRTFilter } from './crtfilter.js';
import { ConnectGame } from './connect.js';
import BellSound from './snd/Oxygen-Im-Contact-In.mp3';

// shamelessly borrowed from ttyd, as I was considering keeping the ws
// protocols compatible- but I didn't end up doing that.   Not all of these are
// implemented.
const Command = {
	// client message - these are RECEIVED
	OUTPUT: 0,
	SET_WINDOW_TITLE: 1,
	SET_PREFERENCES: 2,
	RECV_CMD: 3,
	RECONNECT_KEY_OLD: 7,
	GMCP_OUTPUT: 8,
	CONNECT_VERBOSE: 9,
	ECHO_MODE: 10,
	GAME_LIST: 11,
	MORE_INFO: 12,

	// server message - these are SENT
	INPUT: 0,
	RESIZE_TERMINAL: 1,
	PAUSE: 2,
	RESUME: 3,
	CONNECT_GAME: 5,
	SEND_CMD: 6,
	DISCONNECT_CMD: 7,
	GMCP_INPUT: 8,
	CONNECT_VERBOSE: 9,
	GAME_LIST: 11,
	MORE_INFO: 12
}

// IIP support from xterm-addon-image
// customize as needed (showing addon defaults)
const customImageSettings = {
  enableSizeReports: true,    // whether to enable CSI t reports (see below)
  pixelLimit: 16777216,       // max. pixel size of a single image
  sixelSupport: true,         // enable sixel support
  sixelScrolling: true,       // whether to scroll on image output
  sixelPaletteLimit: 256,     // initial sixel palette size
  sixelSizeLimit: 25000000,   // size limit of a single sixel sequence
  storageLimit: 128,          // FIFO storage limit in MB
  showPlaceholder: true,      // whether to show a placeholder for evicted images
  iipSupport: true,           // enable iTerm IIP support
  iipSizeLimit: 20000000      // size limit of a single IIP sequence
}

document.setElementById = (id,val) => {

	let item;
	try { 
		item = document.getElementById(id); 
	} catch {
		console.log(`Couldn't setElementById ${id}.`);
		return;
	}
	if(item) {
		if(item.type == 'checkbox') {
			if(item.checked != val) {
				item.checked=val;
			}
		} else {
			if(item.value != val) {
				item.value=val;
			}
		}
	}
};

class LociTerm {

	constructor(mydiv,lociThemes=[]) {

		// set variables.
		this.mydiv = mydiv;
		
		this.lociThemes = lociThemes;
		this.terminal = new Terminal({
			// Unicode11Addon is a proposed api?? 
			allowProposedApi: true 
		});
		this.fitAddon = new FitAddon();
		this.unicode11Addon = new Unicode11Addon();
		this.textEncoder = new TextEncoder();
		this.textDecoder = new TextDecoder();
		this.sendq = [];
		this.resizeTimeout = undefined;
		this.lastResize = "";
		this.webLinksAddon = new WebLinksAddon();
		this.login = { requested: 0, name: "", password: "", remember: 1 };
		this.socket = undefined;
		this.reconnect_key = "";
		this.themeLoaded = 0;
		this.url = "";
		this.nerfbar = new NerfBar(this,"nerfbar");
		this.echo_mode = 0;
		this.gmcp = new GMCP(this);
		this.crtfilter = new CRTFilter("crtfilter");

		// code. 
		this.terminal.loadAddon(this.unicode11Addon);
		this.terminal.unicode.activeVersion = '11';
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.webLinksAddon);
		this.terminal.options.convertEol = true;

		this.webgladdon = new WebglAddon();
		this.webgladdon.onContextLoss(e => {
			this.webgladdon.dispose();
		});
		this.terminal.loadAddon(this.webgladdon);

		//this.imageAddon = new ImageAddon(customImageSettings);
		this.imageAddon = new ImageAddon();
		this.terminal.loadAddon(this.imageAddon);

		this.terminal.onKey((e) => this.onKey(e) );
		this.terminal.onData((e) => this.onTerminalData(e) );
		this.terminal.onBinary((e) => this.onBinaryData(e) );

		// bah xtermjs removed the built in bell in 5.0.0
		this.terminal.audio = new Audio(BellSound);
		this.terminal.onBell(() => {
			this.terminal.audio.play();
			// This will shake an android phone!
			navigator.vibrate([50,100,150]);
		});

		try { 
			this.reconnect_key = JSON.parse(localStorage.getItem("reconnect_key"));
		} catch {
			this.reconnect_key = {};
		}
		this.autoreconnect = true;
		this.reconnect_delay = 0;

		window.addEventListener('resize', (e) => this.onWindowResize(e) );
		this.menuhandler = new MenuHandler(this);
		this.connectgame = new ConnectGame(this,this.menuhandler);
		this.loadDefaultTheme();
		this.terminal.open(mydiv);
		this.fitAddon.fit();
		this.doWindowResize();
		this.resetTerm();
		this.focus();
	}

	// call this as an event listener handler
	onWindowResize() {

		// fitAddon.fit() seems to mess with focus on android, so re-assert the
		// focus after.
		let currentfocus = document.activeElement;
		this.fitAddon.fit();
		focus(currentfocus);

		clearTimeout(this.resizeTimeout); 
		this.resizeTimeout = setTimeout(() => this.doWindowResize() , 200.0); 
	}

	doWindowResize() {
		/* this test is so a resize wont trigger a reconnect. */
		if(this.socket != undefined) {
			if (this.socket.readyState == 1) { 
				let currentSize = `${this.terminal.cols} ${this.terminal.rows}`;
				if(this.lastResize != currentSize) {
					this.sendMsg(Command.RESIZE_TERMINAL,currentSize);
					this.lastResize = currentSize;
				} else {
					// this.terminal.write(`\r\nSame Resize supressed.\r\n`);
				}
				return;
			} 
		} 
		//console.log(`Resize message not sent due to socket not open.`);
	}

	// Connect using a connect_verbose message.
	doConnectGame() {
		let request = {};

		// This wants_to_select logic is important, because if the client would
		// automatically try and connect to a game that is down, the
		// 'disconnect' message will keep withdrawing the
		// select-a-different-game window, and the player ends up stuck.   So
		// if wants_to_select is true, DONT try to connect to a game just yet.
		if(this.connectgame.wants_to_select == true) {
			this.menuhandler.open("menu_game_select");
			this.connectgame.wants_to_select = false;
			return;
		}

		// The client might have a reconnect key that it wants to send up to
		// the server, or it might be trying to use a connectgame suggestion.
		if(this.reconnect_key != "") {
			try {request.reconnect = this.reconnect_key.reconnect;} catch {};
			try {request.host = this.reconnect_key.host;} catch {};
			try {request.port = this.reconnect_key.port;} catch {};
			try {request.ssl = this.reconnect_key.ssl;} catch {};
		} else if(this.connectgame.in_use) {
			request.host = this.connectgame.hostname;
			request.port = this.connectgame.port;
			request.ssl = this.connectgame.ssl;
		}
		this.connectgame.in_use = false;
		if(request.host) {
			this.menuhandler.update_oob_message(`🔀Trying ${request.host} ${request.port}...`);
		} else {
			this.menuhandler.update_oob_message(`🔀Connecting...`);
		}
		console.log(`Sending connect_verbose: ${JSON.stringify(request)}`);
		this.sendMsg(Command.CONNECT_VERBOSE,JSON.stringify(request));
	}

	doConnectGameOld() {
		if(this.reconnect_key == "") {
			console.log(`Connecting to game ${n}.`);
			this.sendMsg(Command.CONNECT_GAME,n);
		} else {
			console.log(`Connecting to uuid ${this.reconnect_key} or game ${n}.`);
			this.sendMsg(Command.CONNECT_GAME,`${n} ${this.reconnect_key}`);
		}
	}

	// ask server to send us a list of games.  request is ignored for now.
	requestGameList(request) {
		request = new Object();	 // ignore the request for now.
		console.log(`Sending GAME_LIST : ${JSON.stringify(request)}`);
		this.sendMsg(Command.GAME_LIST,JSON.stringify(request));
	}

	// ask server to send us MSSP data for host/port/ssl. 
	requestGameInfo(request) {
		let msg = new Object();
		try {
			msg.host = request.host;
			msg.port = request.port;
			msg.ssl = request.ssl;
		} catch {
			msg = {};
		}
		console.log(`Sending MORE_INFO : ${JSON.stringify(msg)}`);
		this.sendMsg(Command.MORE_INFO,JSON.stringify(msg));
	}

	focus(data) {
		this.menuhandler.done();
		/* if the nerfbar is active, focus it instead of the terminal. */
		if(this.nerfbar.nerfstate == "active") {
			return(this.nerfbar.focus());
		} else {
			return(this.terminal.focus());
		}
	}

	sendMsg(cmd,data) {
		if(this.socket == undefined) {
			// never even connected yet..
			console.log(`No socket for message '${data}'`);
			return;
		}

		if(data != undefined) {
			// ' ' + is a lame trick to leave space for a byte at index 0
			let msg = this.textEncoder.encode(' ' + data)
			// change the ' ' into the command byte.
			msg[0] = cmd;
			this.sendq.push(msg);
		} else {
			console.log(`send retry`);
		}

		switch (this.socket.readyState) {
			case 1:  // OPEN
				while(this.sendq[0] != undefined) {
					this.socket.send( this.sendq[0] );
					this.sendq = this.sendq.slice(1);
				}
				break;
			case 3:  // CLOSED
				this.connect();
				/* no break! */
			case 0: // CONNECTING
				this.menuhandler.update_connect_message(`🔄Connecting...`);
				setTimeout( ()=>{this.sendMsg();} , 5 );
				break;
			case 2: // CLOSING
				// if for some reason
				this.menuhandler.update_connect_message(`🌀Closing...`);
				/* no break! */
			default:
				console.log(`ReadState=${this.socket.readyState}.  Lost ${this.sendq.length} messages`);
				this.sendq = [];
				break;
		}
	}

	onKey() {
		// Kinda hokey, but if the xtermjs temrinal gets a keystroke while the
		// client is in line mode, try and activate the nerfbar instead.
		if(this.echo_mode != 3) {
			this.focus();
		}
	}

	onTerminalData(data) {
		/* char at a time mode */
		if(this.echo_mode == 3) {
			this.sendMsg(Command.INPUT,data);
			return;
		} else {
			this.focus();
		}
	}

	onBinaryData(data) {
		//this.sendBinaryMsg(Command.INPUT,data);
		this.sendMsg(Command.INPUT,data);
	}

	paste(data) {
		this.sendMsg(Command.INPUT,data);
		if(this.echo_mode !=3 ) {
			if(data.endsWith("\r")) {
				this.terminal.writeln(data);
			} else {
				this.terminal.write(data);
			}
		}
	}

	doSendCMD(obj) {
		this.sendBinaryMsg(Command.SEND_CMD,JSON.stringify(obj));
	}

	doSendGMCP(module,obj) {
		let msg = module + " " + JSON.stringify(obj);
		//console.log("GMCP Send: " + module + " [object]");
		console.log(`GMCP Send: ${msg}`);
		this.sendMsg(Command.GMCP_INPUT,msg);
	}

	connect(url=this.url) {
		if(this.socket != undefined) {
			if(this.socket.readyState == 1) { // OPEN
				/* don't re-open on top of soemthing. */
				return;
			}
		}

		if(this.themeLoaded == false) {
			console.log("Delaying connection for themes to load...");
			this.terminal.write(`\r`);
			setTimeout(() => this.connect(url) , 10.0); 
			return;
		}

		this.url = url;
		// this.terminal.write(`\r\nTrying ${url}... `);
		console.log(`Connecting to ${url} . `);
		this.menuhandler.update_connect_message(`🔄Connecting...`);
		try {
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
		} catch (err) {
			console.log(`WebSocket Error- ${err.name}-${err.message}`);
			this.reconnect();
		}
	}

	disconnect(how) {
		if(how == "local") {
			this.autoreconnect = false;
			this.socket.close();
		} else {
			this.sendMsg(Command.DISCONNECT_CMD,"");
		}
	}

	reconnect() {
		if (this.socket != undefined) {
			if (this.socket.readyState == 1) { 
				this.reconnect_delay = 0;
				return;
			}
		}
		console.log(`Reconnect in ${this.reconnect_delay}`);
		this.menuhandler.update_connect_message(`🔁Trying to reconnect...`);
		setTimeout(() => this.connect() , this.reconnect_delay); 
		if(this.reconnect_delay == 0) {
			this.reconnect_delay = 1000;
		} else {
			this.reconnect_delay = Math.min(this.reconnect_delay*2,120000);
		}
	}

	onSocketOpen(e) {
		console.log("Socket open!" + e);
		this.menuhandler.update_connect_message(`🚀Connected!`);
		this.autoreconnect = true;
		this.reconnect_delay = 0;
		// Send the window size to the game side so that it can be made
		// available to the mud at connection time.
		this.lastResize = "";  // Force it.
		this.doWindowResize();

		// Request connection to the current game.
		this.doConnectGame(0);
		this.menuhandler.close("menu_connect");

	}

	onSocketData(event) {

		let str = "";
		let rawbuffer = event.data;
		let rawbytes = new Uint8Array(rawbuffer);

		let cmd = rawbytes[0];

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

				this.terminal.scrollToBottom();
				this.terminal.write(str);
				break;
			case Command.RECV_CMD:
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				let obj = JSON.parse(msg);
				// Of course, there's nothing implemented yet so...
				console.warn("Unhandled recv_json: " + msg);
				break;

			case Command.CONNECT_VERBOSE: {
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				console.log(`Recieved connect_verbose '${msg}'`);
				let robj = JSON.parse(msg);
				if( robj.reconnect) {
					if ((robj.reconnect == "invalidate")) {
						delete this.reconnect_key.reconnect;
					} else {
						this.reconnect_key = robj;
					}
				}
				if (robj.state) {
					// reset the gcmp login mode.
					try { this.gmcp.charLoginRequested = false } catch {};

					if(robj.state == "reconnected") {
						this.doWindowResize();
						this.paste("\x12");  /* at least in LO, ctrl-r requests a redraw. */
						//this.terminal.write(`\r\n┅┅┅┅┅ Reconnected. ┅┅┅┅┅\r\n\r\n`);

					}
					if(robj.msg && (robj.msg != "")) {
						this.menuhandler.update_oob_message(`🤖 ${robj.msg}`);
					} else {
						this.menuhandler.close("menu_oob_message");
					}
				}
				let sobj = {};
				sobj.host = this.reconnect_key.host;
				sobj.port = this.reconnect_key.port;
				sobj.ssl = this.reconnect_key.ssl;
				localStorage.setItem("reconnect_key",JSON.stringify(sobj));
				break;	
			}
			case Command.GMCP_OUTPUT: {
				// the format is the standard GMCP one.  A text field that is
				// the GMCP module name, followed by a JSON encoded object.
				// Parse them out here.
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				let idx = msg.indexOf(" ");
				let module = msg;
				let obj = new Object();
				if(idx != -1) {
					module = msg.slice(0,idx);
					try {
						obj = JSON.parse(msg.slice(idx));
					} catch {
						console.log(`GMCP Recv: ${module} and unparsable crap: '${msg.slice(idx)}'`);
					}
				}
				console.log("GMCP Recv: " + module + " " + JSON.stringify(obj));
				this.gmcp.parse(module,obj);
				break;
			}
			case Command.ECHO_MODE: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = 0; }
				console.log(`ECHO_MODE: ${obj}`);
				this.echo_mode = obj;
				if (this.echo_mode == 3) {
					/* honor the user's preference. */
					let nerfbar = localStorage.getItem("nerfbar");
					if(nerfbar == "true") {
						this.nerfbar.open();
					} else {
						this.nerfbar.close();
					}
				} else {
					/* open the nerfbar. */
					this.nerfbar.open();
					this.nerfbar.nofade();
				}
				this.focus();
				break;
			}
			case Command.GAME_LIST: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				console.log(`GAME_LIST: ${msg}`);
				try { obj = JSON.parse(msg); } catch { obj = 0; }
				this.connectgame.update_game_select(obj);
				break;
			}
			case Command.MORE_INFO: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				console.log(`MORE_INFO: ${msg}`);
				try { obj = JSON.parse(msg); } catch { obj = {}; }
				this.connectgame.update_game_about(obj);
				break;
			}
			default:
				console.warn("Unhandled command " + cmd);
				break;
		}
	}

	onSocketClose(e) {
		console.log(`Socket Close`);
		if( (this.reconnect_key) && 
			(this.reconnect_key.reconnect) &&
			(this.reconnect_key.reconnect != "") &&
			(this.autoreconnect == true) 
		) {
			this.reconnect();
		} else {
			this.menuhandler.update_connect_message(`🔅Disconnected`);
			// this.terminal.write(`\r\n┅┅┅┅┅ Disconnected ┅┅┅┅┅\r\n`);
			this.autoreconnect = true;
			this.reconnect_delay = 0;
		}
	}

	onSocketError(e) {
		//this.terminal.write(`\r\n┅┅┅┅┅ Can't reach the Loci server! ┅┅┅┅┅\r\n`);
		this.menuhandler.update_connect_message("😵Socket Error!");
		console.log(`Socket Error`);
	}

	loadDefaultTheme() {
		let defaultTheme = this.lociThemes[0];
		defaultTheme.locithemeno = 0;
		let defaultThemeName = localStorage.getItem("locithemename");
		for (let i=0;i<this.lociThemes.length;i++) {
			if(this.lociThemes[i].name == defaultThemeName) {
				console.log("Found stored theme name " + defaultThemeName);
				defaultTheme = this.lociThemes[i];
				defaultTheme.locithemeno = i;
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
		let nerfbar = localStorage.getItem("nerfbar");
		if (nerfbar != undefined) {
			defaultTheme.nerfbar = nerfbar;
		} else {
			defaultTheme.nerfbar = "false";
		}

		let readermode = localStorage.getItem("screenReaderMode");
		if(readermode == null) {
			readermode = "true";  // default to true if not set.
		}
		defaultTheme.screenReaderMode = readermode;
		defaultTheme.xtermoptions.screenReaderMode = readermode;

		let bgridAnchor = localStorage.getItem("bgridAnchor");
		if (bgridAnchor != undefined) {
			defaultTheme.bgridAnchor = bgridAnchor;
		} else {
			defaultTheme.bgridAnchor = "tr";
		}

		let menusideAnchor = localStorage.getItem("menusideAnchor");
		if (menusideAnchor != undefined) {
			defaultTheme.menusideAnchor = menusideAnchor;
		} else {
			defaultTheme.menusideAnchor = "br";
		}

		this.crtfilter.load();
		defaultTheme.crtoptions = this.crtfilter.opts;

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
		if(theme.nerfbar != undefined) {
			localStorage.setItem("nerfbar",theme.nerfbar);
			let select = document.getElementById("nerfbar-select");
			if(select != undefined) {
				select.checked = (theme.nerfbar == "true");
			}
			if(this.echo_mode == 3) {
				if(theme.nerfbar == "true") {
					this.nerfbar.open();
				} else {
					this.nerfbar.close();
				}
			} else {
				/* open the nerfbar. */
				this.nerfbar.open();
				this.nerfbar.nofade();
			}
		}
		if( (theme.xtermoptions != undefined) && (theme.xtermoptions.screenReaderMode != undefined)) {
			localStorage.setItem("screenReaderMode",theme.xtermoptions.screenReaderMode);
			let select = document.getElementById("reader-select");
			if(select != undefined) {
				select.checked = (theme.xtermoptions.screenReaderMode)?true:false;
			} else {
				select.checked = true;
			}
		}

		if(theme.bgridAnchor != undefined) {
			localStorage.setItem("bgridAnchor",theme.bgridAnchor);
			if( theme.bgridAnchor[0] == 't' ) {
				document.documentElement.style.setProperty('--bgridAnchor-top', "0");
				document.documentElement.style.setProperty('--bgridAnchor-bottom', 'unset');
			} else {
				document.documentElement.style.setProperty('--bgridAnchor-top', 'unset');
				document.documentElement.style.setProperty('--bgridAnchor-bottom', "2em");
			}
			if( theme.bgridAnchor[1] == 'l' ) {
				document.documentElement.style.setProperty('--bgridAnchor-left', "0");
				document.documentElement.style.setProperty('--bgridAnchor-right', 'uset');
			} else {
				document.documentElement.style.setProperty('--bgridAnchor-left', 'unset');
				document.documentElement.style.setProperty('--bgridAnchor-right', "0");
			}
			// Update the bgridAnchor selector
			let select = document.getElementById("bgridAnchor-select");
			if(select != undefined) {
				select.value = theme.bgridAnchor;
			}
		}

		if(theme.menusideAnchor != undefined) {
			localStorage.setItem("menusideAnchor",theme.menusideAnchor);
			if( theme.menusideAnchor[0] == 't' ) {
				document.documentElement.style.setProperty('--menuside-open-top', 0);
				document.documentElement.style.setProperty('--menuside-open-bottom', 'unset');
				document.documentElement.style.setProperty('--menuside-close-top', "-100%");
				document.documentElement.style.setProperty('--menuside-close-bottom', 'unset');
			} else {
				document.documentElement.style.setProperty('--menuside-open-top', 'unset');
				document.documentElement.style.setProperty('--menuside-open-bottom', 0);
				document.documentElement.style.setProperty('--menuside-close-top', 'unset');
				document.documentElement.style.setProperty('--menuside-close-bottom', "-100%");
			}
			if( theme.menusideAnchor[1] == 'l' ) {
				document.documentElement.style.setProperty('--menuside-open-left', 0);
				document.documentElement.style.setProperty('--menuside-open-right', 'unset');
				document.documentElement.style.setProperty('--menuside-close-left', "-100%");
				document.documentElement.style.setProperty('--menuside-close-right', 'unset');
			} else {
				document.documentElement.style.setProperty('--menuside-open-left', 'unset');
				document.documentElement.style.setProperty('--menuside-open-right', 0);
				document.documentElement.style.setProperty('--menuside-close-left', 'unset');
				document.documentElement.style.setProperty('--menuside-close-right', "-100%");
			}
			// Update the menusideAnchor selector
			let select = document.getElementById("menusideAnchor-select");
			if(select != undefined) {
				select.value = theme.menusideAnchor;
			}
		}

		// Update the theme selector
		if(theme.locithemeno != undefined) {
			let select = document.getElementById("theme-select");
			if(select != undefined) {
				select.value = theme.locithemeno;
			}
		}

		/* Set the main backgound... */
		if(theme.background != undefined) {
			document.documentElement.style.setProperty('--background-color', theme.background);
		} else {
			/* ... or have the main theme background inherit the xterm background. */
			if(theme.xtermoptions != undefined) {
				if(theme.xtermoptions.theme != undefined) {
					if(theme.xtermoptions.theme.background != undefined) {
						document.documentElement.style.setProperty('--background-color', theme.xtermoptions.theme.background);
					}
				}
			}
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
		
		
		if(theme.crtoptions != undefined) {
			this.crtfilter.update(this.crtfilter.defaultopts);
			this.crtfilter.update(theme.crtoptions);
			this.crtfilter.save();
		}

		this.themeLoaded = 1;
	}

	debug() {
		debugger
	}

	resetTerm() {
		this.terminal.reset();
		this.terminal.clear();
		let scrolldown = this.terminal.rows + 2;
		// clear the screen, scroll down past the bottom.
		let code = `\x1b[2J\x1B[${scrolldown}B`;
		console.log(`code is ${code}`);
		this.terminal.write(code);
	}

}

export { LociTerm }

