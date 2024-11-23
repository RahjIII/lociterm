// menuhandler.js - LociTerm menu driver code
// Adapted from loinabox, Used with permission from The Last Outpost Project
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: menuhandler.js,v 1.37 2024/11/23 16:33:25 malakai Exp $

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

import Icons from './icons.svg';
import LOIcon from './img/lociterm512x512.png';
import TerminalIcon from './img/bezeltermicon192.png';
import * as ObjDeep from './objdeep.js';

// kinda silly listing these menus seperately but hey, this is webpack.
import SystemMenu from './menu/system_menu.json';
import LoMenu from './menu/lo_menu.json';
import DiagonalMenu from './menu/diagonal_menu.json';
import TelnetMenu from './menu/telnet_menu.json';

import PackageData from '../package.json';

export function hiya() {
	console.log("Hiya!");
}

class MenuHandler {
	
	constructor(lociterm) {

		this.lociterm = lociterm;
		this.openwindow = [];
		this.hotkeys = [];
		this.openHandler = new Map();
		this.menuThemes = this.consolodateMenuThemes();

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
		this.mydiv.appendChild(this.create_custom_menus(LoMenu));
		this.mydiv.appendChild(this.create_loginbox());
		this.mydiv.appendChild(this.create_settings());
		this.mydiv.appendChild(this.create_filters());
		this.mydiv.appendChild(this.create_about());
		this.mydiv.appendChild(this.create_disclaimer());
		this.mydiv.appendChild(this.create_connect());
		this.mydiv.appendChild(this.create_oob_message());

		// dont loadLogin until lociterm has loaded connectgame
		//this.loadLogin();

		let menuthemename = localStorage.getItem("menuthemename");
		if( menuthemename !== undefined) {
			this.applyMenuName(menuthemename);
		}
	}

	consolodateMenuThemes() {
		var themes = [];
		themes.push(LoMenu);
		themes.push(DiagonalMenu);
		themes.push(TelnetMenu);
		themes.push({ name: "None" });
		return(themes);
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
		let call = undefined;
		// close everthing that's open.
		this.done();
		if(e == null) {
			console.warn(`couldn't open menu '${name}'?`);
			return;
		}
		// open the requested window.
		e.style.visibility = 'visible';
		e.setAttribute("tabindex","0");
		if(e.classList.contains("menuside")) {
			//e.style.right = '0%';
			e.classList.remove("menuside-close");
			e.classList.add("menuside-open");
		}
		this.openwindow[name] =1;
		e.focus();

		if( (call = this.openHandler.get(name)) ) {
			call(name);
		}
	};

