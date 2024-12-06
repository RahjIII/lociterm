// loci_menu.js - The Lociterm Menu GMCP protocol
// Created: Wed Apr  3 05:34:00 PM EDT 2024
// $Id: loci_menu.js,v 1.1 2024/12/06 04:59:51 malakai Exp $

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
// This is a gmcp protocol handler class for lociterm

class LociMenu {

	gmcp = undefined;

	constructor(gmcp) {

		this.codeName ="LociMenu";
		this.moduleName = "Loci.Menu";
		this.moduleVersion  = "1";
	
		// Get us a path back to the parent
		this.gmcp = gmcp;

		// Init the module callbacks. 
		this.gmcp.addCommand("loci.menu.set",(m) => this.menuSet(m));
		this.gmcp.addCommand("loci.menu.reset",(m) => this.menuReset(m));
		this.gmcp.addCommand("loci.menu.open",(m) => this.menuOpen(m));
		this.gmcp.addCommand("loci.menu.close",(m) => this.menuClose(m));

	}

	init() {  
		this.sendGet();
	}

	goodbye() { 
		this.menuReset();
	}


	// Loci.Menu handlers.
	sendGet(m) {
		let obj = new Object();
		this.gmcp.send("Loci.Menu.Get",obj);
	}

	menuSet(m) {
		let lociterm = this.gmcp.lociterm;
		lociterm.mydiv.insertBefore(
			lociterm.menuhandler.create_custom_menus(m),
			lociterm.mydiv.firstChild
		);
	}

	menuReset(m) {
		let lociterm = this.gmcp.lociterm;
		let menuthemename = localStorage.getItem("menuthemename");
		if( menuthemename !== undefined) {
			lociterm.menuhandler.applyMenuName(menuthemename);
		} else {
			lociterm.menuhandler.applyMenuNo(0);
		}
	}

	menuOpen(m) {
		this.gmcp.lociterm.menuhandler.open(m);
	}

	menuClose(m) {
		this.gmcp.lociterm.menuhandler.close(m);
	}

}

export { LociMenu };
