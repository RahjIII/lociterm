// gmcp.js - generic mud communication protocol for lociterm
// Created: Wed Apr  3 05:34:00 PM EDT 2024
// $Id: gmcp.js,v 1.4 2024/05/11 17:20:21 malakai Exp $

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

import PackageData from '../package.json';

class GMCP {

	// register the supported modules here.
	supportsSet = [
		"Char.Login 1",
		"Loci.Hotkey 1"
	];

	modules = new Map();
	charLoginTypes = { type: [] };
	charLoginRequested = false;

	constructor(lociterm) {
		// Get us a path back to the parent terminal.
		this.lociterm = lociterm;
		this.enabled = false;

		// the keys MUST be in lower case!
		this.modules.set("core.enable",(m) => this.coreEnable(m));
		this.modules.set("core.disable",(m) => this.coreDisable(m));
		this.modules.set("char.login.default",(m) => this.charLoginDefault(m));
		this.modules.set("char.login.result",(m) => this.charLoginResult(m));
		this.modules.set("core.goodbye",(m) => this.coreGoodbye(m));
		this.modules.set("loci.hotkey.set",(m) => this.lociHotkeySet(m));
		this.modules.set("loci.hotkey.reset",(m) => this.lociHotkeyReset(m));
	}

	isEnabled() {
		return(this.enabled);
	}

	// parse out the module, and handle the message. 
	parse(module,message) {

		var fn = this.modules.get(module.toLowerCase());
		if(fn == undefined) {
			console.log("Unsupported module: " + module);
			return;
		}
		return( fn(message) );
	}
	
	send(module,obj) {
		if( true || this.isEnabled() ) {
			this.lociterm.doSendGMCP(module,obj);
		}
	}

	send_supports() {
		this.send("Core.Supports.Set",this.supportsSet);
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
		this.send_supports();
	}

	coreDisable(message) {
		console.log("GMCP Disabled.");
		this.enabled = false;
	}

	// this indicates a start of authentication request.
	charLoginDefault(message) {

		this.charLoginTypes = message;

		console.log("GMCP Login requested.");
		this.charLoginRequested = true;
		// check if the type is supported.
		if( (this.charLoginTypes.type != undefined) &&
			(this.charLoginTypes.type.indexOf('password-credentials') != -1)
		) {
			if(this.lociterm.menuhandler.getLoginUsername() != "") {
				if(this.lociterm.menuhandler.getLoginPassword() != "") {
					if(this.lociterm.menuhandler.getLoginAutologin() == true) {
					// ok to send.
					this.lociterm.menuhandler.sendlogin();
					} else {
						// open up the login window for manual login.
						this.lociterm.menuhandler.open("menu_loginbox")
					}
				} else {
					// open up the login window for password re-entry
					this.lociterm.menuhandler.open("menu_loginbox")
				}
			} else {
				// Cancel the login attempt, they never entered a username.
				// (Could open the window up here instead, but then newbies
				// would always experience a login window they couldn't use,
				// and oldbies who don't want to use the client login feature
				// would always have to dismiss it.  I think it plays better
				// leaveing gmcp login as a feature returning players enable.
				this.charLoginCancel({});
			}
		} else {
			// ooops we don't suppor that type.
			this.charLoginCancel({});
		}
	}

	// cancel the login attempt. 
	charLoginCancel(message) {
		if(this.charLoginRequested == true) {
			console.log("GMCP Login canceled.");
			this.send("Char.Login.Credentials",{});
			// No, don't forget about the request in case of a request.
			// this.charLoginRequested = false;
		}
	}

	charLoginResult(message) {
		// end the request. 
		this.charLoginRequested = false;

		if( (message.success != undefined) &&
			(message.success == false) 
		) {
			this.lociterm.menuhandler.voidLoginAutologin();
			console.log("GMCP Login Failed: " + message.message);
			this.lociterm.menuhandler.update_oob_message(
				`⛔ ${message.message}`
			);
		}
	}
	
	coreGoodbye(message) {
		this.lociterm.menuhandler.update_oob_message(
			`${message}`
		);
	}

	// send the name and login via GMCP
	sendCharLoginCredentials(account,password) {

		let obj = new Object();
		obj.account = account;
		obj.password = password;
		this.send("Char.Login.Credentials",obj);
	}

	// handle a loci.hotkey.set message.
	lociHotkeySet(message) {

		console.log("GMCP Loci.Hotkey.Set requested.");

		let id = `hotkey_${message.name}`;

		let item = document.getElementById(id);
		if(item == undefined) {
			console.log(`GMCP Loci.Hotkey.Set can't find id ${id}`);
			return;
		}

		if(message.label != undefined) {
			item.innerText = message.label;
		}

		return;
	}

	lociHotkeyReset(message) {

		if(message.name != undefined) {
			let id = `hotkey_${message.name}`;
			let item = document.getElementById(id);
			if(item == undefined) {
				console.log(`GMCP Loci.Hotkey.Reset can't find id ${id}`);
				return;
			}
			let defaults = this.lociterm.menuhandler.hotkeys[id];
			if(defaults == undefined) {
				console.log(`GMCP Loci.Hotkey.Reset can't find defaults for id ${id}`);
				return;
			}
			item.innerText = defaults.label;
			return;
		} else {
			// reset everthing.
			for (let id in this.lociterm.menuhandler.hotkeys ) {
				let defaults = this.lociterm.menuhandler.hotkeys[id];
				let item = document.getElementById(id);
				item.innerText = defaults.label;
			}
		}
	} 

}

export { GMCP };
