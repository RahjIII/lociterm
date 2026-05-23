// loci_skin.js - The Lociterm UI Skin GMCP protocol
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

class LociSkin {

	gmcp = undefined;

	constructor(gmcp) {

		this.codeName = "LociSkin";
		this.moduleName = "Loci.Skin";
		this.moduleVersion = "1";

		// Get us a path back to the parent
		this.gmcp = gmcp;

		// Init the module callbacks.
		this.gmcp.addCommand("loci.skin.set",   (m) => this.skinSet(m));
		this.gmcp.addCommand("loci.skin.reset", (m) => this.skinReset(m));

	}

	init() {
		this.sendGet();
	}

	goodbye() {
		this.skinReset();
	}

	sendGet(m) {
		let obj = new Object();
		this.gmcp.send("Loci.Skin.Get", obj);
	}

	// Apply a server-provided skin object directly.  The skin object uses the
	// same property names as ui_skins.json entries.  Any omitted properties
	// are left at their current values, so partial overrides work fine.
	// This does not save to the user's stored preferences.
	skinSet(m) {
		this.gmcp.lociterm.pref.applySkin(m);
	}

	// Restore the user's saved skin choice after a server-provided skin.
	skinReset(m) {
		let lociterm = this.gmcp.lociterm;
		let skinname = lociterm.pref.get("ui.skinname");
		let skin = lociterm.lociSkins.find((x) => x.name == skinname);
		if(skin !== undefined) {
			lociterm.pref.applySkin(skin);
		} else if(lociterm.lociSkins.length > 0) {
			lociterm.pref.applySkin(lociterm.lociSkins[0]);
		}
	}

}

export { LociSkin };
