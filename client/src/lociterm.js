import { Terminal } from 'xterm';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';

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

	constructor(mydiv,props={}) {
	
		// set variables.
		this.props = props;
		this.mydiv = mydiv;
		this.terminal = new Terminal();
		this.fitAddon = new FitAddon();
		this.textEncoder = new TextEncoder();
		this.textDecoder = new TextDecoder();
		this.resizeTimeout = undefined;
		this.webLinksAddon = new WebLinksAddon();
		this.socket = undefined;
		this.url = "";

		// code. 
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(this.webLinksAddon);
		this.terminal.onData((e) => this.onTerminalData(e) );
		this.terminal.onBinary((e) => this.onBinaryData(e) );

		this.terminal.open(mydiv);
		this.fitAddon.fit();
		window.addEventListener('resize', (e) => this.onWindowResize(e) );

		this.terminal.write('Hello there! webpack loci.\r\n');
	}

	// call this as an event listener handler
	onWindowResize() {
		// the point of this foolisheness is to limit the resize updates to
		// a more resonable rate.
		clearTimeout(this.resizeTimeout); 
		this.resizeTimeout = setTimeout(() => this.doWindowResize() , 200.0); 
	}

	doWindowResize() {
		this.fitAddon.fit();
		this.sendMsg(Command.RESIZE_TERMINAL,`${this.terminal.cols} ${this.terminal.rows}`);
	}

	focus(data) {
		return(this.terminal.focus());
	}

	sendMsg(cmd,data) {
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
		this.url = url;
		this.terminal.write(`\r\nTrying ${url}... `);
		this.socket = new WebSocket(this.url, ['loci-client']);
		// this.socket = new WebSocket(this.url);
		this.socket.binaryType = 'arraybuffer';
		this.socket.onopen = (e) => this.onSocketOpen(e);
		this.socket.onmessage = (e) => this.onSocketData(e);
		this.socket.onclose = (e) => this.onSocketClose(e);
		this.socket.onerror = (e) => this.onSocketError(e);
	}

	onSocketOpen(e) {
		console.log("Socket open!" + e);
		this.terminal.write(`Connected!\r\n`);
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
		this.terminal.write(`\r\nWebSocket closed.\r\n`);
	}

	onSocketError(e) {
		this.terminal.write(`\r\nWebSocket error ${e.currentTarget.readyState}.\r\n`);
		console.log("Socket Error." + e);
	}

}

export { LociTerm }

