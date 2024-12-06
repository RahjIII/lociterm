// hotkey.js - LociTerm local hotkey module.  
// see also, loci_hotkey.js in the gmcp directory.
// Created: Sun Dec  1 09:40:54 AM EST 2024
// $Id: hotkey.js,v 1.1 2024/12/06 04:59:51 malakai Exp $

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
//

class HotkeyHandler {
	
	constructor(lociterm) {

		this.lociterm = lociterm;

		// this is for setting up and restoring the default values.
		this.hotkey_defaults = [
			{ id: 'f1'  , label: 'Key F1',   seq: '\x1BOP' },
			{ id: 'f2'  , label: 'Key F2',   seq: '\x1BOQ' },
			{ id: 'f3'  , label: 'Key F3',   seq: '\x1BOR' },
			{ id: 'f4'  , label: 'Key F4',   seq: '\x1BOS' },
			{ id: 'f5'  , label: 'Key F5',   seq: '\x1B[15~' },
			{ id: 'f6'  , label: 'Key F6',   seq: '\x1B[17~' },
			{ id: 'f7'  , label: 'Key F7',   seq: '\x1B[18~' },
			{ id: 'f8'  , label: 'Key F8',   seq: '\x1B[19~' },
			{ id: 'f9'  , label: 'Key F9',   seq: '\x1B[20~' },
			{ id: 'f10' , label: 'Key F10',  seq: '\x1B[21~' },
			{ id: 'f11' , label: 'Key F11',  seq: '\x1B[23~' },
			{ id: 'f12' , label: 'Key F12',  seq: '\x1B[24~' },
			{ id: 'f13' , label: 'Key F13',  seq: '\x1B[25~' },
			{ id: 'f14' , label: 'Key F14',  seq: '\x1B[26~' },
			{ id: 'f15' , label: 'Key F15',  seq: '\x1B[28~' },
			{ id: 'f16' , label: 'Key F16',  seq: '\x1B[29~' },
			{ id: 'f17' , label: 'Key F17',  seq: '\x1B[31~' },
			{ id: 'f18' , label: 'Key F18',  seq: '\x1B[32~' },
			{ id: 'f19' , label: 'Key F19',  seq: '\x1B[33~' },
			{ id: 'f20' , label: 'Key F20',  seq: '\x1B[34~' },
			{ id: 'pgup', label: 'Key PgUp', seq: '\x1B[5~'  },
			{ id: 'pgdn', label: 'Key PgDn', seq: '\x1B[6~'  },
			{ id: 'home', label: 'Key Home', seq: '\x1B[7~'  },
			{ id: 'end' , label: 'Key End' , seq: '\x1B[8~'  }
		];

		// Set some additional across the board defaults.
		this.hotkey_defaults.forEach(
			(i)=>{
				i.macro = "";
				i.sends = "seq";
			}
		);

		// Create a backwards map, seq to key id
		this.seqToKey = new Map();
		this.hotkey_defaults.forEach( (i)=>{ this.seqToKey.set(i.seq, i.id); });

		// this is the user's saved hotkey array.  It transfers from the active
		// hotkey array below when 'save' is hit in the editor.   It is saved
		// in localStorage.
		this.hotkey_user = this.loadLocal();

		// this is the active hotkey definition array.  Dynamic updates and
		// user saves go here first, and it is saved in sessionStorage.
		this.hotkey = this.loadSession();

	}

