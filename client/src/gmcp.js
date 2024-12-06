// gmcp.js - generic mud communication protocol for lociterm
// Created: Wed Apr  3 05:34:00 PM EDT 2024
// $Id: gmcp.js,v 1.11 2024/12/06 04:59:51 malakai Exp $

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
// This is a gmcp protocol handler class for lociterm.  It includes hooks for
// handling some of the Core functionality, and for loading up other modules
// out of the gmcp source directory.

import PackageData from '../package.json';
import { LociHotkey } from './gmcp/loci_hotkey.js';
import { LociMenu } from './gmcp/loci_menu.js';
import { CharLogin } from './gmcp/char_login.js';

class GMCP {

	module = [];
	supportsSet = [];
	command = new Map(); // A map of registered command handlers

	constructor(lociterm) {
		// Get us a path back to the parent terminal.
		this.lociterm = lociterm;
		this.enabled = false;

		// These are the GMCP commands that the client knows how to respond to.
		// the keys MUST be in lower case!
		this.addCommand("core.enable",(m) => this.coreEnable(m));
		this.addCommand("core.disable",(m) => this.coreDisable(m));
		this.addCommand("core.goodbye",(m) => this.coreGoodbye(m));

		this.initModule(new CharLogin(this));
		this.initModule(new LociHotkey(this));
		this.initModule(new LociMenu(this));

	}

	mod(name) {
		return(this.module[name])
	}

	initModule(mod) {
		this.supportsSet.push(`${mod.moduleName} ${mod.moduleVersion}`);
		let modname = mod.codeName;
		this.module[modname] = mod;
	}

	isEnabled() {
		return(this.enabled);
	}

	addCommand(command,fn) {
		// ensure the command gets added to the map in lower case.
		this.command.set(command.toLowerCase(),fn);
	}

	// parse out the module, and handle the message. 
	parse(module,message) {

		var fn = this.command.get(module.toLowerCase());
		if(fn == undefined) {
			console.warn("Unsupported module: " + module);
			return;
		}
		return( fn(message) );
	}
	
	send(module,obj) {
		if( true || this.isEnabled() ) {
			this.lociterm.doSendGMCP(module,obj);
		}
	}

	sendSupports() {
		if(this.enabled === false) return;

		console.log(`Core.Supports.Set ${this.supportsSet}`);
		this.send("Core.Supports.Set",this.supportsSet);

		for (const [key, module] of Object.entries(this.module)) {
			if( module.init !== undefined ) {
				module.init();
			}
		}
	}

	coreEnable(message) {
		console.log("GMCP Enabled.");
		this.enabled = true;
		// send client hello
		let obj = new Object();
		obj.client = `${PackageData.name}`
		obj.version = `${PackageData.version}`
		this.send("Core.Hello",obj);
		// send the supports list.
		this.sendSupports();
	}

	coreGoodbye(message) {
		for (const [key, module] of Object.entries(this.module)) {
			if( module.goodbye !== undefined ) {
				module.goodbye(message);
			}
		}
		this.charLoginRequested = false;
		this.lociterm.menuhandler.update_oob_message(
			`${message}`
		);
	}

	coreDisable(message) {
		console.log("GMCP Disabled.");
		this.enabled = false;
	}

}

export { GMCP };
