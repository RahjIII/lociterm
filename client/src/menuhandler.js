// menuhandler.js - LociTerm menu driver code
// Adapted from loinabox, Used with permission from The Last Outpost Project
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: menuhandler.js,v 1.24 2024/04/30 16:53:36 malakai Exp $

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

import PackageData from '../package.json';

export function hiya() {
	console.log("Hiya!");
}

class MenuHandler {
	
	constructor(lociterm) {

		this.lociterm = lociterm;
		this.openwindow = [];
		// make the menuhandler in the menuhandler div that is already on the
		// page, or if that doesn't exist, create it under this lociterm.  Note
		// that if you create it under lociterm, the screenreader mode hints
		// may overlay the menus making the menus unclickable!
		if ((this.mydiv = document.getElementById("menuhandler")) == undefined) {
			this.mydiv = document.createElement('div');
			this.mydiv.id='menuhandler';
			this.lociterm.mydiv.appendChild(this.mydiv);
		}
		this.mydiv.classList.add('menuhandler');
		this.mydiv.appendChild(this.create_menubox());
		this.mydiv.appendChild(this.create_menuside());
		this.mydiv.appendChild(this.create_loginbox());
		this.mydiv.appendChild(this.create_settings());
		this.mydiv.appendChild(this.create_filters());
		this.mydiv.appendChild(this.create_about());
		this.mydiv.appendChild(this.create_connect());
		this.mydiv.appendChild(this.create_oob_message());

		this.loadLogin();
		
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
		if(e.classList.contains("menuside")) {
			//e.style.right = '0%';
			e.classList.remove("menuside-close");
			e.classList.add("menuside-open");
		}
		this.openwindow[name] =1;
	};

