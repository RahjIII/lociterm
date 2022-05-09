// menuhandler.js - LociTerm menu driver code
// Adapted from loinabox, Used with permission from The Last Outpost Project
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: menuhandler.js,v 1.5 2022/05/09 05:16:14 malakai Exp $

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

	constructor(lociterm) {

		this.lociterm = lociterm;
		this.openwindow = [];
		this.login = { name: "", password: "" };

		this.mydiv = document.createElement('div');
		this.mydiv.id='menuhandler';
		this.mydiv.classList.add('menuhandler');
		this.mydiv.appendChild(this.create_menubox());
		this.mydiv.appendChild(this.create_menuside());
		this.mydiv.appendChild(this.create_loginbox());
		this.mydiv.appendChild(this.create_settings());
		this.lociterm.mydiv.appendChild(this.mydiv);
		
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
		if(e.classList.contains("menuside")) {
			e.style.right = '-100%';
		} 
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
		this.lociterm.paste(keys);
	}

	prompt(keys) {
		this.send(keys);
		this.lociterm.focus();
	}

	store(key,value) {
		console.log("Storage: " + key + "," + value);
		localStorage.setItem(key,value);
	}

	sendlogin() {

		// add some code for setting the env vars here.

		if(this.login.name != undefined) {
			setTimeout(
				()=> this.send(this.login.name + "\n"),
				0
			);
			if(this.login.password != undefined) {
				setTimeout(
					()=> this.send(this.login.password + "\n"),
					500
				);
			}
		}
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

		bar.appendChild(this.create_menuside_themes(this.lociterm.lociThemes));
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
			this.lociterm.applyTheme(locitheme);
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

	// Add the Menubox definition to the DOM.
	create_loginbox() {

		let box;
		let field;
		let label;
		let input;
		let button;
		let overlay;

		overlay = document.createElement('div');
		overlay.id='menu_loginbox';
		overlay.classList.add('overlay');

		box = document.createElement('div');
		overlay.appendChild(box);
		box.classList.add('menupop');

		field = document.createElement('div');
		field.classList.add('menufield');
		box.appendChild(field);

		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Name";
		input = document.createElement('input');
		field.appendChild(input);
		input.setAttribute("type","text");
		input.setAttribute("placeholder","Enter Username");
		input.addEventListener('input',((e)=>this.login.name=e.target.value));
	
		field = document.createElement('div');
		field.classList.add('menufield');
		box.appendChild(field);
		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Password";
		input = document.createElement('input');
		input.addEventListener('input',((e)=>this.login.password=e.target.value));
		field.appendChild(input);
		input.setAttribute("type","password");
		input.setAttribute("placeholder","Enter Password");

		field = document.createElement('div');
		field.classList.add('menufield');
		box.appendChild(field);
		button = document.createElement('button');
		button.innerText = "Dismiss";
		button.onclick = (()=>this.close("menu_loginbox"));

		field.appendChild(button);
		button = document.createElement('button');
		button.innerText = "Send";
		button.onclick = (
			()=> {
				this.sendlogin();
				this.close("menu_loginbox")
			}
		);
		field.appendChild(button);
		
		return(overlay);
	}

	create_settings() {
		let overlay;
		let box;
		let field;
		let item;
		let button;
		let label;
		let input;
		let initval;

		let menuname = "menu_settings";

		overlay = document.createElement('div');
		overlay.id=menuname;
		overlay.classList.add('overlay');

		box = document.createElement('div');
		overlay.appendChild(box);
		box.classList.add('menupop');

		// a range slider for setting the finger size css
		field = document.createElement('div');
		box.appendChild(field);
		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Icons";
		var fingersize = document.createElement('input');
		fingersize.setAttribute("type","range");
		fingersize.setAttribute("min","5");
		fingersize.setAttribute("max","15");
		fingersize.setAttribute("step","0.125");
		initval = getComputedStyle(document.documentElement).getPropertyValue('--finger-size');
		fingersize.value = parseFloat(initval);
		fingersize.oninput = (
			()=> {
				let themedelta = [];
				themedelta.fingerSize = fingersize.value+"mm";
				this.lociterm.applyTheme(themedelta);
			}
		);
		field.appendChild(fingersize);

		// a range slider for setting the font size css
		field = document.createElement('div');
		box.appendChild(field);
		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Fonts";
		var fontsize = document.createElement('input');
		fontsize.setAttribute("type","range");
		fontsize.setAttribute("min","10");
		fontsize.setAttribute("max","24");
		fontsize.setAttribute("step","0.125");
		initval = getComputedStyle(document.documentElement).getPropertyValue('--font-size');
		fontsize.value = parseFloat(initval);
		fontsize.oninput = (
			()=> {
				let themedelta = [];
				themedelta.fontSize = fontsize.value+"px";
				themedelta.xtermoptions =[];
				themedelta.xtermoptions.fontSize =fontsize.value;
				this.lociterm.applyTheme(themedelta);
			}
		);
		field.appendChild(fontsize);

		// OK... pretty much a close button. :)
		field = document.createElement('div');
		field.classList.add('menufield');
		box.appendChild(field);
		button = document.createElement('button');
		button.innerText = "OK";
		button.onclick = (()=>this.close(menuname));
		field.appendChild(button);

		return(overlay);
	}
}

export { MenuHandler };
