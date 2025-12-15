// menuhandler.js - LociTerm menu driver code
// Adapted from loinabox, Used with permission from The Last Outpost Project
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: menuhandler.js,v 1.40 2024/12/08 04:28:38 malakai Exp $

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
import { NetStat } from './netstat.js';

// kinda silly listing these menus seperately but hey, this is webpack.
import SystemMenu from './menu/system_menu.json';
import LoMenu from './menu/lo_menu.json';
import DiagonalMenu from './menu/diagonal_menu.json';
import CardinalMenu from './menu/cardinal_menu.json';
import TelnetMenu from './menu/telnet_menu.json';

import PackageData from '../package.json';

export function hiya() {
	console.log("Hiya!");
}

class MenuHandler {
	
	constructor(lociterm) {

		this.lociterm = lociterm;
		this.openwindow = [];
		this.openHandler = new Map();
		this.menuThemes = this.consolodateMenuThemes();
		this.menuThemename = this.menuThemes[0];
		this.netstat = new NetStat(this.lociterm,this);

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
		this.mydiv.appendChild(this.create_custom_menus(this.menuThemename));
		this.mydiv.appendChild(this.create_loginbox());
		this.mydiv.appendChild(this.create_settings());
		this.mydiv.appendChild(this.create_termsettings());
		this.mydiv.appendChild(this.create_filters());
		this.mydiv.appendChild(this.create_about());
		this.mydiv.appendChild(this.create_disclaimer());
		this.mydiv.appendChild(this.create_connect());
		this.mydiv.appendChild(this.create_oob_message());
		this.mydiv.appendChild(this.netstat.create_netstat());

		// dont loadLogin until lociterm has loaded connectgame
		//this.loadLogin();

	}

