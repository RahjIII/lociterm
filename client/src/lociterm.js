// lociterm.js - LociTerm xterm.js driver
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: lociterm.js,v 1.49 2024/12/10 03:29:15 malakai Exp $

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
import { SerializeAddon } from '@xterm/addon-serialize';

import { MenuHandler } from './menuhandler.js';
import { NerfBar } from './nerfbar.js';
import { GMCP } from './gmcp.js';
import { CRTFilter } from './crtfilter.js';
import { ConnectGame } from './connect.js';
import BellSound from './snd/Oxygen-Im-Contact-In.mp3';
import { WordStack } from './wordstack.js';
import { GaEorHandler } from './gaeor.js';
import { HotkeyHandler } from './hotkey.js';
import { CpDecoder } from './cpdecoder.js';
import * as ObjDeep from './objdeep.js';
import { LociPreferences } from './lociprefs.js';
import { OSC8Handler } from './osc8handler.js';

// The command codes MUST MATCH the defines in server/client.h !
const Command = {
	HELLO: 0,
	TERM_DATA: 1,
	COMMAND: 2,
	CONNECT: 3,
	DISCONNECT: 4,
	ECHO_MODE: 5,
	RESIZE_TERMINAL: 6,
	GMCP_DATA: 7,
	GAME_LIST: 8,
	MORE_INFO: 9,
	GAEOR: 10,
	NETSTAT: 11,
	CHARSET: 12
};

