// nerfbar.js - pitiful line mode support
// Created: Mon 26 Dec 2022 11:55:45 PM EST
// $Id: nerfbar.js,v 1.8 2024/12/06 04:59:51 malakai Exp $

// Copyright © 2023 Jeff Jahr <malakai@jeffrika.com>
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
// Eventually, this may become a "line mode editor" option for the web client.
// Right now it is a simple work in progress.

class NerfBar {

	constructor(lociterm,elementid) {

		this.historybuf = [];
		this.historyoffset = 0;
		this.historymax = 25;
		this.hiddenMode = false;

		this.lociterm = lociterm;
		if ((this.mydiv = document.getElementById(elementid)) == undefined) {
			this.mydiv.id='elementid';
			this.lociterm.mydiv.appendChild(this.mydiv);
		}
		this.mydiv.classList.add('nerfbar');
		this.mydiv.setAttribute("aria-label","Line Input Bar");
		this.focuselement = "";
		this.revealbtn = "";
		this.create_nerfbar();
		document.documentElement.style.setProperty(
			'--nerfbar-offsetHeight', 
			`${this.mydiv.offsetHeight}px`
		);
		this.setHiddenMode(this.hiddenMode);
	}

	// Add the NerfBar definition to the DOM.
	create_nerfbar() {
		let box = this.mydiv;
		let label;
		let input;
		let sendkey;
		let tabkey;
		let btn;

		
		//input = document.createElement('input');
		//input.setAttribute("type","text");
		input = document.createElement('textarea');
		input.setAttribute("name","nerfinput");
		input.setAttribute("autocapitalize","none");
		input.setAttribute("autocomplete","off");
		input.setAttribute("autocorrect","off");
		input.placeholder = "Enter a command...";
		//
		input.setAttribute("aria-label","Line Mode Input");
		input.setAttribute("aria-multiline","false");
		input.setAttribute("rows","1");
		//
		input.id = "nerfinput";

		this.focuselement = input;

		input.onfocus = ((e)=> {
			e.srcElement.classList.remove('nerfbarblur');
			this.lociterm.menuhandler.lastFocusedBoxButton = undefined;
			this.lociterm.menuhandler.done();
		});

		input.onblur = ((e)=> {
			e.srcElement.classList.add('nerfbarblur');
		});

		// This is the primary command dispatch routing for the nerfbar.  You
		// want to process the text in the nerfbar element, you inject an enter
		// key event.
		input.onkeydown = ((e)=>{
			// e.keyCode==13 works in android IME.  e.code=="Enter" does not.
			if((e.code == "Enter") || (e.keyCode == 13)) {
				// add the pre-parsed value into the history.
				this.history_add(e.srcElement.value);
				let line = this.preparse(e.srcElement.value)

				// This brief focus to the terminal, followed by a steal back
				// is to trigger the terminals onBlur() registrations,
				// specifially to clear out the xterm.js
				// AccessibilityMananger's live-area div, so that it can take
				// new fresh input for a screen reader.  If there was a method
				// provided by xterm.js for it, we'd do that, but there is not.
				// So this.
				let active = document.activeElement;
				this.lociterm.terminal.focus();
				active.focus();
				//
				this.lociterm.paste(line+"\n");
				if (this.lociterm.pref.get("nerf.keepCommandSelected")) {
					// Don't use e.srcElement.select() here.  It tries to mess
					// with the focus() activeElement, which cauases problems
					// with the virtualKeyboard.
					e.srcElement.selectionStart = 0;
					e.srcElement.selectionEnd = e.srcElement.value.length;
				} else {
					e.srcElement.value = "";
				}
				e.preventDefault();
			}
			// Alt+R: Fast Reconnect from NerfBar
			if ((e.key === "r" || e.key === "R") && e.altKey === true) {
				this.lociterm.disconnect("remoteRestart");
				e.preventDefault();
				return;
			}
			// ArrowUp = 38
			if((e.code == "ArrowUp") || (e.keyCode == 38)) {
				e.srcElement.value = this.history_roll(1);
				// this.focus();
				e.preventDefault();
			}
			// ArrowDown = 40
			if((e.code == "ArrowDown") || (e.keyCode == 40)) {
				e.srcElement.value = this.history_roll(-1);
				// this.focus();
				e.preventDefault();
			}
			if((e.code == "KeyM") && (e.ctrlKey === true)) {
				this.lociterm.menuhandler.focusMainMenu();
			}
		});

		// History up button
		sendkey = document.createElement('div');
		sendkey.classList.add('nerfbutton');
		sendkey.setAttribute("type","button");
		sendkey.setAttribute("aria-label","History Up");
		sendkey.setAttribute("role","button");
		sendkey.setAttribute("aria-hidden","true");
		sendkey.onclick = ((e)=>{
			const kev = new KeyboardEvent('keydown', {
				key: 'ArrowUp',
				code: 'ArrowUp',
				which: 38,
				keyCode: 38
			});
			input.dispatchEvent(kev);
			e.preventDefault();
			// this.focus();
		});
		sendkey.innerText = "▲";
		box.appendChild(sendkey);

		// History down button
		sendkey = document.createElement('div');
		sendkey.classList.add('nerfbutton');
		sendkey.setAttribute("type","button");
		sendkey.setAttribute("aria-label","History Down");
		sendkey.setAttribute("aria-hidden","true");
		sendkey.setAttribute("role","button");
		sendkey.onclick = ((e)=>{
			const kev = new KeyboardEvent('keydown', {
				key: 'ArrowDown',
				code: 'ArrowDown',
				which: 40,
				keyCode: 40
			});
			input.dispatchEvent(kev);
			e.preventDefault();
			// this.focus();
		});
		sendkey.innerText = "▼";
		box.appendChild(sendkey);

		// Now append the input.
		box.appendChild(input);


		// password reveal button
		btn = document.createElement('div');
		btn.classList.add('nerfbutton');
		btn.setAttribute("type","button");
		btn.setAttribute("role","button");
		btn.setAttribute("aria-hidden","true");
		btn.style.display = "none";
		btn.onclick = ((e)=>{ this.setHiddenMode(false); });
		btn.innerText = "👁︎";
		box.appendChild(btn);
		this.revealbtn = btn;

		// wordstack paste button
		btn = document.createElement('div');
		btn.classList.add('nerfbutton');
		btn.setAttribute("type","button");
		btn.setAttribute("aria-label","Open Wordstack");
		btn.setAttribute("role","button");
		btn.setAttribute("aria-hidden","true");
		btn.onclick = ((e)=>{ this.lociterm.wordstack.toggleMenu(); });
		btn.innerText = "📋︎";
		box.appendChild(btn);

		// Enter key button.
		sendkey = document.createElement('div');
		sendkey.classList.add('nerfbutton');
		sendkey.setAttribute("aria-label","Send Command");
		sendkey.setAttribute("role","button");
		sendkey.setAttribute("aria-hidden","true");
		sendkey.onclick = ((e)=>{
			const kev = new KeyboardEvent('keydown', {
				key: 'Enter',
				code: 'Enter',
				which: 13,
				keyCode: 13
			});
			input.dispatchEvent(kev);
			e.preventDefault();
			// this.focus();
		});
		sendkey.innerText = "↵";
		box.appendChild(sendkey);

		return(box);
	}