	// always close a single menu item.
	close(name) {
		var e = document.getElementById(name);
		e.style.visibility = 'hidden';
		if(e.classList.contains("menuside")) {
			//	e.style.right = '-100%';
			e.classList.remove("menuside-open");
			e.classList.add("menuside-close");
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

	disconnect(how) {
		this.done();
		this.lociterm.disconnect(how);
	}

	store(key,value) {
		console.log("Storage: " + key + "," + value);
		localStorage.setItem(key,value);
	}

	// clears out the current password (in case of login failure. 
	voidLoginAutologin() {
		document.getElementById("autologin").checked = false;
	}

	// used by gmcp module to see if a username is available.
	getLoginUsername() {
		let val =document.getElementById("username").value;
		return( (val==undefined)?"":val)
	}

	// used by gmcp module to see if a password is available.
	getLoginPassword() {
		let val = document.getElementById("current-password").value;
		return( (val==undefined)?"":val)
	}

	getLoginAutologin() {
		let val = document.getElementById("autologin").checked;
		return(val);
	}

	// send the login info
	sendlogin() {

		if(this.lociterm.socket.readyState != 1) { // open
			// Try again sometime later maybe.
			this.lociterm.connect();
		}

		// Check for gmcp auth availability
		if( (this.lociterm.gmcp.charLoginRequested == true) ) {
			let username = document.getElementById("username").value;
			let password = document.getElementById("current-password").value;
			this.lociterm.gmcp.sendCharLoginCredentials(username,password);
			return;
		}

		return;

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
			c.classList.add('menuside-close');

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

				if ( item.disconnect != undefined ) {
					s.classList.add('send');
					s.onclick = () => this.disconnect(item.disconnect);
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

	// a generic corner selector
	create_anchor_selector(named="",labeled="",oninput="") {
		let field;
		let label;
		let select;

		let optlist = { 
			tr: "Top Right", br: "Bottom Right",
			tl: "Top Left", bl: "Bottom Left" 
		};

		field = document.createElement('div');
		label = document.createElement('label');
		field.appendChild(label);
		label.setAttribute("for",named);
		label.innerText = labeled;

		select = document.createElement("select");
		field.appendChild(select);
		select.setAttribute("name",named);
		select.id = named;
		select.oninput = oninput;

		for (let value in optlist) {
			let l = document.createElement('option');
			l.setAttribute("value",value);
			l.innerText = optlist[value];
			select.appendChild(l);
		}
		return(field);

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
		l.onclick = (()=> {
			this.saveLogin();
			this.lociterm.gmcp.charLoginCancel();
			this.done()
		} );
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
		l.setAttribute("autocapitalize","none");
		l.id = "username";
		l.setAttribute("autocomplete","username");
		l.addEventListener('change',((e)=>{this.saveLogin() }));

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
		l.addEventListener('change',((e)=>{this.saveLogin()}));

		// add a checkbox.
		l = this.create_generic_checkbox("remember","Remember Me",
			((e) => {this.saveLogin()})
		);
		cdiv.appendChild(l);

		// add a checkbox.
		l = this.create_generic_checkbox("autologin","Auto Login",
			((e) => {this.saveLogin()})
		);
		cdiv.appendChild(l);

		// login
		l = document.createElement('button');
		cdiv.appendChild(l);
		l.setAttribute("type","submit");
		l.innerText = "Login";
		l.onclick = (
			()=> {
				this.saveLogin();
				this.sendlogin();
				this.close("menu_loginbox")
				this.lociterm.focus();
			}
		);

		return(overlay);
	}

	// init the menu_loginbox from storage.
	loadLogin() {
		let remember = document.getElementById("remember");
		let username = document.getElementById("username");
		let password = document.getElementById("current-password");
		let autologin = document.getElementById("autologin");

		try {
			remember.checked = (localStorage.getItem("remember") == "true")?true:false;
		} catch {
			remember.checked = false;
		}

		try {
			autologin.checked = (localStorage.getItem("autologin") == "true")?true:false;
		} catch {
			autologin.checked = true;
		}

		try {
			username.value = localStorage.getItem("username");
		} catch { 
			username.value = "";
		}

		try {
			password.value = localStorage.getItem("current-password");
			password.value = atob(password.value);
		} catch {
			password.value = "";
		}
	}

	saveLogin() {
		let username = document.getElementById("username");
		let password = document.getElementById("current-password");
		let remember = document.getElementById("remember");
		let autologin = document.getElementById("autologin");

		if(remember.checked == true) {
			localStorage.setItem("username",username.value);
			localStorage.setItem("current-password",btoa(password.value));
			localStorage.setItem("remember",remember.checked);
			localStorage.setItem("autologin",autologin.checked);
		} else {
			localStorage.removeItem("username");
			localStorage.removeItem("current-password");
			localStorage.removeItem("remember");
			localStorage.removeItem("autologin");
		}
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
		let nerf;

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
		label.innerText = "Button Size";
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
		label.innerText = "Button Fade";
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

		// a selector for Icon Anchor
		field = this.create_anchor_selector("bgridAnchor-select","Button Grid",
			((e)=>{
				let themedelta = [];
				themedelta.bgridAnchor = e.srcElement.value;
				this.lociterm.applyTheme(themedelta);
			})
		);
		box.appendChild(field);

		// a selector for sidemenu Anchor
		field = this.create_anchor_selector("menusideAnchor-select","Menus",
			((e)=>{
				let themedelta = [];
				themedelta.menusideAnchor = e.srcElement.value;
				this.lociterm.applyTheme(themedelta);
			})
		);
		box.appendChild(field);

		nerf = this.create_generic_checkbox("nerfbar-select","Line Mode",
			((e)=>{
				if(e.srcElement.checked == false) {
					this.lociterm.nerfbar.close();
				} else {
					this.lociterm.nerfbar.open();
				}
				let themedelta = [];
				themedelta.nerfbar = (e.srcElement.checked ? "true":"false")
				this.lociterm.applyTheme(themedelta);
			})
		);
		box.appendChild(nerf);

		// A selector for screenreader hinting.  Its a good idea to leave the
		// hints on by default, because a VI user is going to have a tougher
		// time enabling them than a non-VI user will have disabling them.
		// This option exists because a previous verion of xterm.js couldn't do
		// clickable links and ARIA screen reader hints at the same time.  It
		// is *still* here because the tooling was already in place, and some
		// slower web browsers might be sped up by leaving the hints off.

		field = this.create_generic_checkbox("reader-select","Accessibility Hints",
			((e)=>{
				let themedelta = [];
				themedelta.xtermoptions = {};
				themedelta.xtermoptions.screenReaderMode = (e.srcElement.checked == true);
				this.lociterm.applyTheme(themedelta);
			})
		);
		box.appendChild(field);


		return(overlay);
	}

	create_filters() {
		let item;
		let menuname = "menu_filters";

		let overlay = document.createElement('div');
		overlay.id=menuname;
		overlay.classList.add('overlay');

		let box = document.createElement('div');
		overlay.appendChild(box);
		box.classList.add('menupop');

		let l = document.createElement('span');
		box.appendChild(l);
		l.onclick = (()=> {
			this.lociterm.crtfilter.save();
			this.done("menu_filters")
		});
		l.classList.add('close');
		l.title = "Close menu_filters";
		l.innerText = "×";

		item = document.createElement('label');
		item.innerText = "CRT Filter";
		item.setAttribute("for","filters-select");
		box.appendChild(item);

		// ------ menu items 
		// (This manual plumbing is pretty awful.  Fix it sometime.  -jsj)

		item = this.create_generic_checkbox("filters-select","Enabled",
			((e)=>{
				this.lociterm.crtfilter.opts.enabled = e.srcElement.checked;
				this.lociterm.crtfilter.update();
			})
		);
		box.appendChild(item);

		item = this.create_generic_checkbox("monotone-select","Monochrome",
			((e)=>{
				this.lociterm.crtfilter.opts.monotone.enabled = e.srcElement.checked;
				this.lociterm.crtfilter.update();
			})
		);
		box.appendChild(item);

		item = this.create_generic_slider("hue-slider","Phosphor Hue",
			-90,90,1,0,
			((e)=>{
				this.lociterm.crtfilter.opts.hue_rotate = e.srcElement.value;
				this.lociterm.crtfilter.update();
			})
		);
		box.appendChild(item);


		item = this.create_generic_slider("tube-slider","Barrel Distortion",
			0,256,0.5,0,
			((e)=>{
				this.lociterm.crtfilter.opts.barrel.scale = e.srcElement.value;
				this.lociterm.crtfilter.update();
			})
		);
		box.appendChild(item);

		item = this.create_generic_slider("bloom-bloom-slider","Brightness",
			-2,5,0.05,1.0,
			((e)=>{
				this.lociterm.crtfilter.opts.bloom.bloom = e.srcElement.value;
				this.lociterm.crtfilter.update();
			})
		);
		box.appendChild(item);

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
		l.innerText = `${PackageData.name}-${PackageData.version} `;
		l.innerText += `Copyright ${PackageData.copyright} ${PackageData.author} `;
		l.innerText += `(${PackageData.homepage}) `;

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "LociTerm uses:  xterm.js (https://xtermjs.org); libwebsockets by Andy Green (https://libwebsockets.org); libtelnet by Sean Middleditch (http://github.com/seanmiddleditch/libtelnet); and many other useful open source libraries and tools."

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Some icons courtesy of Open Iconic (https://useiconic.com/open/); GlassTTY VT220 TrueType font by Viacheslav Slavinsky (http://sensi.org/~svo/glasstty); Noto Emoji font by Google; OpenDyslexic Font from (https://opendyslexic.org/)."
		
		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Terminal bell sound from Oxegen desktop theme (https://invent.kde.org/plasma/oxygen)."

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Thank you to the Multi User Dungeon #coding discord group for your help and encouragement, and to every member of the Last Outpost Honor Guard! "

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		return(overlay);
	}
	
	// Return an overlay popup for the connect window.
	create_connect() {

		let l;
		let container;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id='menu_connect';
		overlay.classList.add('overlay');
		divstack.push(overlay);
		container = overlay;

			l = document.createElement('div');
			container.appendChild(l);
			l.classList.add('menupop');
			divstack.push(container);
			container = l;

				l = document.createElement('span');
				container.appendChild(l);
				//l.onclick = (()=> { this.done(); this.lociterm.connect() });
				l.onclick = (()=> { this.done(); });
				l.classList.add('close');
				l.title = "Connect";
				l.innerText = "×";

				l = document.createElement('div');
				l.classList.add('textflow');
				container.appendChild(l);
				divstack.push(container);
				container = l;

					l = document.createElement('p');
					container.appendChild(l);
					l.id='connect_status';
					l.innerText = `TEST`;
					
				container=divstack.pop();

			// login      NOT RIGHT
			l = document.createElement('button');
			container.appendChild(l);
			l.setAttribute("type","submit");
			l.innerText = "Reconnect";
			l.onclick = (()=> { this.done(); this.lociterm.connect() });

		return(overlay);
	}

	update_connect_message(msg) {
		let elem;
		elem = document.getElementById("connect_status");
		elem.innerText = msg;
		this.open("menu_connect");
	}

	create_oob_message() {

		let l;
		let container;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id='menu_oob_message';
		overlay.classList.add('overlay');
		divstack.push(overlay);
		container = overlay;

			l = document.createElement('div');
			container.appendChild(l);
			l.classList.add('menupop');
			divstack.push(container);
			container = l;

				l = document.createElement('span');
				container.appendChild(l);
				//l.onclick = (()=> { this.done(); this.lociterm.connect() });
				l.onclick = (()=> { this.done(); });
				l.classList.add('close');
				l.title = "Connect";
				l.innerText = "×";

				l = document.createElement('div');
				l.classList.add('textflow');
				container.appendChild(l);
				divstack.push(container);
				container = l;

					l = document.createElement('p');
					container.appendChild(l);
					l.id='oob_status';
					l.innerText = `TEST`;
					
				container=divstack.pop();

		return(overlay);
	}

	update_oob_message(msg) {
		let elem;
		elem = document.getElementById("oob_status");
		elem.innerText = msg;
		this.open("menu_oob_message");
	}

	event_print(e) {
		this.lociterm.terminal.write(`🌀\r\n`);
		this.lociterm.terminal.write(`${e.type}\r\n`);
		this.lociterm.terminal.write(`${e.data}\r\n`);
		this.lociterm.terminal.write(`🌀\r\n`);
	}


	create_generic_select(named="",labeled="",oninput="",optlist={false:"Disabled",true:"Enabled"}) {
		let mydiv;
		let label;
		let select;

		mydiv = document.createElement('div');

		label = document.createElement('label');
		mydiv.appendChild(label);
		label.setAttribute("for",named);
		label.innerText = labeled;

		select = document.createElement("select");
		mydiv.appendChild(select);
		select.setAttribute("name",named);
		select.id = named;
		select.oninput = oninput;

		for (let value in optlist) {
			let l = document.createElement('option');
			l.setAttribute("value",value);
			l.innerText = optlist[value];
			select.appendChild(l);
		}

		mydiv.appendChild(select);

		return(mydiv);

	}

	create_generic_checkbox(named="",labeled="",oninput="") {
		let mydiv;
		let label;
		let select;

		mydiv = document.createElement('div');
		mydiv.classList.add('genericcheckbox');

		select = document.createElement("input");
		mydiv.appendChild(select);
		select.setAttribute("type","checkbox");
		select.setAttribute("name",named);
		select.checked = true;
		select.id = named;
		select.onclick = oninput;
		mydiv.appendChild(select);

		label = document.createElement('label');
		label.setAttribute("for",named);
		label.innerText = labeled;
		mydiv.appendChild(label);

		return(mydiv);

	}

	create_generic_slider(named="",labeled="",min=0,max=1,step=0.1,initval=0.5,oninput="") {
		let div = document.createElement('div');
		div.classList.add('genericslider');
		let label = document.createElement('label');
		div.appendChild(label);
		label.innerText = labeled;
		let slider = document.createElement('input');
		slider.id = named;
		slider.setAttribute("type","range");
		slider.setAttribute("min",`${min}`);
		slider.setAttribute("max",`${max}`);
		slider.setAttribute("step",`${step}`);
		slider.value = initval;
		slider.oninput = oninput;
		div.appendChild(slider);
		return(div);
	}

}

export { MenuHandler };