	// always close a single menu item.
	close(name) {
		var e = document.getElementById(name);
		if(e == null) return;
		e.style.visibility = 'hidden';
		if(e.classList.contains("menuside")) {
			//	e.style.right = '-100%';
			e.classList.remove("menuside-open");
			e.classList.add("menuside-close");
		} 
		this.openwindow[name] =0;
		e.blur();
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

	// send keys through the nerfbar, or the terminal as required.
	send(keys) {
		this.done();
		if(this.lociterm.nerfbar.nerfstate === 'active') {
			this.lociterm.nerfbar.paste(keys);
		} else {
			this.lociterm.paste(keys);
		}
	}

	// send hotkey bytes directly to the terminal, or route a hotkey's "send"
	// definition through the nerfbar infrastructure.
	hotkey(id) {
		this.done();  // close the hotkey menu.
		/* if the hotkey exists in the menu system... */
		if( this.hotkeys[id] === undefined ) {
			return;
		}
		/* if it has a .send value, route that through the terminal or nerfbar. */
		if(this.hotkeys[id].send !== undefined) {
			this.send(this.hotkeys[id].send);
			return;
		}
		/* otherwise paste the keystroke directly into the terminal. */
		this.lociterm.paste(this.hotkeys[id].hotkey);
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
		//console.log("Storage: " + key + "," + value);
		localStorage.setItem(key,value);
	}

	// clears out the current password (in case of login failure. 
	voidLoginAutologin() {
		document.getElementById("autologin").checked = false;
	}

	// used by gmcp module to see if a username is available.
	getLoginUsername() {
		this.loadLogin();
		let val =document.getElementById("username").value;
		return( (val==undefined)?"":val)
	}

	// used by gmcp module to see if a password is available.
	getLoginPassword() {
		this.loadLogin();
		let val = document.getElementById("current-password").value;
		return( (val==undefined)?"":val)
	}

	getLoginAutologin() {
		this.loadLogin();
		let val = document.getElementById("autologin").checked;
		return(val);
	}

	// send the login info
	sendlogin() {

		if(this.lociterm.socket.readyState != 1) { // open
			// Try again sometime later maybe.
			this.lociterm.connect();
		}

		let username = document.getElementById("username").value;
		let password = document.getElementById("current-password").value;
		
		// Check for gmcp auth availability
		if( (this.lociterm.gmcp.charLoginRequested == true) ) {
			this.lociterm.gmcp.sendCharLoginCredentials(username,password);
		} else {
			// don't route it through the nerfbar, paste directly to the terminal.
			setTimeout(()=>this.lociterm.paste(`${username}\n`),0);
			setTimeout(()=>this.lociterm.paste(`${password}\n`),250);
		}

		return;

	}


	// A unified call for adding in a custom menubox/menubar definition.
	create_custom_menus(custom) {

		// javascript is such bullshit
		let menu = JSON.parse(JSON.stringify(SystemMenu));

		let menubox = menu.menubox;

		if(custom.menubox) {
			menubox.width = Math.max(custom.menubox.width , menubox.width);
			menubox.height = Math.max(custom.menubox.height , menubox.height);
			menubox.buttons = menubox.buttons.concat(custom.menubox.buttons);
		}

		let menubar = menu.menubar;
		if(custom.menubar) {
			menubar = menubar.concat(custom.menubar);
		}

		var div;

		// Delete any that might exist.
		div = document.getElementById("menucustom");
		if(div !== null) {
			div.remove();
		}
		div = document.createElement('div');
		div.id='menucustom';

		div.appendChild(this.create_menubox(menubox));
		div.appendChild(this.create_menubar(menubar));
		return(div);
	}

	// Add the Menubox definition to the DOM.
	create_menubox(menubox) {

		let box = document.createElement('div');
		box.id='menubox';
		box.classList.add('menugrid');
		let width = menubox.width;
		let height = menubox.height;
		box.style.gridTemplateRows = `repeat(${height}, 1fr)`;
		box.style.gridTemplateColumns =`repeat(${width},1fr)`;
		box.style.direction = 'rtl';

		let buttons = menubox.buttons;

		for(let i=0; i<buttons.length; i++) {
			let item = buttons[i];
			let container = document.createElement('div');
			container.classList.add('menubutton');
			// assign the correct onclick function to the container..
			if ( item.menubar != undefined ) {
				container.onclick = () => this.start(item.menubar);
			} else if ( item.send != undefined ) {
				container.onclick = (e) => { this.send(item.send); }
			}

			if( item.color !== undefined) {
				container.style.color = item.color;
			}
			if( item.background !== undefined) {
				container.style.background = item.background;
			}
			if( item.text !== undefined) {
				container.innerText = item.text;
			}

			// add the svg.  Could add a plain old img adder too, but.. later
			if( item.svgid != undefined) {
				let svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
				svg.classList.add('menuicon');
				svg.classList.add(item.svgclass);
				let use = document.createElementNS("http://www.w3.org/2000/svg","use");
				use.setAttribute("href",Icons+"#"+item.svgid);
				svg.appendChild(use);
				container.appendChild(svg);
			}

			if( item.img != undefined) {
				let img = document.createElement('img');
				img.classList.add('menuicon');
				container.appendChild(img);
				img.src = item.img;
				img.onerror = ((e)=>{ e.currentTarget.onerror=null; e.currentTarget.src = TerminalIcon; });
			}

			box.appendChild(container);
		}
		return(box);
	}

	// Add the Menubox definition to the DOM.
	create_menubar(menubar) {

		let bar = document.createElement('div');
		bar.id='menubar';
		bar.classList.add('menu');
		bar.classList.add('menubar');

		for(let i=0; i<menubar.length; i++) {
			let side = menubar[i];
			let c = document.createElement('div');
			c.id = side.id
			c.classList.add('menu');
			c.classList.add('menuside');
			c.classList.add('menuside-close');

			// Keywords:
			//	label
			//	open
			//	send
			//	prompt
			//	id
			//	hotkey

			for(let j=0; j<side.item.length; j++) {
				let item = side.item[j];
				let s = document.createElement('div');
				if(item.id != undefined) {
					s.id = item.id
				}

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
				// wordstack action overrides any open or send.
				if (item.wordstack != undefined) {
					s.classList.add('open');
					if(item.wordstack === "") {
						s.innerText = "Select";
					} else {
						s.innerText = item.wordstack; 
					}
					s.onclick = () => this.lociterm.wordstack.openMenu();
				}

				if( item.color !== undefined) {
					s.style.color = item.color;
				}
				if( item.background !== undefined) {
					s.style.background = item.background;
				}

				// label goes inside the div.
				if ( item.label != undefined ) {
					s.innerText = item.label;
				}

				if (item.hotkey != undefined) {
					s.classList.add('send');
					s.classList.add('hotkey');
					this.hotkeys[item.id] = item;
					s.onclick = () => this.hotkey(item.id);
				}

				if ( item.disconnect != undefined ) {
					s.classList.add('send');
					s.onclick = () => this.disconnect(item.disconnect);
				}

				if ( item.reconnect != undefined ) {
					s.classList.add('send');
					s.onclick = () => this.lociterm.reconnect();
				}

				c.appendChild(s);
			}

			bar.appendChild(c);
		}

		return(bar);
	}


	// Build the select box for choosing a theme from the themes array.
	create_generic_selector(id, label, themes, oninput) {

		let l;
		let cdiv;
		let divstack = [];

		let main = document.createElement('div');
		divstack.push(main);
		cdiv = main;

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for",id);
		l.innerText = label;

		l = document.createElement('select');
		cdiv.appendChild(l);
		l.setAttribute("name",id);
		l.id = id;
		l.oninput = oninput;

		divstack.push(l);
		cdiv = l;

		for(let i=0; i<themes.length; i++) {
			let theme = themes[i];
			l = document.createElement('option');
			cdiv.appendChild(l);
			l.setAttribute("value",i);
			l.innerText = theme.name;
			if ( theme.label != undefined ) {
				l.innerText = theme.label;
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
		label.appendChild(select);
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


	// Add the login definition to the DOM.
	create_loginbox() {

		let l;
		let cdiv;
		let divstack = [];
		let id = "sys_loginbox";

		let overlay = document.createElement('div');
		overlay.id=id;
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
		l.title = "Close sys_loginbox";
		l.innerText = "×";

		l = document.createElement('figure');
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;

		l = document.createElement('img');
		l.classList.add('siteicon');
		l.id=`${overlay.id}_icon`;
		l.src = LOIcon;
		l.onerror = ((e)=>{ e.currentTarget.onerror=null; e.currentTarget.src = TerminalIcon; });
		cdiv.appendChild(l);

		l = document.createElement('figcaption');
		l.classList.add('gamehost');
		l.id=`${overlay.id}_gamehost`;
		l.innerText = "";
		cdiv.appendChild(l);

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

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
		l.id=`${overlay.id}_submit`;
		l.setAttribute("type","submit");
		l.innerText = "Login";
		l.onclick = (
			()=> {
				this.saveLogin();
				this.sendlogin();
				this.close("sys_loginbox")
				this.lociterm.focus();
			}
		);

		// This'll make it so that when the login window is opened, it'll do a
		// check to see if the reconnect key has an icon set up in it.  Then
		// player will see the game's site icon (or the default one) when they
		// log in. 
		this.openHandler.set(overlay.id,
			(id) => {
				if(this.lociterm.reconnect_key) {
					let icon = document.getElementById(`${id}_icon`);
					if(this.lociterm.reconnect_key.icon) {
						icon.src = this.lociterm.reconnect_key.icon;
					} else {
						icon.src = TerminalIcon;
					}
					let fig = document.getElementById(`${id}_gamehost`);
					if(this.lociterm.reconnect_key.host) {
						fig.innerText = `(${this.lociterm.reconnect_key.host} `;
						fig.innerText += `:${this.lociterm.reconnect_key.port})`;
					} else {
						fig.innerText = "";
					}
				}
				let submit = document.getElementById(`${id}_submit`);
				if( (this.lociterm.gmcp.charLoginRequested == true) ) {
					submit.innerText = "Login";
				} else {
					submit.innerText = "Send Text";
				}
			}
		);

		return(overlay);
	}


	credsetKey() {
		let cg = this.lociterm.reconnect_key || { host: "-", port: 23 };
		return(`${cg.host}${cg.port}`);
	}

	loadLogin() {
		let fullset = {};
		try {
			fullset = JSON.parse(atob(decodeURIComponent(escape(localStorage.getItem("credset")))));
		} catch {
			fullset = {};
		}
		let key = this.credsetKey();
		let remember = document.getElementById("remember");
		let username = document.getElementById("username");
		let password = document.getElementById("current-password");
		let autologin = document.getElementById("autologin");

		if(fullset[key] == undefined) {
			fullset[key] = {};
		}

		username.value = fullset[key].u || "";
		password.value = fullset[key].p || "";
		remember.checked = fullset[key].r || false;
		autologin.checked = fullset[key].a || false;
	}

	saveLogin() {
		let fullset = {};
		try {
			fullset = (JSON.parse(atob(decodeURIComponent(escape(localStorage.getItem("credset"))))) || {});
		} catch {
			fullset = {};
		}
		let key = this.credsetKey();
		let username = document.getElementById("username");
		let password = document.getElementById("current-password");
		let remember = document.getElementById("remember");
		let autologin = document.getElementById("autologin");

		try { delete(fullset[key]); } catch {};

		if(remember.checked == true) {
			fullset[key] = {};
			fullset[key].u = username.value;
			fullset[key].p = password.value;
			fullset[key].r = remember.checked;
			fullset[key].a = autologin.checked;
		} else {
			fullset[key] = {};
			fullset[key].u = username.value;
			fullset[key].p = "";
			fullset[key].r = remember.checked;
			fullset[key].a = false;
		}

		localStorage.setItem("credset",btoa(unescape(encodeURIComponent(JSON.stringify(fullset)))));
		//localStorage.setItem("credshadow",JSON.stringify(fullset));
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

		let menuname = "sys_settings";

		overlay = document.createElement('div');
		overlay.id=menuname;
		overlay.classList.add('overlay');

		box = document.createElement('div');
		overlay.appendChild(box);
		box.classList.add('menupop');

		l = document.createElement('span');
		box.appendChild(l);
		l.onclick = (()=>this.done("sys_settings"));
		l.classList.add('close');
		l.title = "Close sys_loginbox";
		l.innerText = "×";

		l = this.create_generic_selector(
			"theme-select",
			"Theme",
			this.lociterm.lociThemes,
			((e)=>{ this.lociterm.applyThemeNo(e.srcElement.value); })
		);
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
		label.appendChild(fontsize);


		l = this.create_generic_selector(
			"menu-select",
			"Menu Style",
			this.menuThemes,
			((e)=>{ this.applyMenuNo(e.srcElement.value); })
		);
		box.appendChild(l);


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
		label.appendChild(fingersize);

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
		label.appendChild(menufade);

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
		let menuname = "sys_filters";

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
			this.done("sys_filters")
		});
		l.classList.add('close');
		l.title = "Close sys_filters";
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


		item = this.create_generic_slider("barrel-slider","Barrel Distortion",
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

		let elementid = `sys_about`;

		let divs = this.create_generic_window(
			elementid,
			"About LociTerm",
			(()=> { this.done(); })
		);

		let overlay = divs[0];
		let content = divs[1];
		cdiv = content;
		divstack.push(content);

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('imgcontainer');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('img');
		l.classList.add('siteicon');
		l.src = LOIcon;
		cdiv.appendChild(l);


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
		l.innerText = "LociTerm uses:  xterm.js (https://xtermjs.org); libwebsockets by Andy Green (https://libwebsockets.org); libtelnet by Sean Middleditch (http://github.com/seanmiddleditch/libtelnet); libsqlite by Hipp, Kennedy, and Mistachkin (https://www.sqlite.org); and many other useful open source libraries and tools."

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Some icons courtesy of Open Iconic (https://useiconic.com/open/); GlassTTY VT220 TrueType font by Viacheslav Slavinsky (http://sensi.org/~svo/glasstty); Noto Emoji font by Google; OpenDyslexic Font from (https://opendyslexic.org/)."
		
		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Terminal bell sound from Oxygen desktop theme (https://invent.kde.org/plasma/oxygen)."

		l = document.createElement('p');
		cdiv.appendChild(l);
		l.innerText = "Thank you to the Multi User Dungeon #coding discord group for your help and encouragement, Nicky N. for help with the CRT Filters, and to every member of the Last Outpost Honor Guard! "

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		return(overlay);
	}

	// Return an overlay popup for the disclaimer menu.
	create_disclaimer() {

		let l;
		let cdiv;
		let divstack = [];
		var pgrfs;

		let elementid = `sys_disclaimer`;

		let divs = this.create_generic_window(
			elementid,
			"Welcome to LociTerm",
			(()=> { 
				localStorage.setItem("disclaimer","disclaimed");
				this.done(); 
			})
		);

		let overlay = divs[0];
		let content = divs[1];
		cdiv = content;
		divstack.push(content);

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('imgcontainer');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('img');
		l.classList.add('siteicon');
		l.src = LOIcon;
		cdiv.appendChild(l);

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

		l = document.createElement('div');
		l.classList.add('textflow');
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;

		l = document.createElement('h1');
		cdiv.appendChild(l);
		l.innerText = "Welcome to LociTerm!";

		pgrfs = [
			"To install LociTerm Client as an App on your phone or computer, select " +
			"'Install on Homescreen' or 'Install Application' from the browser " +
			"window options.",

			"You can change settings such as theme, text and window sizes, game " +
			"server, and login information by selecting Gear '⚙' → Settings. " + 
			"Your choices will be saved in your browser's local storage for next " +
			"time.",
		];
		for(let idx=0;idx<pgrfs.length;idx++) {
			l = document.createElement('p');
			cdiv.appendChild(l);
			l.innerText = pgrfs[idx];
		}

		l = document.createElement('h1');
		cdiv.appendChild(l);
		l.innerText = "LociTerm and Privacy";
			

		pgrfs = [
			"LociTerm is a free to use, Cloud Hosted, Web-to-Telnet proxy.  LociTerm is " +
			"offered in the hope that it will be useful, but WITHOUT ANY " +
			"WARRANTY; without even the implied warranty of MERCHANTABILITY or " +
			"FITNESS FOR A PARTICULAR PURPOSE.",

			"Telnet is a clear text protocol. Any sensitive data you enter " +
			"into LociTerm may be visible to unintended parties. " +
			"Your session is encrypted " +
			"between your web browser and the LociTerm proxy server running at " +
			"the address in the URL bar.  Your session is re-encrypted between " +
			"the LociTerm proxy and the game if the game uses TELNET-SSL " +
			"and is listed with a 🔐 icon in the Game Server menu. " +
			"You use this Web-to-Telnet proxy AT YOUR OWN RISK. " +
			"The operator of the LociTerm proxy server is not responsible for lost or stolen data.",

			"Game Server " +
			"login credentials for automatic login are stored in your browser's " +
			"local storage only when the 'remember me' option is checked, and " +
			"are never stored on, or logged by the LociTerm proxy server.",


			"LociTerm shares your IP address and User Agent string with game " +
			"servers that request it, and the LociTerm proxy server logs the " +
			"source and destination addresses of all connections. ",

			"Suggesting a new game server to LociTerm will add that server to " +
			"the global Game Server menu for all users, and is not private.",

			"By using LociTerm, you agree to access only the systems that you are " +
			"authorized to use, and that you will not use LociTerm to bypass, " +
			"obfuscate, or probe for network or system access. ",

			"Parental discresion is advised. We suggest you wear a helmet and bring a jacket.",

			"Thanks for reading. Go have fun!"
		];
		for(let idx=0;idx<pgrfs.length;idx++) {
			l = document.createElement('p');
			cdiv.appendChild(l);
			l.innerText = pgrfs[idx];
		}

		l = document.createElement('button');
		cdiv.appendChild(l);
		l.setAttribute("type","submit");
		l.innerText = "I agree.";
		l.onclick = (()=> { 
			localStorage.setItem("disclaimer","disclaimed");
			this.done(); 
		});

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

		return(overlay);
	}
	
	// Return an overlay popup for the connect window.
	create_connect() {

		let l;
		let container;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id='sys_connect';
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
		this.open("sys_connect");
	}

	create_oob_message() {

		let l;
		let container;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id='sys_oob_message';
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
		this.open("sys_oob_message");
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
		label.appendChild(slider);
		return(div);
	}

	create_generic_window(id="",named="",onclose="") {

		let l;
		let cdiv;
		let divstack = [];

		let overlay = document.createElement('div');
		overlay.id=id;
		overlay.classList.add('overlay');
		divstack.push(overlay);
		cdiv = overlay;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.id = `${id}_borders`;
		l.classList.add('menupop');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('span');
		cdiv.appendChild(l);
		l.id = `${id}_close`;
		if(onclose == "") {
			l.onclick = (()=>this.done());
		} else {
			l.onclick = onclose;
		}
		l.classList.add('close');
		l.title = `Close ${named}`;
		l.innerText = "×";

		let content = document.createElement('div');
		cdiv.appendChild(content);
		content.id = `${id}_content`;

		let ret = [];
		ret[0] = overlay;
		ret[1] = content;

		return(ret);
	}

	applyMenuNo(index) {
		let theme = this.menuThemes[index];
		this.mydiv.insertBefore(this.create_custom_menus(theme),this.mydiv.firstChild);
		localStorage.setItem("menuthemename",theme.name);
		this.lociterm.gmcp.lociHotkeyGet();
	}

	applyMenuName(name) {
		for(let idx=0;idx<this.menuThemes.length;idx++) {
			let theme = this.menuThemes[idx];
			if(theme.name === name) {
				this.applyMenuNo(idx);
				let sel = document.getElementById("menu-select");
				sel.value = idx;
				break;
			}
		}
	}

}

export { MenuHandler };