const EchoMode = {
	OldLineMode: 0,
	SGALineMode: 1,
	HiddenLineMode: 2,
	CharMode: 3
};

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
		this.login = { requested: 0, name: "", password: "", remember: 1 };
		this.socket = undefined;
		this.reconnect_key = "";
		this.url = "";
		this.nerfbar = new NerfBar(this,"nerfbar");
		this.echo_mode = EchoMode.OldLineMode;
		this.gmcp = new GMCP(this);
		this.crtfilter = new CRTFilter("crtfilter");
		this.encodings = ["utf-8", "cp437", "big5", "gbk", "ascii"];
		this.encoding = "utf-8";
		this.cpdecoder = new CpDecoder();
		// code. 
		this.terminal.loadAddon(this.unicode11Addon);
		this.terminal.unicode.activeVersion = '11';
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.options.convertEol = true;

		this.webgladdon = new WebglAddon();
		this.webgladdon.onContextLoss(e => {
			this.webgladdon.dispose();
		});
		this.terminal.loadAddon(this.webgladdon);

		//this.imageAddon = new ImageAddon(customImageSettings);
		this.imageAddon = new ImageAddon();
		this.terminal.loadAddon(this.imageAddon);

		this.serializeaddon = new SerializeAddon();
		this.terminal.loadAddon(this.serializeaddon);
		this.serializeInit(mydiv.id);

		// Implicit web link stuff.
		this.webLinksAddon = new WebLinksAddon();
		this.terminal.loadAddon(this.webLinksAddon);


		this.terminal.onKey((e) => this.onKey(e) );
		this.terminal.onData((e) => this.onTerminalData(e) );
		this.terminal.onBinary((e) => this.onBinaryData(e) );
		this.terminal.onSelectionChange((e) => this.onSelectionChange(e) );

		// bah xtermjs removed the built in bell in 5.0.0
		this.terminal.audio = new Audio(BellSound);
		this.terminal.onBell(() => {
			if(this.pref.get("sfx.terminalBell") == true) {
				this.terminal.audio.play();
				// This will shake an android phone!
				navigator.vibrate([50,100,150]);
			}
		});

		let rk;
		if( (rk = sessionStorage.getItem("reconnect_key")) !== null ) {
			this.reconnect_key = JSON.parse(rk);
		} else if( (rk = localStorage.getItem("reconnect_key")) !== null ) {
			this.reconnect_key = JSON.parse(rk);
		} else {
			this.reconnect_key = "";
		}

		this.autoreconnect = true;
		this.reconnect_delay = 0;
		this.serverhello = "";

		window.addEventListener('resize', (e) => this.onWindowResize(e) );

		this.wordstack = new WordStack(this);
		this.wordstack.menuid = "sys_wordstack";
		this.hotkey = new HotkeyHandler(this);
		this.menuhandler = new MenuHandler(this);

		// OSC8 link handler stuff.
		this.osc8handler = new OSC8Handler(this);
		this.terminal.options.linkHandler = this.osc8handler.linkHandler();

		this.gaeor = new GaEorHandler(this);
		// ...for example... 
		// ...enable this line to defer terminal output to the eor handler.
		// this.gaeor.preventDefault = true; 
		// ...and use this as the eor handler.
		// this.gaeor.onEOR = this.gaeor.example_handler;

		// create hotkey menu after menuhandler is installed
		this.hotkey.createEditorDiv();
		this.pref = new LociPreferences(this);
		this.terminal.attachCustomKeyEventHandler( ev => this.customKeyEvent(ev));

		this.connectgame = new ConnectGame(this,this.menuhandler);

		this.serializeRestore(mydiv.id);

		this.terminal.open(mydiv);
		this.fitAddon.fit();
		this.doWindowResize();
		this.resetTerm();
		this.focus();

		// if this is the first time ever that they've come in, show the welcome/disclaimer 
		if(localStorage.getItem("disclaimer") == null) {
			setTimeout(()=>this.menuhandler.open("sys_disclaimer"),2000);
		}
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
					console.info(`Resize: ${this.terminal.cols}x${this.terminal.rows}`);
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
			this.menuhandler.open("sys_game_select");
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
		// reset the hotkeys to any users saved default.  (clears out any
		// hotkeys dynamically set in the session.)
		this.hotkey.reset();

		// ...and make it so.
		console.log(`Connecting to ${JSON.stringify(request)}`);
		this.sendMsg(Command.CONNECT,JSON.stringify(request));
	}

	// ask server to send us a list of games.  request is ignored for now.
	requestGameList(request) {
		request = new Object();	 // ignore the request for now.
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
		this.sendMsg(Command.MORE_INFO,JSON.stringify(msg));
	}

	requestNetStat(request) {
		request = new Object();	 // ignore the request for now.
		this.sendMsg(Command.NETSTAT,JSON.stringify(request));
	}

	focus(data) {
		// focusing the terminal/nerfbar first closes any open menus.
		this.menuhandler.lastFocusedBoxButton = undefined;
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
			//console.log(`send retry`);
		}

		switch (this.socket.readyState) {
			case 1:  // OPEN
				while(this.sendq[0] != undefined) {
					this.socket.send( this.sendq[0] );
					this.sendq = this.sendq.slice(1);
				}
				break;
			case 3:  // CLOSED
				// this.connect();
				/* no break! */
				this.menuhandler.update_connect_message(`🌀 Reconnecting to Web...`);
				this.reconnect_delay = 0;
				this.reconnect();
				break;
			case 0: // CONNECTING
				this.menuhandler.update_connect_message(`🌀 Connecting to Web...`);
				setTimeout( ()=>{this.sendMsg();} , 100 );
				break;
			case 2: // CLOSING
				// if for some reason
				this.menuhandler.update_connect_message(`🌀 Closing Web...`);
				/* no break! */
			default:
				console.error(`ReadState=${this.socket.readyState}.  Lost ${this.sendq.length} messages`);
				this.sendq = [];
				break;
		}
	}

	onKey(e) {
		// prevent tab/shift-tab from selecting the next ui element.
		if(e.domEvent !== undefined) {
			if(e.domEvent.code === "Tab") {
				// This stops the event from going to the rest of the UI, but
				// doesn't actually stop the key from going to the terminal.
				// You'll have to hook into onTerminalData() to intercept that.
				e.domEvent.preventDefault();
			}
		}
		// Kinda hokey, but if the xtermjs temrinal gets a keystroke while the
		// client is in line mode, try and activate the nerfbar instead.
		if(this.echo_mode === EchoMode.SGALineMode || this.echo_mode === EchoMode.OldLineMode) {
			if(this.nerfbar.nerfstate == "active") {
				this.focus();
			}
		}
	}

	onTerminalData(data) {

		// data can definately contain more than just the bytes for one
		// keystroke.  but it sure seems like actual keystrokes show up as just
		// their own seqence.  So that's what we are going to trigger on for
		// intercepting and substituting in a function key based on its
		// definition.  This may not be the right way to do this thing, it may
		// prove to have problems.  Or it may just work.  

		// intercept a defined hotkey sequence, and process it differently.
		let key = this.hotkey.seqToKey.get(data);
		if( (key !== undefined) ) {
			this.hotkey.sendKey(key);
			return;
		}

		// char at a time mode is 3
		if(this.echo_mode == EchoMode.CharMode) {
			// Send that data on up the websocket pipe.
			this.sendMsg(Command.TERM_DATA,data);
			return;
		} else {
			// The nerfbar better get all the keystrokes from now on.  We don't
			// want 'em.
			this.focus();
		}
	}

	onBinaryData(data) {
		//this.sendBinaryMsg(Command.TERM_DATA,data);
		this.sendMsg(Command.TERM_DATA,data);
	}

	onSelectionChange(e) {
		let selection = this.terminal.getSelection();
		if (this.wordstack.addSelection(e,selection) === true) {
			this.wordstack.openMenu();
		} else {
			this.wordstack.closeMenu();
		}
		return;
	}

	paste(data) {
		this.sendMsg(Command.TERM_DATA,data);
		if(this.echo_mode != EchoMode.CharMode ) {
			if( (this.pref.get("nerf.localecho")===true) &&
				(this.echo_mode != EchoMode.HiddenLineMode)
			) {
				if(data.endsWith("\r")) {
					this.terminal.writeln(data);
				} else {
					this.terminal.write(data);
				}
			}
		}
	}

	doSendCMD(obj) {
		this.sendBinaryMsg(Command.COMMAND,JSON.stringify(obj));
	}

	doSendGMCP(module,obj) {
		let msg = module + " " + JSON.stringify(obj);
		// console.log(`GMCP Send: ${msg}`);
		this.sendMsg(Command.GMCP_DATA,msg);
	}

	connect(url=this.url) {

		if(this.socket != undefined) {
			if(this.socket.readyState == 1) { // OPEN
				/* don't re-open on top of soemthing. */
				return;
			}
		}

		if(this.themeLoaded === false) {
			console.log("Delaying connection for themes to load...");
			this.terminal.write(`\r`);
			setTimeout(() => this.connect(url) , 250.0); 
			return;
		}

		this.url = url;
		// this.terminal.write(`\r\nTrying ${url}... `);
		console.log(`Connecting to ${url} . `);
		this.menuhandler.update_connect_message(`🌀 Connecting...`);
		this.socket = undefined;
		try {
			this.socket = new WebSocket(this.url, ['loci-client'],
				{
					rejectUnauthorized: false,
				}
			);
		} catch (err) {
			console.error(`WebSocket Error- ${err.name}-${err.message}`);
			return;
		}
		this.socket.binaryType = 'arraybuffer';
		this.socket.onopen = (e) => this.onSocketOpen(e);
		this.socket.onmessage = (e) => this.onSocketData(e);
		this.socket.onclose = (e) => this.onSocketClose(e);
		this.socket.onerror = (e) => this.onSocketError(e);
	}

	// These diconnect "how" methods are used directly by the menuside system
	// with e.g. "disconnect":"local".  See the handler code in menuhandler.js.
	// Nerfbar code also has a keystroke binding for the remoteRestart method.
	disconnect(how) {
		if(how == "local") {
			this.autoreconnect = false;
			this.socket.close();
			return;
		} else if(how == "remote") {
			this.sendMsg(Command.DISCONNECT,"");
			return;
		} else if(how == "remoteRestart") {
			// Players of Petria MUD wanted a way to quickly terminate the
			// existing telnet session and restart it fresh.  The remoteRestart
			// disconnect method removes the uuid reconnect key and instructs
			// the locid server to connect to the game again.  No need to
			// explicitly disconnect the game, or tear the websocket all the
			// way down.  When a connect request is recieved by locid, the
			// locid server automatically shuts down the current telnet
			// connection, and opens the newly requested one.
			delete this.reconnect_key.reconnect;
			this.reconnect_delay = 0;
			this.doConnectGame();
			return;
		} else if(how == "localRestart") {
			this.reload("Restarting Client...");
			return;
		} else {
			// unrecognized option treated same as 'remote'
			this.sendMsg(Command.DISCONNECT,"");
			return;
		}

	}

	reconnect() {
		if (this.socket != undefined) {
			if (this.socket.readyState == 1) { 
				this.reconnect_delay = 0;
				return;
			}
		}
		//console.log(`Reconnect in ${this.reconnect_delay}`);
		//this.menuhandler.update_connect_message(`🔁Trying to reconnect...`);

		setTimeout(() => this.connect() , this.reconnect_delay); 
		if(this.reconnect_delay == 0) {
			this.reconnect_delay = 1000;
		} else {
			this.reconnect_delay = Math.min(this.reconnect_delay*2,120000);
		}
	}

	onSocketOpen(e) {
		console.log("-- LociTerm WebSocket Open --");
		this.menuhandler.update_connect_message(`🚀Connected!`);
		this.autoreconnect = true;
		this.reconnect_delay = 0;
		this.sendMsg(Command.HELLO,this.serverhello);

		// wait for a hello message to come from server.  Next startup steps
		// have moved into Command.HELLO processing.

	}

	onSocketData(event) {

		let str = "";
		let rawbuffer = event.data;
		let rawbytes = new Uint8Array(rawbuffer);

		let cmd = rawbytes[0];

		switch(cmd) {
			case Command.TERM_DATA:
				var output;
				var outbytes;

				if( this.leftover != undefined ) {
					// There were some trailing UTF bytes left over from the last
					// TERM_DATA message that we would like to combine into this message.
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
					if(this.encoding === "cp437") {
						str = this.cpdecoder.decode(output);
					} else {
						// fatal:true here because we want the thing to fail if there's a
						// partial sequence.
						str = new TextDecoder(this.encoding, {fatal:true}).decode(output);
					}
				} catch (e) {
					let v = new DataView(output);
					let i=v.byteLength -1;
					/* skip backwards from the last byte, over any sequence bytes */
					while((i>0) && (v.getUint8(i) & 0xc0) == 0x80 ) {
						i--;
					}
					// the retry chunk has had the partial utf sequence removed.
					let retry = (output).slice(0,i);
					// this.leftover chunk contains the partial utf sequence for the
					// next send attempt.
					this.leftover = (output).slice(i,v.byteLength);

					// this next TextDecoder used to be fatal:false, cause
					// there was nothing else we know how to fix, so
					// substitution ??s were the last recourse.  Since I added
					// a cp437 decoder, we can fall back to that to get rid of
					// tofus, and the terminal should work with a lot of
					// internet BBS's by default.  It could get wonky if there
					// is a mix of valid UTF-8 and (invalid) cp437 stuff in the
					// same data chunk, the utf-8 is likely gonna get tossed or
					// corrupted.  Or possibly also if the data arrives very
					// slowly.  If that happens... fix something else.

					try {
						str = new TextDecoder(this.encoding, {fatal:true}).decode(retry);
					} catch (e) {
						str = this.cpdecoder.decode(retry);
					}
				}
				
				if( this.gaeor.write(str) === false ) {
					this.terminal.scrollToBottom();
					this.terminal.write(str);
				}
				break;
			case Command.COMMAND:
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = 0; }
				console.warn(`Unhandled command: ${msg}`);
				break;

			case Command.CONNECT: {
				this.gmcp.moduleCount=[];
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				console.log(`Recieved connection update '${msg}'`);
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
					try { this.gmcp.mod("CharLogin").charLoginRequested = false } catch {};

					if(robj.state == "reconnect") {
						// let 'em know if we've changed size.
						this.doWindowResize();

						// at least in LO, ctrl-r requests a redraw. 
						// this.paste("\x12");
						// this.terminal.write(`\r\n┅┅┅┅┅ Reconnected. ┅┅┅┅┅\r\n\r\n`);

					}
					if(robj.msg && (robj.msg != "")) {
						this.menuhandler.update_oob_message(`🤖 ${robj.msg}`);
					} else {
						this.menuhandler.close("sys_oob_message");
					}
				}
				let sobj = {};
				sobj.host = this.reconnect_key.host;
				sobj.port = this.reconnect_key.port;
				sobj.ssl = this.reconnect_key.ssl;
				localStorage.setItem("reconnect_key",JSON.stringify(sobj));
				if(this.reconnect_key.reconnect !== undefined) {
					sobj.reconnect = this.reconnect_key.reconnect;
				}
				sessionStorage.setItem("reconnect_key",JSON.stringify(sobj));
				break;	
			}
			case Command.GMCP_DATA: {
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
						// console.log(`GMCP Recv: ${module} and unparsable crap: '${msg.slice(idx)}'`);
					}
				}
				// console.log("GMCP Recv: " + module + " " + JSON.stringify(obj));
				this.gmcp.parse(module,obj);
				break;
			}
			case Command.ECHO_MODE: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = 0; }
				this.echo_mode = obj;
				if (this.echo_mode == EchoMode.CharMode) {
					console.log(`Game connection is char-at-a-time.`);
					this.nerfbar.setHiddenMode(false);
					/* honor the user's preference. */
					if(this.pref.get("nerf.enabled") === true) {
						this.nerfbar.open();
					} else {
						this.nerfbar.close();
					}
				} else if (this.echo_mode == EchoMode.HiddenLineMode) {
					this.nerfbar.setHiddenMode(true);
				} else {
					console.log(`Game connection is obsolete line mode.`);
					/* open the nerfbar. */
					this.nerfbar.setHiddenMode(false);
					this.nerfbar.open();
					this.nerfbar.nofade();
				}
				this.focus();
				break;
			}
			case Command.GAEOR: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = 0; }
				this.gaeor.command(obj);
				break;
			}
			case Command.GAME_LIST: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = 0; }
				this.connectgame.update_game_select(obj);
				break;
			}
			case Command.MORE_INFO: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = {}; }
				this.connectgame.update_game_about(obj);
				break;
			}
			case Command.NETSTAT: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				try { obj = JSON.parse(msg); } catch { obj = {}; }
				this.menuhandler.netstat.update(obj);
				break;
			}
			case Command.CHARSET: {
				let obj;
				let msg = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				this.cmdCharset(msg);
				break;
			}
			case Command.HELLO: {

				this.gmcp.moduleCount=[];

				let hello = new TextDecoder('utf8').decode(rawbuffer).slice(1);
				console.log(`Hello from server ${hello}`);

				if( (this.serverhello != "") && (this.serverhello != hello) ) {
					console.log(`Sever version has changed, forcing reload.`);
					this.reload("Getting Updates...");
				} else {
					// We're good to go on this end!
					this.serverhello = hello;

					// Send the window size to the game side so that it can be made
					// available to the mud at connection time.
					this.lastResize = "";  // Force it.
					this.doWindowResize();

					// Request connection to the current game.
					this.doConnectGame(0);
					this.menuhandler.close("sys_connect");
				}
				break;
			}
			default:
				console.warn("Unhandled command " + cmd);
				break;
		}
	}

	onSocketClose(e) {
		console.log(`-- LociTerm WebSocket Close --`);
		if( (this.reconnect_key) && 
			(this.reconnect_key.reconnect) &&
			(this.reconnect_key.reconnect != "") &&
			(this.autoreconnect == true) 
		) {
			this.reconnect();
		} else {
			this.menuhandler.update_connect_message(`🌀 Disconnected.`);
			// this.terminal.write(`\r\n┅┅┅┅┅ Disconnected ┅┅┅┅┅\r\n`);
			this.autoreconnect = true;
			this.reconnect_delay = 0;
		}
	}

	onSocketError(e) {
		//this.terminal.write(`\r\n┅┅┅┅┅ Can't reach the Loci server! ┅┅┅┅┅\r\n`);
		this.menuhandler.update_connect_message("🌀 Connection Lost.");
		if(this.reconnect_delay == 0 ) {
			this.reconnect_delay = 1000;
		}
		console.log(`Socket Error, ready state ${this.socket.readyState}, Reconnect in ${this.reconnect_delay}`);
	}

	debug() {
		debugger
	}

	resetTerm() {
		this.terminal.reset();
		this.terminal.clear();
		let scrolldown = this.terminal.rows;
		// scroll down to the bottom.
		let code = `\x1b[${scrolldown}B`;
		this.terminal.write(code);
		setTimeout( ()=> {this.terminal.scrollToBottom();}, 300);
	}

	keyboardEnable(enabled=true) {
		let helpers = document.getElementsByClassName("xterm-helper-textarea");
		if(enabled === false) {
			for(let i=0;i<helpers.length;i++) {
				helpers[i].setAttribute("disabled","true");
			}
		} else {
			for(let i=0;i<helpers.length;i++) {
				helpers[i].removeAttribute("disabled");
			}
		}
	}

	// Handle ctrl-m menu activation and bs/del remapping.
	customKeyEvent(ev) {
		if (ev.type === 'keydown') {
			// KeyM + ctrlKey opens the main menu.
			if( (ev.key == "m") && (ev.ctrlKey === true) ) {
				this.menuhandler.focusMainMenu();
				return false;
			}

			// seems like wierd logic on the pref, but handle backspace
			if( (ev.key == "Backspace") &&
				(this.pref.get("lociterm.bsSendsDel")===true)
			) {
				return true;
			}
		}

		// other keycodes can be remapped here.
		const keymap = [
			{ "key": "Backspace", "ctrlKey": false, "mapCode": 8 },
			{ "key": "Backspace", "ctrlKey": true, "mapCode": 127 }
		];
		if (ev.type === 'keydown') {
			for (let i in keymap) {
				if (keymap[i].key == ev.key && keymap[i].ctrlKey == ev.ctrlKey) {
					this.sendMsg(Command.TERM_DATA,String.fromCharCode(keymap[i].mapCode));
					return false;
				}
			}
		}
	}

	/* translate javascript charset to network charset */
	sendCharset(charset) {
		this.sendMsg(Command.CHARSET,charset.toUpperCase());
	}

	/* network charset to javascript charset */
	cmdCharset(charset) {
		this.encoding = charset.toLowerCase();
		this.pref.set("lociterm.encoding", charset.toLowerCase());
		console.log(`CHARSET is ${charset}`);
	}

	serializeInit(id) {
		window.onbeforeunload = ( ()=> {
			this.serializeSave(id);
		});
	}

	serializeSave(id) {
		let data = this.serializeaddon.serialize();
		sessionStorage.setItem(`${id}_ser`,data);
	}

	serializeRestore(id) {
		let data = sessionStorage.getItem(`${id}_ser`);
		if(data !== null) {
			this.terminal.write(data);
		} 
	}

	// reaload() - Forces a refresh of the javascript application.  Called
	// automatically when a server protocol version mismatch is detected, to
	// force a reload of fresh code.  reload() method ultimately triggers a
	// location.reload(), but it puts a nice message up along with a short
	// randomized delay before doing so.  The constant delay is nice to have
	// for the user to be able to read the message.  The random delay is
	// required to spread out the load of multiple clients trying to request
	// fresh copies of files immediately after they see that locid has
	// restarted under a new version.
	reload(msg="Reloading.") {

		let constant = 2000;
		let spread = (Math.random()*1000);
		let delay = constant + spread;

		this.menuhandler.update_oob_message(`🚀${msg}`);
		setTimeout( 
			() => { 
				// if lociterm ever has service workers, this would be a
				// good place to shut them down cleanly.
				location.reload()
			},
			delay
		);
	}

}

export { LociTerm }

