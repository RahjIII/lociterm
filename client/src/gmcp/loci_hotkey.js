// loci_hotkey.js - The Lociterm Hotkey GMCP protocol
// Created: Wed Apr  3 05:34:00 PM EDT 2024
// $Id: loci_hotkey.js,v 1.1 2024/12/06 04:59:51 malakai Exp $

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
// This is a gmcp protocol handler class for lociterm, and it includes hooks
// for handling Char.Login password-credentials type.

class LociHotkey {

	gmcp = undefined;

	constructor(gmcp) {

		this.codeName = "LociHotkey";
		this.moduleName = "Loci.Hotkey";
		this.moduleVersion  = "2";
	
		// Get us a path back to the parent
		this.gmcp = gmcp;

		// Init the module callbacks. 
		this.gmcp.addCommand("loci.hotkey.set",(m)=>this.hotkeySet(m));
		this.gmcp.addCommand("loci.hotkey.reset",(m)=>this.hotkeyReset(m));

	}

	init() {  
		this.sendGet();
	}

	goodbye() { 
		this.hotkeyReset();
	}

	// module local functions.

	// generate a loci.hotkey.get message.
	sendGet() {
		this.gmcp.send("Loci.Hotkey.Get",{});
	}

	sendSet(key) {
		if(this.gmcp.enabled === false) return;
		if(key.id === undefined) return;

		let msg = {};
		// note the variable name difference, name vs id
		msg.name = key.id;
		if(key.label !== undefined) { 
			msg.label = key.label;
		}
		if(key.macro !== undefined) { 
			msg.macro = key.macro;
		}
		if(key.sends !== undefined) { 
			msg.sends = key.sends;
		}
		this.gmcp.send("Loci.Hotkey.Edit",msg);
	}

	// handle a loci.hotkey.set message.
	hotkeySet(message) {

		let lociterm = this.gmcp.lociterm;
		let key = message.name;

		if(message.label != undefined) {
			lociterm.hotkey.setLabel(key,message.label);
		}
		if(message.macro != undefined) {
			lociterm.hotkey.setParam(key,"macro",message.macro);
		} else {
			lociterm.hotkey.setParam(key,"macro","");
		}
		if(message.sends != undefined) {
			lociterm.hotkey.setParam(key,"sends",message.sends);
		} else {
			lociterm.hotkey.setParam(key,"sends","seq");
		}
		return;
	}

	hotkeyReset(message={}) {
		let lociterm = this.gmcp.lociterm;
		lociterm.hotkey.reset();
	} 
}

export { LociHotkey };