	// Uses menhandler.js calls to create a hotkey editor.
	createEditorDiv(id="sys_hotkey_editor") {

		let mh = this.lociterm.menuhandler;
		let l;

		let ret = mh.create_generic_window( 
			id,
			"Hotkey Editor",
			(()=>{this.lociterm.menuhandler.done();})
		);
		let overlay = ret[0];
		let content = ret[1];

		mh.mydiv.appendChild(overlay);
		mh.openHandler.set(id,(id)=>{
			this.updateHotkeySelector(id);
			this.updateToEditor(id)
		});
		
		l = mh.create_generic_selector(	
			`${id}_select`,
			"Hotkey", 
			this.hotkey_defaults,
			((e)=>{ this.updateToEditor(id); })
		)
		content.appendChild(l);

		l = mh.create_generic_input(
			`${id}_label`,
			"Menu Label",
			"text",
			"(Not Labeled)",
			//((e)=>{ this.updateFromEditor(id); })
		);
		l.classList.add('hotkeylabel');
		content.appendChild(l);


		l = mh.create_generic_select(
			`${id}_sends`,
			"Terminal Sends",
			//((e)=>{ this.updateFromEditor(id); }),
			{},
			{"seq": "Keycode", "macro":"Macro"}
		);
		content.appendChild(l);


		l = mh.create_generic_textarea(
			`${id}_macro`,
			"Macro Text",
			"text",
			"(Send Keycode)",
			//((e)=>{ this.updateFromEditor(id); })
		);
		l.classList.add('hotkeymacro');
		l.children[1].setAttribute("rows","3");
		l.children[1].setAttribute("autocaptialize","off");
		content.appendChild(l);

		l = mh.create_generic_button(
			`${id}_update`,
			"Update",
			"submit",
			(()=>{
				this.updateFromEditor(id);
				this.lociterm.menuhandler.done();
			})
		);
		content.appendChild(l);

		l = mh.create_generic_button(
			`${id}_done`,
			"Save",
			"submit",
			(()=>{
				this.updateFromEditor(id,true);
				this.saveLocal();
				this.lociterm.menuhandler.done();
			})
		);
		content.appendChild(l);

		return(overlay);
	}

	// called whenever a label may have changed, so that it shows up in the
	// dropdown selector.
	updateHotkeySelector(id="sys_hotkey_editor") {
		let select = document.getElementById(`${id}_select`);
		while(select.children[0] != undefined) {
			select.children[0].remove();
		}

		for(let i=0; i<this.hotkey.length; i++) {
			let l = document.createElement('option');
			select.appendChild(l);
			l.setAttribute("value",i);
			if ( this.hotkey[i].label !== this.hotkey_defaults[i].label ) {
				l.innerText = `${this.hotkey_defaults[i].label} - ${this.hotkey[i].label}`;
			} else {
				l.innerText = `${this.hotkey_defaults[i].label}`;
			}
		}
	}

	// Called when the user hits the update button OR the save button from the
	// editor.
	updateFromEditor(id="sys_hotkey_editor",save=false) {
		let select = document.getElementById(`${id}_select`);
		let label = document.getElementById(`${id}_label`);
		let macro = document.getElementById(`${id}_macro`);
		let sends = document.getElementById(`${id}_sends`);
		let keyid = this.hotkey[select.value].id;
		let fullkey = this.hotkey[select.value];

		if(label.value === "") {
			if(macro.value !== "") {
				label.value = macro.value.split("\n")[0].slice(0,15);
				if(macro.value.split("\n").length > 1) {
					label.value += "…";
				}
			} else {
				label.value = this.hotkey_defaults[select.value].label;
			}
		}
		this.setParam(keyid,"label",label.value);
		this.setParam(keyid,"macro",macro.value);
		this.setParam(keyid,"sends",sends.value);
		this.lociterm.gmcp.mod("LociHotkey").sendSet(fullkey);

		this.saveSession();
		if(save === true) {
			this.hotkey_user[select.value] = structuredClone(fullkey);
			this.saveLocal();
		}

	}

	// Used to fill the fields when the selection changes.
	updateToEditor(id="sys_hotkey_editor") {
		let idx = document.getElementById(`${id}_select`).value;

		let label = document.getElementById(`${id}_label`);
		let macro = document.getElementById(`${id}_macro`);
		let sends = document.getElementById(`${id}_sends`);

		let keyid = this.hotkey[idx].id;

		label.value = this.getParam(keyid,"label");
		macro.value = this.getParam(keyid,"macro");
		sends.value = this.getParam(keyid,"sends");
	}


	// returns in array index for the id's definition. or -1.
	keyIdx(id) {
		return(this.hotkey_defaults.findIndex((x)=>{return(x.id.toLowerCase()===id)}));
	}

