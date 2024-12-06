// char_login.js - A GMCP Char.Login module for Lociterm
// Created: Wed Apr  3 05:34:00 PM EDT 2024
// $Id: char_login.js,v 1.1 2024/12/06 04:59:51 malakai Exp $

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

class CharLogin {


	constructor(gmcp) {
		// Get us a path back to the parent
		this.gmcp = gmcp;

		this.codeName = "CharLogin"; 
		this.moduleName = "Char.Login"; 
		this.moduleVersion  = "1";

		this.charLoginTypes = { type: [] };
		this.charLoginRequested = false;
	
		// Init the module callbacks.  The m variable is the JSON object
		// corresponding to the GMCP message.
		this.gmcp.addCommand("char.login.default",(m) => this.charLoginDefault(m));
		this.gmcp.addCommand("char.login.result",(m) => this.charLoginResult(m));

	}

	init() {
	}

	goodbye() { 
	}

	// Functions called by gmcp.addCommand handler should go here.
	// this indicates a start of authentication request.
	charLoginDefault(message) {

		let lociterm = this.gmcp.lociterm;
		this.charLoginTypes = message;

		console.log("GMCP Login requested.");
		this.charLoginRequested = true;
		// check if the type is supported.
		if( (this.charLoginTypes.type != undefined) &&
			(this.charLoginTypes.type.indexOf('password-credentials') != -1)
		) {
			if(lociterm.menuhandler.getLoginUsername() != "") {
				if(lociterm.menuhandler.getLoginPassword() != "") {
					if(lociterm.menuhandler.getLoginAutologin() == true) {
					// ok to send.
					lociterm.menuhandler.sendlogin();
					} else {
						// open up the login window for manual login.
						lociterm.menuhandler.open("sys_loginbox")
					}
				} else {
					// open up the login window for password re-entry
					lociterm.menuhandler.open("sys_loginbox")
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
			// ooops we don't support that type.
			this.charLoginCancel({});
		}
	}

	charLoginResult(message) {
		// end the request. 
		let lociterm = this.gmcp.lociterm;

		if( (message.success != undefined) &&
			(message.success == false) 
		) {
			lociterm.menuhandler.voidLoginAutologin();
			console.log("GMCP Login Failed: " + message.message);
			lociterm.menuhandler.update_oob_message(
				`⛔ ${message.message}`
			);
		}
	}
	

	// Put functions to be called directly by other parts of lociterm here.

	// cancel the login attempt. 
	charLoginCancel(message) {
		if(this.charLoginRequested == true) {
			console.log("GMCP Login canceled.");
			this.gmcp.send("Char.Login.Credentials",{});
			// No, don't forget about the request in case of a request.
			// this.charLoginRequested = false;
		}
	}

	// send the name and login via GMCP
	sendCharLoginCredentials(account,password) {

		let obj = new Object();
		obj.account = account;
		obj.password = password;
		this.gmcp.send("Char.Login.Credentials",obj);
	}

}

export { CharLogin };
