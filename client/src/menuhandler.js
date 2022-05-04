// menuhandler.js - LociTerm menu driver code
// Adapted from loinabox, Used with permission from The Last Outpost Project
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: menuhandler.js,v 1.3 2022/05/04 03:59:58 malakai Exp $

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

import Menubox from './menubox.json';
import Menuside from './menuside.json';
import Icons from './icons.svg';

class MenuHandler {

	constructor(divid,paste_hook,focus_hook,theme_hook,lociThemes) {
		this.mydiv = document.getElementById('menuhandler');
		this.paste_hook = paste_hook;
		this.focus_hook = focus_hook;
		this.theme_hook = theme_hook;
		this.openwindow = [];
		this.lociThemes = lociThemes;

		this.mydiv.classList.add('menuhandler');
		this.mydiv.appendChild(this.create_menubox());
		this.mydiv.appendChild(this.create_menuside());
		
	}

	toggle(name) {
		if(this.openwindow[name] == 1) {
			this.close(name);
		} else {
			this.open(name);
		}
	};

	// always open a single menu item.
	open(name) {
		var e = document.getElementById(name);
		this.done();
		e.style.visibility = 'visible';
		e.style.right = '0%';
		this.openwindow[name] =1;
	};

	// always close a single menu item.
	close(name) {
		var e = document.getElementById(name);
		e.style.visibility = 'hidden';
		e.style.right = '-20%';
		this.openwindow[name] =0;
	};

	// open the first menu in the chain
	start(name) {
		if(this.openwindow[name] == 1) {
			this.done();
		} else {
			this.open(name);
		}
	};

	// close all of the open menus.
	done() {
		let m;
		for (m in this.openwindow) {
			this.close(m);
		}
	};

	// send and done.
	send(keys) {
		this.done();
		this.paste_hook(keys);
	}

	prompt(keys) {
		this.send(keys);
		this.focus_hook();
	}

	store(key,value) {
		localStorage.setItem(store,value);
	}

	loadlogin() {
		if (typeof(Storage) !== "undefined") {
			var l = document.getElementById("lb_login");
			var p = document.getElementById("lb_pass");

			l.value = localStorage.getItem("lb_login");
			p.value = localStorage.getItem("lb_pass");
		}
	}

	sendlogin() {
		var l = document.getElementById("lb_login");
		var p = document.getElementById("lb_pass");
		if(l.value == "" || p.value == "") {
			return;
		}

		if (typeof(Storage) !== "undefined") {
			localStorage.setItem("lb_login",l.value);
			localStorage.setItem("lb_pass",p.value);
		}

		// this is probably wrong.
		setTimeout(function(){this.send(l.value + "\n")},0);
		setTimeout(function(){this.send(p.value + "\n")},500);
		this.done();
	}

	// Add the Menubox definition to the DOM.
	create_menubox() {
		let box = document.createElement('div');
		box.id='menubox';
		box.classList.add('menugrid');


		for(let i=0; i<Menubox.length; i++) {
			let item = Menubox[i];
			let container = document.createElement('div');
			// assign the right onclick function to the container..
			if ( item.mhstart != undefined ) {
				container.onclick = () => this.start(item.mhstart);
			} else if ( item.mhsend != undefined ) {
				container.onclick = () => this.send(item.mhsend);
			}

			// add the svg.  Could add a plain old img adder too, but.. later
			if( item.svgid != undefined) {
				let svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
				svg.classList.add('menuicon');
				svg.classList.add(item.class);
				let use = document.createElementNS("http://www.w3.org/2000/svg","use");
				use.setAttribute("href",Icons+"#"+item.svgid);
				svg.appendChild(use);
				container.appendChild(svg);
			}

			box.appendChild(container);
		}
		return(box);
	}

	// Add the Menubox definition to the DOM.
	create_menuside() {

		let bar = document.createElement('div');
		bar.id='menubar';
		bar.classList.add('menu');
		bar.classList.add('menubar');

		for(let i=0; i<Menuside.length; i++) {
			let side = Menuside[i];
			let c = document.createElement('div');
			c.id = side.id
			c.classList.add('menu');
			c.classList.add('menuside');

			for(let j=0; j<side.item.length; j++) {
				let item = side.item[j];
				let s = document.createElement('div');

				// assign the right onclick function to the div..
				if ( item.send != undefined ) {
					s.classList.add('send');
					if ( item.open != undefined ) {
						// you can have both send and open in the same definition.
						s.onclick = () => { this.send(item.send); this.open(item.open); };
					} else {
						s.onclick = () => this.send(item.send);
					}
					s.innerText = item.send;
				} else if ( item.open != undefined ) {
					s.classList.add('open');
					s.onclick = () => this.open(item.open);
				} else if ( item.prompt != undefined ) {
					s.classList.add('send');
					s.innerText = item.prompt + "...";
					s.onclick = () => this.prompt(item.prompt);
				}

				// label goes inside the div.
				if ( item.label != undefined ) {
					s.innerText = item.label;
				}

				c.appendChild(s);
			}

			bar.appendChild(c);
		}

		bar.appendChild(this.create_menuside_themes(this.lociThemes));
		return(bar);
	}

	create_menuside_theme_button(locitheme) {
		let s = document.createElement('div');

		// assign the right onclick function to the div..
		s.classList.add('client');
		if ( locitheme.label != undefined ) {
			s.innerText = locitheme.label;
		} else {
			s.innerText = locitheme.name;
		}
		s.onclick = () => {
			this.theme_hook(locitheme);
			this.done();
		}
		return(s);
	}

	create_menuside_themes(locithemes,menu_id="menu_themes_dynamic") {

		let m = document.createElement('div');
		m.id=menu_id;
		m.classList.add('menu');
		m.classList.add('menuside');

		for(let i=0; i<locithemes.length; i++) {
			m.appendChild(this.create_menuside_theme_button(locithemes[i]));
		}
			
		return(m);
	}

}

export { MenuHandler };