	// make the nerfbar appear.
	open() {
		if( this.nerfstate === "active" ) return;
		this.mydiv.style.display= 
			getComputedStyle(document.documentElement).getPropertyValue('--nerfbar-open-display');
		this.nerfstate = "active";
		document.documentElement.style.setProperty('--nerfbar-offsetHeight', `${this.mydiv.offsetHeight}px`);
		this.lociterm.keyboardEnable(false);
		this.lociterm.fitAddon.fit();
		this.lociterm.onWindowResize();
	}

	// make the nerfbar DIE DIE DIE. I hate you, nerfbar.
	close() {
		if( this.nerfstate === "inactive" ) return;
		this.mydiv.style.display=
			getComputedStyle(document.documentElement).getPropertyValue('--nerfbar-close-display');
		this.nerfstate = "inactive";
		this.mydiv.style.opacity = "";
		document.documentElement.style.setProperty('--nerfbar-offsetHeight', `${this.mydiv.offsetHeight}px`);
		this.lociterm.keyboardEnable(true);
		this.lociterm.fitAddon.fit();
		this.lociterm.onWindowResize();
	}

	nofade() {
		this.mydiv.style.opacity = "1.0";
	}


	focus() {
		this.focuselement.focus();
	}

	history_add(line) {

		if(this.hiddenMode === true) {
			// don't add to the history roll if the hiddenMode is on.
			return;
		}

		let lastline = this.historybuf[this.historybuf.length -1];
		if(lastline != line) {
			this.historybuf.push(line);
			if(this.historybuf.length > this.historymax) {
				this.historybuf = this.historybuf.slice(1);
			}
		}
		this.historyoffset = this.historybuf.length;
	}

