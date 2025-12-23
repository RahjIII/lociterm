// ocs8handler.js - OCS8 Hyperlink handler
// Created: Wed Apr 23 11:45:16 PM EDT 2025

// Copyright © 2025 Jeff Jahr <malakai@jeffrika.com>
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

class OSC8Handler {

	constructor(lociterm) {

		this.lociterm = lociterm;
		this.linkpopup = undefined;
		
		// Call the osc8 interceptor whenever an OSC8 hyperlink directive is
		// seen.
		this.lociterm.terminal.parser.registerOscHandler(
			8,(data)=>this.interceptor(data)
		);

		return(this);
	};

	// interceptor() is called by xterm.js whenever it has recieved a complete
	// OSC8 sequence (this is when defined, NOT when the user clicks the link.
	// See linkHandler() for that)
	interceptor(osc8data) {
		// return(false) means event not handled, and so xterm.js OSC8 handler
		// still gets a chance to run. Only return(true) if there is nothing
		// for the xterm.js osc8 handler to do!
		
		// Immediate return, interceptor is not implmenented for anything other
		// than example code yet.
		return(false);
		
		// Example code for parsing a styled OSC8 link.  See
		// https://wiki.mudlet.org/w/Area_51#Style_Presets

		let params = osc8data.split(';')[0];
		let uri = osc8data.split(';')[1];
		if(uri == '') {
			// This was an end of hyperlink marker.
			console.log(`OSC8 Close Marker.`);
			return(false);
		} 
		let url = undefined;
		try {
			url = new URL(uri);
		} catch {
			console.log(`OSC8 bad URI.`);
			return(false);
		}
		
		let scheme = url.protocol;  // eg. 'send:'
		// For MUD send: prompt: etc. type messages, the text will be parsed
		// into the url.pathname.

		let message = decodeURIComponent(url.pathname); // eg. "say hello"

		let config = {};
		try { config = JSON.parse(url.searchParams.get('config')); } catch {};

		// now you can access config values in the usual object way.
		let color = config?.style?.color;
		let background = config?.style?.background;

		console.log(`OSC8 Parsed: ${scheme} '${message}' in fg=${color} bg=${background}`);
		return(false);
	}

	// Returns a linkHandler object suitable for terminal options.
	linkHandler() {

		let linkHandler = {
			activate: (e,text,range) => {
				this.lociterm.wordstack.addLink(e,text,range); 
				this.lociterm.wordstack.updateMenu(e,text,range); 
				if(this.lociterm.pref.get("lociterm.linksOpenImmediately")===true) {
					this.sendLink(e,text,range);
					this.removeLinkPopup();
				} else {
					this.lociterm.wordstack.openMenu();
					this.removeLinkPopup();
				}
					
			},
			hover: (e,text,range) => { 
				if(this.lociterm.pref.get("lociterm.linksOpenImmediately")===true) {
					this.showLinkPopup(e,text,range);
				}
			},
			leave: (e,text,range) => { this.removeLinkPopup(e,text,range); },
			allowNonHttpProtocols: true
		}
		return(linkHandler);
	};

	supportedLinkScheme(scheme) {
		const schemes = new Set(['send','prompt','http','https','mailto']);
		return(schemes.has(scheme));
	}

	// Custom OSC8 link handler 
	sendLink(e,text,range) {

		let scheme = text.split(":")[0].toLowerCase();
		let path = text.slice(text.indexOf(":")+1);

		if(!this.supportedLinkScheme(scheme)) { 
			console.warn(`Unsupported OSC8 hyperlink '${text}'`);
			return;
		}

		if(scheme === "send" || scheme == "prompt") {

			let cmd = decodeURIComponent(path);

			if(scheme === "send") {
				cmd += "\n";
			} else {
				cmd += " ";
			}
			// bah I hate the nerfbar.  But I do want this routed through the
			// nerfbar if its active, so it has to route through menuhandler.
			this.lociterm.menuhandler.send(cmd);
			return;
		}

		// fragment snagged from xterm.js/src/browser/OscLinkProvider.ts
		this.lociterm.menuhandler.done();
		const answer = confirm(`Do you want to navigate to ${text}?`);
		if(answer) {
			const newWindow = window.open();
			if(newWindow) {
				try {
					newWindow.opener = null;
				} catch {
					// no-op, Electron can throw
				}
				newWindow.location.href = text;
			}
		}
		return;
	
	}

	// code and structure based on https://xtermjs.org/docs/guides/link-handling/ 
	removeLinkPopup(e,text,range) {
		if(this.linkpopup) {
			this.linkpopup.remove();
			this.linkpopup = undefined;
		}
	}

	// code and structure based on https://xtermjs.org/docs/guides/link-handling/ 
	showLinkPopup(e,text,range) {

		let oldlinkpopup = this.linkpopup;

		let scheme = text.split(":")[0];
		let path = text.slice(text.indexOf(":")+1);

		if(!this.supportedLinkScheme(scheme)) return;

		let popup = document.createElement('div');
		popup.classList.add('xterm-link-popup');
		popup.style.position = 'absolute';

		let poptext = document.createElement('span');
		popup.appendChild(poptext);
		if(scheme === "send") {
			path = decodeURIComponent(path);
			poptext.innerText = path;
		} else if (scheme === "prompt") {
			path = decodeURIComponent(path) + " ...";
			poptext.innerText = path;
		} else {
			poptext.innerText = text;
		}

		const topElement = e.target.parentNode;
		if(topElement !== null) {
			topElement.appendChild(popup);
		} else {
			document.getElementsByClassName("xterm-screen")[0].appendChild(popup);
		}

		popup.style.position = "fixed";
		popup.style.bottom = "var(--nerfbar-offsetHeight)";
		popup.style.right = "0px";
		popup.style.opacity = `0.5`;

		this.linkpopup = popup;

		setTimeout( 
			()=>{ if(this.linkpopup !== undefined) {
					this.linkpopup.style.opacity = "0";
				}
			}, 
			1000
		);
		if(oldlinkpopup !== undefined) {
			oldlinkpopup.remove();
		}
	}
}

export { OSC8Handler };
