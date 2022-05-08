// index.js - LociTerm entry js
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: index.js,v 1.4 2022/05/08 18:30:10 malakai Exp $

// Copyright © 2022 Jeff Jahr <malakai@jeffrika.com>
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

// import './xterm.css';
import 'xterm/css/xterm.css';
import './styles.css';

import './menuhandler.css';
import { MenuHandler } from './menuhandler.js';

import lociThemes from './themes.json'

import { LociTerm } from './lociterm.js'


// This async function wrapper is so that we can force load all the fonts found
// in the lociThemes, and not really start the app up until that is complete.
async function lociTermBegin() {

	// let defaultTheme = {};  works too.
	let defaultTheme = lociThemes[0];
	// see if there's a saved one available. 
	let defaultThemeName = localStorage.getItem("locithemename");
	for (let i=0;i<lociThemes.length;i++) {
		if(lociThemes[i].name == defaultThemeName) {
			console.log("Found stored theme name " + defaultThemeName);
			defaultTheme = lociThemes[i];
			break;
		}
	}

	// force all of the font familes in the lociThemes definition to be loaded,
	// even though they may not appear to be in use yet.  The xterm.js won't
	// render a font correctly at construction time if the font isn't fully
	// loaded.
	for (let i=0;i<lociThemes.length;i++) {
		if(lociThemes[i].xtermoptions.fontFamily != undefined) {
			let familylist = lociThemes[i].xtermoptions.fontFamily.split(",");
			for (let f=0; f<familylist.length; f++) {
				// let fontname = "0px " + lociThemes[i].xtermoptions.fontFamily;
				let fontname = "16px " + familylist[f];
				if( document.fonts.check(fontname) == false ) {
					console.log(`Theme "${lociThemes[i].name}" loading ${fontname}`);
					document.fonts.load(fontname);
				} else {
					console.log(`Theme "${lociThemes[i].name}" already loaded ${fontname}`);
				}
			}
		}
	}
	await document.fonts.ready;

	// OK.. can load up a new LociTerm with a default theme now!
	const terminal = new LociTerm(
		document.getElementById('terminal'), // the anchor div
		defaultTheme
	);

	const mh = new MenuHandler(
		document.getElementById('menuhandler'), // the anchor div
		((m) => terminal.paste(m)),				// the paste hook
		(() => terminal.focus()),				// the focus hook
		((theme) => terminal.applyTheme(theme)),				// the focus hook
		lociThemes
	);

	// terminal.url="ws://localhost:4567";
	terminal.connect("ws://zeppelin.lake.jeffrika.com:4005");

}

lociTermBegin();
