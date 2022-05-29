// menuhandler.js - LociTerm menu driver code
// Adapted from loinabox, Used with permission from The Last Outpost Project
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: menuhandler.js,v 1.10 2022/05/29 18:28:27 malakai Exp $

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
import LOIcon from './img/loiconcolor.gif';

class MenuHandler {

	constructor(lociterm) {

		this.lociterm = lociterm;
		this.openwindow = [];
		//this.login = { name: "", password: "" };

		this.mydiv = document.createElement('div');
		this.mydiv.id='menuhandler';
		this.mydiv.classList.add('menuhandler');
		this.mydiv.appendChild(this.create_menubox());
		this.mydiv.appendChild(this.create_menuside());
		this.mydiv.appendChild(this.create_loginbox());
		this.mydiv.appendChild(this.create_settings());
		this.mydiv.appendChild(this.create_about());
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

		// this is all VERY hoaky.  But it'll do until I can get it coded up
		// better, with either a gmcp message or some env vars.
		
		if(this.lociterm.socket.readyState != 1) { // open
			this.lociterm.connect();
		}

		if(this.lociterm.login.name != undefined) {
			setTimeout(
				()=> this.send(this.lociterm.login.name + "\n"),
				500
			);
			if(this.lociterm.login.password != undefined) {
				setTimeout(
					()=> this.send(this.lociterm.login.password + "\n"),
					750
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

		// this would add the themes to the side menu.. but I've moved them
		// into the client prefs selector.
		// bar.appendChild(this.create_menuside_themes(this.lociterm.lociThemes));
		return(bar);
	}

	// Given a theme struct, create a menuside style button for it.  (This was
	// how styles were selected before they were moved into the client prefs
	// window, and may not be called anywhere anymore.)
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

	// Given a themes array, create a menuside style menu for it.  This is how
	// styles were selected before they were moved into the client prefs
	// window, and may not be called anywhere anymore.)
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

	// Build the select box for choosing a theme from the themes array.
	create_theme_selector(locithemes) {

		let l;
		let cdiv;
		let divstack = [];

		let main = document.createElement('div');
		divstack.push(main);
		cdiv = main;

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for","theme-select");
		l.innerText = "Theme";

		l = document.createElement('select');
		cdiv.appendChild(l);
		l.setAttribute("name","theme-select");
		l.id = "theme-select";
		l.oninput = ((e)=>{
			this.lociterm.applyThemeNo(e.srcElement.value);
		});

		divstack.push(l);
		cdiv = l;

		l = document.createElement('option');
		cdiv.appendChild(l);
		l.setAttribute("value",-1);
		l.innerText = "Current";

		for(let i=0; i<locithemes.length; i++) {
			let locitheme = locithemes[i];
			l = document.createElement('option');
			cdiv.appendChild(l);
			l.setAttribute("value",i);
			l.innerText =locitheme.name;
			if ( locitheme.label != undefined ) {
				l.innerText = locitheme.label;
			}
		}

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];
		return(main);

	}


	// Add the Menubox definition to the DOM.
	create_loginbox() {

		let l;
		let cdiv;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id='menu_loginbox';
		overlay.classList.add('overlay');
		divstack.push(overlay);
		cdiv = overlay;

		l = document.createElement('form');
		cdiv.appendChild(l);
		l.setAttribute("actions","");
		l.setAttribute("method","dialog");
		l.classList.add('menupop');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('imgcontainer');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('span');
		cdiv.appendChild(l);
		l.onclick = (()=>this.done());
		l.classList.add('close');
		l.title = "Close menu_loginbox";
		l.innerText = "×";

		l = document.createElement('img');
		cdiv.appendChild(l);
		l.src = LOIcon;

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];
	
		l = document.createElement('div');
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;

		// Username
		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for","username");
		l.innerText = "Username";
		l = document.createElement('input');
		cdiv.appendChild(l);
		l.setAttribute("type","text");
		l.setAttribute("placeholder","Enter Username");
		l.setAttribute("name","username");
		l.id = "username";
		l.setAttribute("autocomplete","username");
		l.addEventListener('input',((e)=>this.lociterm.login.name=e.target.value));

		// Password
		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for","current-password");
		l.innerText = "Password";
		l = document.createElement('input');
		cdiv.appendChild(l);
		l.setAttribute("type","password");
		l.setAttribute("placeholder","Enter Password");
		l.setAttribute("name","password");
		l.id = "current-password";
		l.setAttribute("autocomplete","current-password");
		l.addEventListener('input',((e)=>this.lociterm.login.password=e.target.value));


		// rememberme
		l = document.createElement('div');
		l.style.display = 'block';
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;
		l = document.createElement('input');
		cdiv.appendChild(l);
		l.setAttribute("type","checkbox");
		l.setAttribute("checked","checked");
		l.setAttribute("name","remember");
		l.id = "remember";
		l.innerText = "Remember Me";
		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for","remember");
		l.innerText = "Remember Me";
		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

		// login
		l = document.createElement('button');
		cdiv.appendChild(l);
		l.setAttribute("type","submit");
		l.innerText = "Login";
		l.onclick = (
			()=> {
				this.sendlogin();
				this.close("menu_loginbox")
			}
		);

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
		let l;

		let menuname = "menu_settings";

		overlay = document.createElement('div');
		overlay.id=menuname;
		overlay.classList.add('overlay');

		box = document.createElement('div');
		overlay.appendChild(box);
		box.classList.add('menupop');

		l = document.createElement('span');
		box.appendChild(l);
		l.onclick = (()=>this.done("menu_settings"));
		l.classList.add('close');
		l.title = "Close menu_loginbox";
		l.innerText = "×";

		l = this.create_theme_selector(this.lociterm.lociThemes);
		box.appendChild(l);

		// a range slider for setting the font size css
		field = document.createElement('div');
		box.appendChild(field);
		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Font Size";
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

		// a range slider for setting the finger size css
		field = document.createElement('div');
		box.appendChild(field);
		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Icon Size";
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

		// a range slider for setting the grid fadeout
		field = document.createElement('div');
		box.appendChild(field);
		label = document.createElement('label');
		field.appendChild(label);
		label.innerText = "Icon Fade";
		var menufade = document.createElement('input');
		menufade.setAttribute("type","range");
		menufade.setAttribute("min","0.0");
		menufade.setAttribute("max","1.0");
		menufade.setAttribute("step","0.05");
		initval = getComputedStyle(document.documentElement).getPropertyValue('--menufade-hidden');
		menufade.value = parseFloat(initval);
		menufade.oninput = (
			()=> {
				let themedelta = [];
				themedelta.menuFade = menufade.value;
				this.lociterm.applyTheme(themedelta);
			}
		);
		field.appendChild(menufade);
		return(overlay);
	}

	// Return an overlay popup for the About menu.
	create_about() {

		let l;
		let cdiv;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id='menu_about';
		overlay.classList.add('overlay');
		divstack.push(overlay);
		cdiv = overlay;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('menupop');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('imgcontainer');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('span');
		cdiv.appendChild(l);
		l.onclick = (()=>this.done());
		l.classList.add('close');
		l.title = "Close about";
		l.innerText = "×";

		l = document.createElement('img');
		cdiv.appendChild(l);
		l.src = LOIcon;


		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

		l = document.createElement('div');
		l.classList.add('textflow');
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "LociTerm - Last Outpost Client Interface Terminal "
		l.innerText += "Copyright © 2022 <rahjiii@jeffrika.com> "
		l.innerText += "(https://www.last-outpost.com/LO/pubcode)"

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "LociTerm uses:  xterm.js (https://xtermjs.org); libwebsockets by Andy Green (https://libwebsockets.org); libtelnet by Sean Middleditch (http://github.com/seanmiddleditch/libtelnet); and many other useful open source libraries and tools."

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Some icons courtesy of Open Iconic (https://useiconic.com/open/); GlassTTY VT220 TrueType font by Viacheslav Slavinsky (http://sensi.org/~svo/glasstty); Noto Emoji font by Google; "
		
		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Thank you to the Multi User Dungeon #coding discord group for your help and encouragement, and to every member of the Last Outpost Honor Guard! "

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		return(overlay);
	}

}

export { MenuHandler };
