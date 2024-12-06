// template.js - An empty Lociterm GMCP module template.
// Created: Wed Apr  3 05:34:00 PM EDT 2024
// $Id: template.js,v 1.1 2024/12/06 04:59:51 malakai Exp $

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

class EmptyTemplate {

	constructor(gmcp) {
		// Get us a path back to the parent
		this.gmcp = gmcp;

		this.codeName = "EmptyTemplate";  // Required!
		this.moduleName = "Empty.Template";  // Required!
		this.moduleVersion  = "1";           // Required!
	
		// Init the module callbacks.  The m variable is the JSON object
		// corresponding to the GMCP message.
		this.gmcp.addCommand("empty.template.set",(m)=>this.templateSet(m));
		this.gmcp.addCommand("empty.template.get",(m)=>this.sendGet(m));
		// ... add as many as you need, and define them later in this file.

	}

	init() {  // Required!
		// will be called just *after* gmcp sends a Core.Supports message,
		// which MAY happen more than once.  (Consider additional calls to be a
		// re-init of the protocol.)
	}

	goodbye() { // Required!
		// will be called on reciept of core.goodbye. Can be used to clean up
		// any held state.
	}

	// Functions called by gmcp.addCommand handler should go here.

	// generate a empty.template.set message. Its a useful convention to name
	// functions that will send a GMCP message back to the server with a send
	// prefix.
	sendGet() {
		this.gmcp.send("Empty.Template.Get",{});
	}

	// handle a empty.template.set message.
	templateSet(message) {
		// Note the path back to the lociterm object is via our parent gmcp.
		let lociterm = this.gmcp.lociterm;
		let show = `GMCP ${this.moduleName}: ${msg}`;
		console.log(show);
		lociterm.terminal.writeln(show);
		return;
	}

	// Put functions to be called directly by other parts of lociterm here.
	// The index of the module is the class name of this module.  The calling
	// convention looks like:
	// 
	//    lociterm.gmcp.mod("EmptyTemplate").anExample("hey","you");
	anExample(a,b) { // whatever args you want.
		console.log(`My two args were ${a} and ${b}`);
		return(42);  // whatever return you want.
	}

	// Good Luck!  -jsj
}

export { EmptyTemplate };