	// hard reset of active to default keyset.
	resetKeyDefaults(id) {
		let idx = this.keyIdx(id);
		if(idx !== -1) {
			this.hotkey[idx] = this.hotkey_defaults[idx];
		}
	}

	// Loads up the users saved set of keystrokes (or the default if none
	// saved.)
	reset() {  
		this.hotkey = this.loadLocal();
		this.setLabels();
		this.updateHotkeySelector();
	}

	// Update any item in the dom (menu buttons, presumably) with a class of id
	// to have the appropriate innerText.  This is maybe a little too sloppy,
	// and the class name added to the button should be something a little
	// longer.  Change if it becomes a problem.
	setLabel(id,label) {
		let idx = this.keyIdx(id);
		if(idx !== -1) {
			this.hotkey[idx].label = label;
		}
		// got to find any dom nodes with the matching class to update.
		let items = document.getElementsByClassName(this.hotkey[idx].id);
		for(let i=0;i<items.length;i++) {
			items[i].innerText = label;
		}
	}

	getLabel(id) {
		let idx = this.keyIdx(id);
		if(idx !== -1) {
			return(this.hotkey[idx].label);
		} 
		return(id);
	}

	// Set all the labels in the dom.
	setLabels() {
		this.hotkey.forEach(
			(x)=>{ this.setLabel(x.id,x.label); }
		);
	}

	setParam(id,param,value) {
		let idx = this.keyIdx(id);
		if (idx === -1) return;
		this.hotkey[idx][param] = value;
		if(param == "label")  {
			this.setLabel(id,value);
		}
	}

	getParam(id,param,value) {
		let idx = this.keyIdx(id);
		if (idx === -1) return;
		return(this.hotkey[idx][param]);
	}
		

	// send hotkey bytes directly to the terminal, or route a hotkey's "send"
	// definition through the nerfbar infrastructure.  This is suitable for
	// inclusion as a menu click handler.
	sendKey(id) {
		this.lociterm.menuhandler.done();  // close the hotkey menu.

		let idx = this.keyIdx(id);
		if(idx === -1) {
			console.warn(`Unknown hotkey id '${id}'.`);
			return;
		}

		let key = this.hotkey[idx];

		// if it has a .macro value, route that through the terminal or nerfbar.
		if( (key.sends === "macro") &&
			(key.macro !== "") 
		) {
			let msg = key.macro;
			if( msg.endsWith("\n") === false ) {
				// make sure the macro always ends in a \n even if user didn't
				// include one.  But don't duplicate it if they did.
				msg = msg + "\n";
			}
			// Note that the nerfbar could be open in any echo mode, and if it
			// is open, the hotkey should be routed through it so that the
			// hotkey shows up in arrow history.
			if (this.lociterm.nerfbar.nerfstate === 'active') {
				this.lociterm.nerfbar.paste(msg);
			} else {
				this.lociterm.paste(msg);
			}
		} else {  
			// there is only a vt key seq, no macro, which technically, you
			// shouldn't be sending in line mode, because it doesn't end in
			// '\n'.  So there should be a true line-mode check here I suppose.
			// Maybe later.
			this.lociterm.paste(key.seq);
		}
	}

	// return the name of the function key from the xterm sequence map.
	idFromSeq(seq="") {
		return( this.hotkey.filter((x)=>{return(x.seq===seq)}).map((x)=>{x.id})[0] );
	}

	// Save the user hotkeys in the localstorage.
	saveLocal() {
		localStorage.setItem("hotkey",JSON.stringify(this.hotkey_user));
	};

	// Load the user hotkeys from the localstorage.
	loadLocal() {
		let data = JSON.parse(localStorage.getItem("hotkey"));
		if(data === null) {
			return( structuredClone(this.hotkey_defaults));
		}
		return(data);
	}

	// Save the active hotkeys in session storage.
	saveSession() {
		sessionStorage.setItem("hotkey",JSON.stringify(this.hotkey));
	};

	// Load the active hotkeys from session storage.
	loadSession() {
		let data = JSON.parse(sessionStorage.getItem("hotkey"));
		if(data === null) {
			return( structuredClone(this.hotkey_user));
		}
		return(data);
	}

}

export { HotkeyHandler };