	consolodateMenuThemes() {
		var themes = [];
		themes.push(CardinalMenu);
		themes.push(DiagonalMenu);
		themes.push(TelnetMenu);
		themes.push(LoMenu);
		themes.push({ name: "none", label: "None" });
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
	open(name,focus) {
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
		e.setAttribute("tabindex",0);
		if(e.classList.contains("menuside")) {
			//e.style.right = '0%';
			e.classList.remove("menuside-close");
			e.classList.add("menuside-open");
		}
		this.openwindow[name] =1;
		// This is on a setTimeout because the window might not be animated
		// onto the screen yet, and can't get focus until it is.
		setTimeout(()=>{	
			if(focus != undefined) {
				// if there was a recommended focus point, use it.
				document.getElementById(focus).focus();
			} else {
				let focusme = e.getElementsByClassName("overlay_content")[0];
				if( focusme != null ) {
					focusme.firstElementChild.focus();
				} else {
					e.firstElementChild.focus();
				}
			}
		},100);

		if( (call = this.openHandler.get(name)) ) {
			call(name);
		}
	};

	// always close a single menu item.
	close(name) {
		var e = document.getElementById(name);
		if(e == null) return;
		e.style.visibility = 'hidden';
		e.setAttribute("tabindex",-1);
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
		if( (this.lociterm.gmcp.mod("CharLogin").charLoginRequested == true) ) {
			this.lociterm.gmcp.mod("CharLogin").sendCharLoginCredentials(username,password);
		} else {
			// don't route it through the nerfbar, paste directly to the terminal.
			setTimeout(()=>this.lociterm.paste(`${username}\n`),0);
			setTimeout(()=>this.lociterm.paste(`${password}\n`),250);
		}

		return;

	}

	focusMainMenu(id) {
		if( id == undefined ) {
			id = "menubox";
		}
		let menu = document.getElementById(id);
		menu.firstElementChild.focus();
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
		} else {
			console.warn(`Custom menu contained no menubox definition. ${custom}`);
		}

		let menubar = menu.menubar;
		if(custom.menubar) {
			menubar = menubar.concat(custom.menubar);
		} else {
			console.warn(`Custom menu contained no menubar definition. ${custom}`);
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

		let box = document.createElement('nav');
		box.setAttribute("aria-label","Main Button Grid");
		box.setAttribute("role","menu");
		box.setAttribute("tabindex",-1);
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
			if(item == undefined) continue;
			//let container = document.createElement('div');
			let container = document.createElement('button');
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

			if( item.text !== undefined && item.img === undefined) {
				container.innerText = item.text;
			}

			if( item.img != undefined) {
				let fig = document.createElement('figure');
				let img = document.createElement('img');
				fig.appendChild(img);
				img.src = item.img;
				img.onerror = ((e)=>{ e.currentTarget.onerror=null; e.currentTarget.src = TerminalIcon; });
				if (item.text !== undefined) {
					let cap = document.createElement('caption');
					cap.innerText = item.text;
					fig.appendChild(cap);
				}
				container.appendChild(fig);
			}
			
			

			if(item.name != undefined) {
				container.setAttribute("aria-label",item.name);
			}
			container.setAttribute("role","menuitem");
			container.setAttribute("tabindex",-1);

			// The arrow keys navigate the grid, but 'falling off the edge'
			// takes focus to to the next element such that all elements can be
			// traversed by holding down a direction.  This is for aria
			// accessibility.
			container.onkeydown = ((e)=> {
				let sib = null;
				if(e.key === "ArrowLeft") {
					sib = e.currentTarget.nextSibling;
				}
				if(e.key === "ArrowRight") {
					sib = e.currentTarget.previousSibling;
				}
				if(e.key === "ArrowUp") {
					sib = e.currentTarget.previousSibling;
					for( let i=1; (sib) && (i<menubox.width); i++) {
						sib = sib.previousSibling;
					}
					if( sib === null ) {
						// Fell off the edge- go the long way around.
						sib = e.currentTarget.previousSibling;
						let skip = (menubox.width * (menubox.height -1))
						for( let i=0; (sib) && (i<skip); i++) {
							sib = sib.nextSibling;
						}
					}
				}
				if(e.key === "ArrowDown") {
					sib = e.currentTarget.nextSibling;
					for( let i=1; (sib) && (i< menubox.width); i++) {
						sib = sib.nextSibling;
					}
					if(sib === null) {
						// Fell off the edge- go the long way around.
						sib = e.currentTarget.nextSibling;
						let skip = (menubox.width * (menubox.height -1))
						for( let i=0; (sib) && (i<skip); i++) {
							sib = sib.previousSibling;
						}
					}
				}
				if(e.key === "Home") {
					sib = e.currentTarget.parentElement.firstElementChild;
				}
				if(e.key === "End") {
					sib = e.currentTarget;
					while(sib.nextSibling) {
						sib = sib.nextSibling;
					}
				}
				if(sib) {
					// one of those keypresses set a new focus target.
					sib.focus();
					return;
				}
				// Any other keys to intercept?
				if( e.key === "Escape" ||
					((e.key == "m") && (e.ctrlKey === true))
				) {
					this.lociterm.focus();
				}
				// nope, nothing we're interested in.
			});

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

			box.appendChild(container);
		}
		box.firstElementChild.setAttribute("tabindex",0);
		box.firstElementChild.setAttribute("aria-keyshortcuts","control+m");
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
			let c = document.createElement('nav');
			c.id = side.id
			c.classList.add('menu');
			c.classList.add('menuside');
			c.classList.add('menuside-close');
			c.setAttribute("aria-label",c.id);
			c.setAttribute("role","menu");

			// Keywords:
			//	label
			//	open
			//	send
			//	prompt
			//	id
			//	hotkey

			for(let j=0; j<side.item.length; j++) {
				let item = side.item[j];
				let s = document.createElement('button');
				if(item.id != undefined) {
					s.id = item.id
				}

				// assign the right onclick function to the div..
				if ( item.send != undefined ) {
					s.classList.add('send');
					if ( item.open != undefined ) {
						// you can have both send and open in the same definition.
						s.onclick = (e) => { this.send(item.send); this.open(item.open); };
					} else {
						s.onclick = (e) => { this.send(item.send); };
					}
					s.innerText = item.send;
				} else if ( item.open != undefined ) {
					s.classList.add('open');
					// Really, use a label with open.  But... 
					let lessugly = item.open.replace(/^menu_/i,"")
					lessugly = lessugly.replace(/^sys_/i,"")
					s.innerText = `${lessugly}`;
					s.setAttribute("aria-haspopup","true");
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

				s.setAttribute("role","menuitem");
				s.setAttribute("aria-label",s.innerText);
				s.setAttribute("tabindex",0);


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

				if (item.direct != undefined) {
					// send directly to the terminal, bypassing any nerfbar.
					s.onclick = () => {
						this.done();
						this.lociterm.paste(item.direct);
					}
				}

				// hotkey binding hook
				if ( this.lociterm.hotkey.keyIdx(item.hotkey) !== -1 ) {
					item.hotkey = item.hotkey.toLowerCase();
					s.classList.add('send');
					s.classList.add('hotkey');
					s.classList.add(item.hotkey);
					if(item.label !== undefined) {
						this.lociterm.hotkey.setLabel(item.hotkey,item.label);
					} 
					s.innerText = this.lociterm.hotkey.getLabel(item.hotkey);

					if(item.str != undefined) {
						this.lociterm.hotkey.setStr(item.hotkey,item.str);
					}
					s.onclick = () => this.lociterm.hotkey.sendKey(item.hotkey);
				}

				if ( item.disconnect != undefined ) {
					s.onclick = () => this.disconnect(item.disconnect);
				}

				if ( item.reconnect != undefined ) {
					s.classList.add('send');
					s.onclick = () => this.lociterm.reconnect();
				}

				s.onkeydown = ((e)=> {
					let sib = null;
					if(e.key === "ArrowDown" || e.key === "ArrowRight") {
						sib = e.currentTarget.nextSibling;
					}
					if(e.key === "ArrowUp" || e.key === "ArrowLeft") {
						sib = e.currentTarget.previousSibling;
					}
					if(e.key === "Home") {
						sib = e.currentTarget.parentElement.firstElementChild;
					}
					if(e.key === "End") {
						sib = e.currentTarget;
						while(sib.nextSibling) {
							sib = sib.nextSibling;
						}
					}
					if(sib) {
						sib.focus();
						return;
					}
					// Any other keys to intercept?
					if( e.key === "Escape" ||
						((e.key == "m") && (e.ctrlKey === true))
					) {
						this.lociterm.focus();
					}
					// nope, nothing we're interested in.
				});


				c.appendChild(s);
			}

			bar.appendChild(c);
		}

		return(bar);
	}