	history_roll(direction) {
		this.historyoffset -= direction;
		if(this.historyoffset >= this.historybuf.length) {
			this.historyoffset = this.historybuf.length;
		} else if(this.historyoffset < 0) {
			this.historyoffset = 0;
		}
		let ret = this.historybuf[this.historyoffset];
		if(ret == undefined) {
			this.focus();
			return("");
		} 
		return(ret);
	}

	// this is called to inject data into the nerfbar, as from a menu button or
	// the wordstack.  Ensures that button/menu selections make it into the
	// nerfbar history.
	paste(data) {
		let nl = false;
		if( data.endsWith('\n') === true ) {
			// strip the \n and set the nl flag
			data = data.slice(0,-1);
			nl = true;
		}

		let t= this.focuselement;
		if(t.selectionStart != t.selectionEnd) {
			// something in that line in selected. Replace that with the data.
			// You might think that setSelectionRange() would be great here,
			// but it wants to mess with focus() of activeElement, which has
			// bad interactions with virtualKeyboard.
			t.value = 
				t.value.slice(0,t.selectionStart) +
				data +
				t.value.slice(t.selectionEnd);
		} else {
			// nothing selected, but cursor on line somewhere.  append to
			// input. 
			t.value += data;
		}
		
		// if the nl flag was set, send the nerfbar contents.
		if(nl) {
			const kev = new KeyboardEvent('keydown', {
				key: 'Enter',
				code: 'Enter',
				which: 13,
				keyCode: 13
			});
			this.focuselement.dispatchEvent(kev);
		}
	}

	setHiddenMode( mode ) {
		this.hiddenMode = mode;
		if(mode === true) {
			this.revealbtn.style.display = "flex";
			this.focuselement.style.color = "transparent";
			this.focuselement.style.textShadow = "0 0 8px black";
			this.focuselement.placeholder = "Enter hidden text...";
		} else {
			this.revealbtn.style.display = "none";
			this.focuselement.style.removeProperty('color');
			this.focuselement.style.removeProperty('textShadow');
			this.focuselement.placeholder = "Enter a command...";
		}
	}

	// pre-process a line of input (presumably from the nerfbar) and modify it
	// as needed.  Added to support "command chaining" via the ; character like
	// some other clients do, because it turns out that whole families of MUDs
	// don't support this basic operation in server.  
	preparse ( cmd ) {

		// could add a global 'disable' check here, and just return cmd as is.
		if(this.lociterm.pref.get("nerf.chaining") !== true ) {
			return(cmd);
		}

		let out = cmd;
		// entire command is to be sent verbatim, no pre-processing.
		if (cmd[0] == "\\") {
			return(out.slice(1));
		}
	
		// this would indicate a command to the client, a-la tintin, were you
		// to support that.
		if (cmd[0] == "#") {
		}

		// could probably put a local alias substitution here.  Probably there
		// is whole subset of really crappy MUD servers that don't provide that
		// either.

		// turn unescaped ;'s directly into newlines.
		out = out.replaceAll(";","\n");
		out = out.replaceAll("\\\n",";");
		return(out);
	}

}

export { NerfBar };
