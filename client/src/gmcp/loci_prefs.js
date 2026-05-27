// loci_prefs.js - The Lociterm Preferences GMCP protocol
// Created: $Date$
// $Id: $

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
//
// This is a gmcp protocol handler class for lociterm

class LociPrefs {

	gmcp = undefined;

	constructor(gmcp) {

		this.codeName = "LociPrefs";
		this.moduleName = "Loci.Prefs";
		this.moduleVersion = "1";

		// Get us a path back to the parent
		this.gmcp = gmcp;

		// Init the module callbacks.
		this.gmcp.addCommand("loci.prefs.set",   (m) => this.prefsSet(m));
		this.gmcp.addCommand("loci.prefs.reset",  (m) => this.prefsReset(m));

	}

	init() {
		this.sendGet();
	}

	goodbye() {
		this.prefsReset();
	}

	sendGet(m) {
		let obj = new Object();
		this.gmcp.send("Loci.Prefs.Get", obj);
	}

	// Apply a server-provided preferences delta without saving it to localStorage.
	// The delta uses the same structure as default_prefs.json.  Any omitted
	// properties are left at their current values, so partial overrides work.
	prefsSet(m) {
		let pref = this.gmcp.lociterm.pref;
		pref.autosave = false;
		pref.apply(m);
		pref.autosave = true;
	}

	// Restore the user's saved preferences after a server-provided override.
	// Re-applies defaults first so server-set values don't persist, then
	// loads the user's saved delta on top.
	prefsReset(m) {
		let pref = this.gmcp.lociterm.pref;
		pref.autosave = false;
		pref.apply(pref.defaultPrefs);
		pref.load(pref.storageKey);
		pref.autosave = true;
	}

}

export { LociPrefs };
