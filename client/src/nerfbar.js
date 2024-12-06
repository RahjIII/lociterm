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
			this.mydiv = document.createElement('div');
			this.mydiv.id='elementid';
			this.lociterm.mydiv.appendChild(this.mydiv);
		}
		this.mydiv.classList.add('nerfbar');
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
		input.setAttribute("autococorrect","off");
		input.placeholder = "Enter a command...";
		//
		input.setAttribute("aria-multiline","false");
		input.setAttribute("rows","1");
		//
		input.id = "nerfinput";

		this.focuselement = input;

		// No, not on change anymore.
		// input.onchange = ((e)=>{ return; })

		input.onfocus = ((e)=> {
			this.lociterm.menuhandler.done();
		});

		input.onkeydown = ((e)=>{
			// e.keyCode==13 works in android IME.  e.code=="Enter" does not.
			if((e.code == "Enter") || (e.keyCode == 13)) {
				this.history_add(e.srcElement.value);
				this.lociterm.paste(e.srcElement.value+"\n");
				e.srcElement.value = "";
				// this.focus();
				e.preventDefault();
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

		});

		// History up button
		sendkey = document.createElement('div');
		sendkey.classList.add('nerfbutton');
		sendkey.setAttribute("type","button");
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
		btn.style.display = "none";
		btn.onclick = ((e)=>{ this.setHiddenMode(false); });
		btn.innerText = "👁︎";
		box.appendChild(btn);
		this.revealbtn = btn;

		// wordstack paste button
		btn = document.createElement('div');
		btn.classList.add('nerfbutton');
		btn.setAttribute("type","button");
		btn.onclick = ((e)=>{ this.lociterm.wordstack.toggleMenu(); });
		btn.innerText = "📋︎";
		box.appendChild(btn);

		// Enter key button.
		sendkey = document.createElement('div');
		sendkey.classList.add('nerfbutton');
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
		this.mydiv.style.display= 
			getComputedStyle(document.documentElement).getPropertyValue('--nerfbar-open-display');
		this.lociterm.fitAddon.fit();
		this.lociterm.doWindowResize();
		this.nerfstate = "active";
		document.documentElement.style.setProperty('--nerfbar-offsetHeight', `${this.mydiv.offsetHeight}px`);
		this.lociterm.keyboardEnable(false);
	}

	// make the nerfbar DIE DIE DIE. I hate you, nerfbar.
	close() {
		this.mydiv.style.display=
			getComputedStyle(document.documentElement).getPropertyValue('--nerfbar-close-display');
		this.lociterm.fitAddon.fit();
		this.lociterm.doWindowResize();
		this.nerfstate = "inactive";
		this.mydiv.style.opacity = "";
		document.documentElement.style.setProperty('--nerfbar-offsetHeight', `${this.mydiv.offsetHeight}px`);
		this.lociterm.keyboardEnable(true);
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
			return("");
		} 
		return(ret);
	}

	paste(data) {
		if( data.endsWith('\n') === true ) {
			// strip the \n before putting it in the nerfbar
			data = data.slice(0,-1);
			this.focuselement.value += data;
			// and simulate an enter key event in nerfbar.
			const kev = new KeyboardEvent('keydown', {
				key: 'Enter',
				code: 'Enter',
				which: 13,
				keyCode: 13
			});
			this.focuselement.dispatchEvent(kev);
		} else {
			// Just add it to the nerfbar.
			this.focuselement.value += data;
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
			this.focuselement.style.color = "revert";
			this.focuselement.style.textShadow = "unset";
			this.focuselement.placeholder = "Enter a command...";
		}
	}

}

export { NerfBar };