	// Build the select box for choosing a theme from the themes array.
	create_generic_selector(id, label, themes, initval, oninput) {

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
		let sel =l; 

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

		sel.value = `${initval}`;

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];
		return(main);

	}

	// a generic corner selector
	create_anchor_selector(named="",labeled="",initval="tl",oninput="") {
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
		select.value = initval;
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
			this.lociterm.gmcp.mod("CharLogin").charLoginCancel();
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
		l = this.create_generic_checkbox("pwshow","Show Password",false,
			((e) => {
				let pw = document.getElementById("current-password");
				if(pw.type === "password") {
					pw.type = "text";
				} else {
					pw.type = "password";
				}
			})
		);
		cdiv.appendChild(l);

		// add a checkbox.
		l = this.create_generic_checkbox("remember","Remember Me",true,
			((e) => {this.saveLogin()})
		);
		cdiv.appendChild(l);

		// add a checkbox.
		l = this.create_generic_checkbox("autologin","Auto Login",true,
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
				if( (this.lociterm.gmcp.mod("CharLogin").charLoginRequested == true) ) {
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

	create_settings(menuname="sys_settings") {
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
		let deets;

		let handle = this.create_generic_live_window(
			menuname,
			"User Interface",
			()=>this.create_settings(menuname), // required fn pointer back to this function.
			"" // whatever is the default for onclose.
		);

		if(handle.wait) {
			return(handle.overlay);
		}

		box = handle.content;

		let menuitem = this.lociterm.lociThemes.findIndex(
			(x)=>x.name == this.lociterm.pref.get("ui.themename")
		);
		// Theme selector combo
		l = this.create_generic_selector(
			"theme-select",
			"Theme",
			this.lociterm.lociThemes,
			menuitem,
			((e)=>{
				this.lociterm.pref.set("ui.themename",this.lociterm.lociThemes[e.srcElement.value].name)
				// this close/open shuffle is because setting the themename can
				// reset some of the other items in this window.  Closing and
				// opening is akin to refresh.
				this.close(menuname);
				this.open(menuname);
			})
		);
		box.appendChild(l);

		menuitem = this.menuThemes.findIndex(
			(x)=>x.name == this.lociterm.pref.get("menu.themename")
		);
		l = this.create_generic_selector(
			`${menuname}_select`,
			"Menu Style",
			this.menuThemes,
			menuitem,
			((e)=>{ 
				this.lociterm.pref.set("menu.themename",this.menuThemes[e.srcElement.value].name);
			})
		);
		box.appendChild(l);

		deets = this.create_generic_details("Sizes",menuname);
		box.appendChild(deets);

		// Terminal Font Size slider
		l = this.create_generic_slider(
			`${menuname}_termfont`,
			`Terminal Text`,
			8,24,0.0625,
			parseFloat(this.lociterm.pref.get("xtermoptions.fontSize")),
			(e)=> {
				this.lociterm.pref.set("xtermoptions.fontSize",e.srcElement.value);
			}
		);
		deets.appendChild(l);

		// Terminal Line Size slider
		l = this.create_generic_slider(
			`${menuname}_termlineheight`,
			`Line Spacing`,
			1,2,0.05,
			parseFloat(this.lociterm.pref.get("xtermoptions.lineHeight")),
			(e)=> {
				this.lociterm.pref.set("xtermoptions.lineHeight",e.srcElement.value);
			}
		);
		deets.appendChild(l);

		// UI Font Size slider
		l = this.create_generic_slider(
			`${menuname}_uifont`,
			`Menu Text`,
			8,24,0.0625,
			parseFloat(this.lociterm.pref.get("ui.fontSize")),
			(e)=> {
				this.lociterm.pref.set("ui.fontSize",`${e.srcElement.value}px`);
			}
		);
		deets.appendChild(l);

		// UI Button Size slider
		l = this.create_generic_slider(
			`${menuname}_fingersize`,
			`Button Size`,
			5,15,0.125,
			parseFloat(this.lociterm.pref.get("ui.fingerSize")),
			(e)=> {
				this.lociterm.pref.set("ui.fingerSize",`${e.srcElement.value}mm`);
			}
		);
		deets.appendChild(l);


		
		deets = this.create_generic_details("Visual Effects",menuname);
		box.appendChild(deets);

		// UI Button Fade slider
		l = this.create_generic_slider(
			`${menuname}_menufade`,
			`Menu Transparency`,
			0.0,1.0,0.05,
			1.0-this.lociterm.pref.get("menu.fade"),
			(e)=> {
				this.lociterm.pref.set("menu.fade",1.0-e.srcElement.value);
			}
		);
		deets.appendChild(l);

		// Contrast Ratio slider
		l = this.create_generic_slider(
			`${menuname}_contrastratio`,
			`Enhance Contrast`,
			1,8,0.25,
			this.lociterm.pref.get("xtermoptions.minimumContrastRatio"),
			(e)=> {
				this.lociterm.pref.set("xtermoptions.minimumContrastRatio",e.srcElement.value);
			}
		);
		deets.appendChild(l);

		// drawBoldTextInBrightColors
		// This section of code is to be forever known as the "SlySven Memorial
		// Bold Is Bright Button".  Do not remove this comment.

		// I met a programmer of an antique node,
		// Who said—“Two vast and trunkless rendering modes
		// Stand in the desert. . . . Near them, on the sand,
		// Half sunk a shattered visage lies, whose frown,
		// And wrinkled lip, and sneer of cold command,
		// Tell that its coder well those passions read
		// Which yet survive, stamped on these terminal things,
		// The colors that mocked them, and the fonts that fed;
		// And on the commit log, these words appear:
		// My name is SlySven, King of Kings;
		// Look on my text, ye Mighty, and despair!"
		// Nothing Bright nor Bold remains. Round the decay
		// Of that colossal spec, boundless and bare
		// Although muds still run, played to this day.

		l = this.create_generic_checkbox(
			`${menuname}_drawBoldTextInBrightColors`,
			"Bold is Bright",
			this.lociterm.pref.get("xtermoptions.drawBoldTextInBrightColors"),
			((e)=>{
				this.lociterm.pref.set("xtermoptions.drawBoldTextInBrightColors",e.srcElement.checked);
			})
		);
		deets.appendChild(l);

		// (Sorry, Percy.) -jsj

		l = this.create_generic_button(
			`${menuname}_crt`,
			"CRT Filters",
			"submit",
			((e)=>{
				this.open("sys_filters");
			})
		);
		deets.appendChild(l);

		deets = this.create_generic_details("Sound Effects",menuname);
		box.appendChild(deets);

		// terminalBell
		l = this.create_generic_checkbox(
			`${menuname}_terminalBell`,
			"Ring Terminal Bell",
			this.lociterm.pref.get("sfx.terminalBell"),
			((e)=>{
				this.lociterm.pref.set("sfx.terminalBell",e.srcElement.checked);
			})
		);
		deets.appendChild(l);

		// mcmp global mute
		l = this.create_generic_checkbox(
			`${menuname}_mcmpPlayAudio`,
			"Play MCMP Audio",
			this.lociterm.pref.get("sfx.mcmpPlayAudio"),
			((e)=>{
				this.lociterm.pref.set("sfx.mcmpPlayAudio",e.srcElement.checked);
			})
		);
		deets.appendChild(l);

		// mcmp captions
		l = this.create_generic_checkbox(
			`${menuname}_mcmpShowCaptions`,
			"Show MCMP Captions",
			this.lociterm.pref.get("sfx.mcmpShowCaptions"),
			((e)=>{
				this.lociterm.pref.set("sfx.mcmpShowCaptions",e.srcElement.checked);
			})
		);
		deets.appendChild(l);
		
		deets = this.create_generic_details("Menu Layout",menuname);
		box.appendChild(deets);

		// a selector for Icon Anchor
		field = this.create_anchor_selector(`${menuname}_bgridAnchor-select`,"Button Grid",
			this.lociterm.pref.get("menu.bgridAnchor"),
			((e)=>{
				this.lociterm.pref.set("menu.bgridAnchor",e.srcElement.value);
			})
		);
		deets.appendChild(field);

		// a selector for sidemenu Anchor
		field = this.create_anchor_selector(`${menuname}_menusideAnchor-select`,"Menus",
			this.lociterm.pref.get("menu.menusideAnchor"),
			((e)=>{
				this.lociterm.pref.set("menu.menusideAnchor",e.srcElement.value);
			})
		);
		deets.appendChild(field);

		// Show terminal scroll bar
		l = this.create_generic_checkbox(
			`${menuname}_termScrollBar`,
			"Hide Scroll Bar",
			!this.lociterm.pref.get("ui.termScrollBar"),
			((e)=>{
				this.lociterm.pref.set("ui.termScrollBar",!e.srcElement.checked);
			})
		);
		deets.appendChild(l);

		// A selector for screenreader hinting.  Its a good idea to leave the
		// hints on by default, because a VI user is going to have a tougher
		// time enabling them than a non-VI user will have disabling them.
		// This option exists because a previous verion of xterm.js couldn't do
		// clickable links and ARIA screen reader hints at the same time.  It
		// is *still* here because the tooling was already in place, and some
		// slower web browsers might be sped up by leaving the hints off.
		field = this.create_generic_checkbox(
			"reader-select",
			"Accessibility Hints",
			this.lociterm.pref.get("xtermoptions.screenReaderMode"),
			((e)=>{
				this.lociterm.pref.set("xtermoptions.screenReaderMode",
					e.srcElement.checked
				);
			})
		);
		deets.appendChild(field);

		return(overlay);
	}

	// create a window that self-deletes and recreates itself every time it is
	// requested to be opened.  Initial values of the widgets should come from
	// this.lociterm.pref.get()
	//
	// Return value:
	//
	//	ret.wait = true  
	//	Don't actually remake the widgets this time, the system might not have
	//	all the data ready for that yet.
	//
	//	ret.overlay = the div that should be inserted somewhere in the
	//	document.
	//
	//	ret.content = the div that should have the widgets appended to it.

	create_generic_live_window(id="",named="",recreate="",onclose="") {
		let ret = {};
		ret.overlay = document.getElementById(id);
		ret.content = null;
		ret.wait = false;

		if(ret.overlay == null) {
			let divs = this.create_generic_window(
				id,named,onclose
			);
			ret.overlay = divs[0]; /*this is horrible. */
			ret.content = divs[1];
			// set the openhandler to recreate this menu fresh each time.
			this.openHandler.set(id,
				(id)=>{recreate(id);}
			);
			// and don't open it this time, wait until next.
			ret.wait = true;
		} else {
			// grab the div with the content.
			ret.content = document.getElementById(`${id}_content`);
			// whack any existing widgets in the window.
			while(ret.content.children[0]!=undefined) {
				ret.content.children[0].remove();
			}
		}
		return(ret);
	}

	// returns a details item, styled and with a summary.  Details with the
	// same group name will only allow one to be open at a time.
	create_generic_details(summary="",group="") {
		let deets = document.createElement('details');
		if(group !== "") {
			deets.name = group;
		}
		deets.classList.add('generic_details');

		let l = document.createElement('summary');
		l.innerText = summary;
		deets.appendChild(l);

		return(deets);

	}

	// The sys_termsettings pref editor window.  This is a generic live window
	// that uses lociterm.prefs.get to rebuild its widgets fresh each time
	// it is opened. This is yet another try at making my window's widgets
	// reflect reality, because I'm really am not very good at this whole
	// javascript/DOM thing yet!  All of menuhandler.js has been an iteritive
	// learning experience for me.
	// 
	// -jsj Mon Feb 24 04:31:50 PM EST 2025
	create_termsettings(menuname="sys_termsettings") {

		let l;

		let handle = this.create_generic_live_window(
			menuname,
			"Terminal Settings",
			()=>this.create_termsettings(menuname), // required fn pointer back to this function.
			"" // whatever is the default for onclose.
		);

		if(handle.wait) {
			return(handle.overlay);
		}

		let win = handle.content;


		// Line Mode CheckBox
		l = this.create_generic_checkbox(
			`${menuname}_linemode`,
			"Local Line Editing",
			this.lociterm.pref.get("nerf.enabled"),
			((e)=>{
				this.lociterm.pref.set("nerf.enabled",e.srcElement.checked);
				if(e.srcElement.checked == false) {
					this.lociterm.nerfbar.close();
				} else {
					this.lociterm.nerfbar.open();
				}
			})
		);
		win.appendChild(l);

		// localecho
		l = this.create_generic_checkbox(
			`${menuname}_localecho`,
			"Line Mode Local Echo",
			this.lociterm.pref.get("nerf.localecho"),
			((e)=>{
				this.lociterm.pref.set("nerf.localecho",e.srcElement.checked);
			})
		);
		// the input is is children[0] of the generic checkbox.
		win.appendChild(l);

		// Command Chaining CheckBox
		l = this.create_generic_checkbox(
			`${menuname}_commandchains`,
			"Local Cmd Chains with ';'",
			this.lociterm.pref.get("nerf.chaining"),
			((e)=>{
				this.lociterm.pref.set("nerf.chaining",e.srcElement.checked);
			})
		);
		// the input is is children[0] of the generic checkbox.
		win.appendChild(l);

		let optionList = [];
		this.lociterm.encodings.forEach(
			(x)=>optionList.push({name: x, label: x.toUpperCase()})
		);
		let menuitem = this.lociterm.encodings.findIndex(
			(x)=> (x == this.lociterm.encoding)
		);
		// Theme selector combo
		l = this.create_generic_selector(
			"encoding-select",
			"Character Set Encoding",
			optionList,
			menuitem,
			((e)=>{
				let charset = this.lociterm.encodings[e.srcElement.value];
				this.lociterm.pref.set("lociterm.encoding", charset);
				this.lociterm.sendCharset(charset);
			})
		);
		win.appendChild(l);

		// bsSendsDel
		l = this.create_generic_checkbox(
			`${menuname}_bsSendsDel`,
			"Backspace sends DEL",
			this.lociterm.pref.get("lociterm.bsSendsDel"),
			((e)=>{
				this.lociterm.pref.set("lociterm.bsSendsDel",e.srcElement.checked);
			})
		);
		// the input is is children[0] of the generic checkbox.
		win.appendChild(l);

		// linksOpenImmediately
		l = this.create_generic_checkbox(
			`${menuname}_linksOpenImmediately`,
			"Single click links",
			this.lociterm.pref.get("lociterm.linksOpenImmediately"),
			((e)=>{
				this.lociterm.pref.set("lociterm.linksOpenImmediately",e.srcElement.checked);
			})
		);
		// the input is is children[0] of the generic checkbox.
		win.appendChild(l);

		// fontWeightBold - It doesn't really make much visual difference, so I turned it off.
		//l = this.create_generic_checkbox(
		//	`${menuname}_fontWeightBold`,
		//	"Bold is Heavy",
		//	(this.lociterm.pref.get("xtermoptions.fontWeightBold")==="bold")?true:false,
		//	((e)=>{
		//		let val = (e.srcElement.checked===true)?"bold":"normal";
		//		this.lociterm.pref.set("xtermoptions.fontWeightBold",val);
		//	})
		//);
		//// the input is is children[0] of the generic checkbox.
		//win.appendChild(l);

		// Codepage Combo

		l = this.create_generic_button(
			`${menuname}_reset`,
			"Reset Terminal",
			"submit",
			((e)=>{
				this.lociterm.resetTerm();
			})
		);
		win.appendChild(l);

		return(handle.overlay);
	}

	create_filters(menuname="sys_filters") {
		let l;

		let handle = this.create_generic_live_window(
			menuname,
			"CRT Filters",
			()=>this.create_filters(menuname), // required fn pointer back to this function.
			"" // whatever is the default for onclose.
		);

		if(handle.wait) {
			return(handle.overlay);
		}

		let win = handle.content;
	
		let item;

		// ------ menu items 
		// (This manual plumbing is pretty awful.  Fix it sometime.  -jsj)

		item = this.create_generic_checkbox("filters-select","Enabled",
			this.lociterm.pref.get("crtoptions.enabled"),
			((e)=>{
				this.lociterm.pref.set("crtoptions.enabled",e.srcElement.checked);
			})
		);
		win.appendChild(item);

		item = this.create_generic_checkbox("monotone-select","Monochrome",
			this.lociterm.pref.get("crtoptions.monotone.enabled"),
			((e)=>{
				this.lociterm.pref.set("crtoptions.monotone.enabled",e.srcElement.checked);
			})
		);
		win.appendChild(item);

		item = this.create_generic_slider("hue-slider","Phosphor Hue",
			-90,90,1,
			this.lociterm.pref.get("crtoptions.hue_rotate"),
			((e)=>{
				this.lociterm.pref.set("crtoptions.hue_rotate",e.srcElement.value);
			})
		);
		win.appendChild(item);

		item = this.create_generic_checkbox("scanline-select","Scanlines",
			this.lociterm.pref.get("crtoptions.scanline"),
			((e)=>{
				this.lociterm.pref.set("crtoptions.scanline",e.srcElement.checked);
			})
		);
		win.appendChild(item);

		item = this.create_generic_slider("barrel-slider","Barrel Distortion",
			0,256,0.5,
			this.lociterm.pref.get("crtoptions.barrel.scale"),
			((e)=>{
				this.lociterm.pref.set("crtoptions.barrel.scale",e.srcElement.value);
			})
		);
		win.appendChild(item);

		item = this.create_generic_slider("bloom-bloom-slider","Brightness",
			-2,5,0.05,
			this.lociterm.pref.get("crtoptions.bloom.bloom"),
			((e)=>{
				this.lociterm.pref.set("crtoptions.bloom.bloom",e.srcElement.value);
			})
		);
		win.appendChild(item);

		return(handle.overlay);
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
		l.innerText = "Thank you to the Multi User Dungeon #coding discord group for your help and encouragement, Nicky N. for help with the CRT Filters, Tamarindo of StickMUD for help with MCMP, and to every member of the Last Outpost Honor Guard! "

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
			"",
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

			"Parental discretion is advised. We suggest you wear a helmet and bring a jacket.",

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
				l.setAttribute("aria-live","assertive");
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
			//l.setAttribute("type","submit");
			l.id = "sys_connect_reconnect";
			l.innerText = "Reconnect";
			l.onclick = (()=> { this.done(); this.lociterm.connect() });
			l.onkeypres = ((e)=> { 
				if(e.key === "Enter") {
					e.preventDefault();
					this.done(); 
					this.lociterm.connect() 
				}
			});

		return(overlay);
	}

	update_connect_message(msg) {
		let elem;
		elem = document.getElementById("connect_status");
		elem.innerText = msg;
		this.open("sys_connect","sys_connect_reconnect");
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
				l.setAttribute("aria-live","assertive");
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

	create_generic_checkbox(named="",labeled="",initval=true,oninput="") {
		let mydiv;
		let label;
		let select;

		mydiv = document.createElement('div');
		mydiv.classList.add('genericcheckbox');

		select = document.createElement("input");
		mydiv.appendChild(select);
		select.setAttribute("type","checkbox");
		select.setAttribute("name",named);
		select.checked = initval;
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
		slider.value = parseFloat(initval);
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
		overlay.setAttribute("role","dialog");
		overlay.setAttribute("aria-live","polite");
		overlay.setAttribute("aria-label",named);
		overlay.onkeydown = ((e)=>{
			if(e.key === "Escape") {
				this.done();
				this.lociterm.focus();
			}
		});
		divstack.push(overlay);
		cdiv = overlay;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.id = `${id}_borders`;
		l.classList.add('menupop');
		divstack.push(l);
		cdiv = l;

		let wt = document.createElement('div');
		wt.classList.add('titlebar');
		cdiv.appendChild(wt);
		
		l = document.createElement('label');
		l.innerText = named;
		wt.appendChild(l);

		l = document.createElement('span');
		wt.appendChild(l);
		l.id = `${id}_close`;
		if(onclose == "") {
			l.onclick = (()=>this.done());
		} else {
			l.onclick = onclose;
		}
		l.classList.add('close');
		l.title = `Close ${named}`;
		l.setAttribute("aria-label","Close");
		l.innerText = "×";

		let content = document.createElement('div');
		cdiv.appendChild(content);
		content.id = `${id}_content`;
		content.classList.add('overlay_content');

		let ret = [];
		ret[0] = overlay;
		ret[1] = content;

		return(ret);
	}

	create_generic_input(named="",labeled="", type="", placeholder="",onchange={}) {

		let cdiv  = document.createElement('div');
		let l;

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for",named);
		l.innerText = labeled;

		l = document.createElement('input');
		cdiv.appendChild(l);
		l.setAttribute("type",type);
		l.setAttribute("placeholder",placeholder);
		l.setAttribute("name",named);
		l.id = named;
		l.addEventListener('change',onchange);

		return(cdiv);
	}

	create_generic_textarea(named="",labeled="", type="", placeholder="",onchange={}) {

		let cdiv  = document.createElement('div');
		let l;

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.setAttribute("for",named);
		l.innerText = labeled;

		l = document.createElement('textarea');
		cdiv.appendChild(l);
		l.setAttribute("type",type);
		l.setAttribute("placeholder",placeholder);
		l.setAttribute("name",named);
		l.id = named;
		l.addEventListener('change',onchange);

		return(cdiv);
	}

	create_generic_button(named="",labeled="", type="",onclick={}) {

		let cdiv  = document.createElement('div');
		cdiv.classList.add('genericbutton');

		let l = document.createElement('button');
		cdiv.appendChild(l);
		l.id = named;
		l.setAttribute("type",type);
		l.setAttribute("aria-label",labeled);
		l.innerText = labeled;
		l.onclick = onclick;
		return(cdiv);

	}

	applyMenuNo(index) {
		let theme = this.menuThemes[index];
		this.mydiv.insertBefore(this.create_custom_menus(theme),this.mydiv.firstChild);
		if( this.lociterm.gmcp.mod("LociHotkey") !== undefined) {
		//	this.lociterm.gmcp.mod("LociHotkey").sendGet();
		}
	}

	applyMenuName(name) {
		let idx = this.menuThemes.findIndex( (x)=>x.name == name );
		if(idx != -1) {
			this.applyMenuNo(idx);
		}
	}

}

export { MenuHandler };
