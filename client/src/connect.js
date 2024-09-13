// connect.js - direct connection window
// Created: Mon Aug  5 08:54:28 AM EDT 2024
// $Id: connect.js,v 1.1 2024/09/13 14:32:58 malakai Exp $

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

import TerminalIcon from './img/bezeltermicon192.png';

class ConnectGame {

	constructor(lociterm,menuhandler) {

		this.lociterm = lociterm;
		this.menuhandler = menuhandler;
		this.elementid = "";
		this.hostname = "localhost";
		this.port = "4000";
		this.ssl = false;
		this.in_use = false;
		this.wants_to_select = false;
		this.gamelist = [];
		this.aboutgame = undefined;

		this.menuhandler.mydiv.appendChild(
			this.create_connect_direct("menu_connect_direct")
		);

		this.menuhandler.mydiv.appendChild(
			this.create_game_select("menu_game_select")
		);
		this.menuhandler.openHandler.set(	
			"menu_game_select", 
			() => { 
				this.wants_to_select = true;
				this.lociterm.requestGameList(); 
			}
		);

		this.menuhandler.mydiv.appendChild(
			this.create_game_about("menu_game_about")
		);
		this.menuhandler.openHandler.set(	
			"menu_game_about", 
			() => { 
				this.about_game_open(); 
			}
		);

	}

	generic_field(id,name="Label",onchange) {
		let div = document.createElement('div');
		div.id = id;

		let label = document.createElement('label');
		label.innerText = name;
		label.id = `${id}_label`;
		label.setAttribute("for",`${id}_input`);

		let input = document.createElement('input');
		input.id = `${id}_input`;
		input.setAttribute("name",label.id);
		input.setAttribute("type","text");
		input.setAttribute("autocapitalize","none");
		input.addEventListener('change',onchange);

		div.appendChild(label);
		div.appendChild(input);
		return(div);
	}

	generic_checkbox(id,name="Label",onchange) {
		let div = document.createElement('div');
		div.classList.add('genericcheckbox');
		div.id = id;

		let label = document.createElement('label');
		label.innerText = name;
		label.id = `${id}_label`;
		label.setAttribute("for",`${id}_checkbox`);

		let input = document.createElement('input');
		input.id = `${id}_checkbox`;
		input.setAttribute("name",label.id);
		input.setAttribute("type","checkbox");
		input.addEventListener('change',onchange);

		div.appendChild(input);
		div.appendChild(label);
		return(div);
	}

	create_connect_direct(elementid) {
		
		let l;
		let cdiv;
		let divstack = [];
		let id;
		let deets;
		let summary;

		this.elementid = elementid;

		let overlay = document.createElement('div');
		overlay.id=elementid;
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
			this.in_use = false;
			this.menuhandler.done(elementid);
		} );
		l.classList.add('close');
		l.title = `Close ${elementid}`;
		l.innerText = "×";

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.innerText = "💡Suggest a Game";

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		id = `${elementid}_hostname`;
		l = this.generic_field(id,"Host Name",
			((e)=>{this.hostname = e.target.value })
		);
		cdiv.appendChild(l);

		id = `${elementid}_port`;
		l = this.generic_field(id,"Port Number",
			((e)=>{this.port = e.target.value })
		);
		l.childNodes[1].setAttribute("type","number");
		cdiv.appendChild(l);

		// ssl
		id = `${elementid}_ssl`;
		l = this.generic_checkbox(id,"Use SSL",
			((e)=>{this.ssl = e.target.checked })
		);
		cdiv.appendChild(l);

		l = document.createElement('button');
		cdiv.appendChild(l);
		l.setAttribute("type","submit");
		l.innerText = "Submit";
		l.onclick = (
			()=> {
				this.menuhandler.close(this.elementid);
				this.in_use = true;
				let server = {};
				if( (this.host == "") || (this.port =="") || (this.port == 0) ) {
					this.host == "";
					this.port == 0;
					this.ssl = 0;
					this.in_use = false;
				} else {
					server.hostname = this.hostname;
					server.port = this.port;
					server.ssl = this.ssl;
				}
				// Disable autologin.  This is to avoid giving old creds to a new server. 
				this.menuhandler.voidLoginAutologin();
				this.lociterm.terminal.reset();
				this.lociterm.terminal.clear();
				this.connect_direct(server);
			}
		);

		this.menuhandler.openHandler.set(
			"menu_game_select", 
			() => { 
				document.getElementById(`${elementid}_host`).value = this.host;
				document.getElementById(`${elementid}_port`).value = this.port;
				document.getElementById(`${elementid}_ssl`).checked = this.ssl;
			}
		);
	
		return(overlay);
	}

	connect_direct(server) {
		console.log(`connect_direct: ${server.hostname} ${server.port} ssl=${server.ssl}`);
		this.lociterm.reconnect_key = "";
		this.lociterm.doConnectGame();
	}

	create_game_select(elementid) {
		
		let l;
		let cdiv;
		let divstack = [];
		let id;
		let deets;
		let summary;

		this.elementid = elementid;

		let overlay = document.createElement('div');
		overlay.id=elementid;
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
			this.in_use = false;
			this.wants_to_connect = false;
			this.menuhandler.done(elementid);
		} );
		l.classList.add('close');
		l.title = `Close ${elementid}`;
		l.innerText = "×";

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.innerText = "Game Server";

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		// ------------------- 
		
		id = `${elementid}_gamedata`;
		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('gamelist');
		l.id = `${elementid}_gamelist`;
		l.classList.add('gamelist');
		l.innerText = "(Nothing yet...)";

		l = document.createElement('button');
		cdiv.appendChild(l);
		l.id = `${elementid}_suggest`;
		l.setAttribute("type","submit");
		l.innerText = "Suggest New";
		l.onclick = (
			()=> {
				this.menuhandler.close(this.elementid);
				this.menuhandler.open("menu_connect_direct");
			}
		);

		return(overlay);
	}

	// update the list of games in the UI.
	update_game_select(gamedata) {

		let gdiv = document.getElementById("menu_game_select_gamelist");
		// Delete all of the items, we're replacing them with what's in the
		// gamedata object.
		gdiv.innerText = "";
		while(gdiv.children[0] != undefined) {
			gdiv.children[0].remove();
		}

		// ...if there's anything there, that is.
		if( (gamedata == undefined) || 
			(gamedata == {} )
		) {
			gdiv.innerText = "(Nothing yet...)";
			return;
		}

		if(gamedata.servers) {
			this.gamelist = gamedata.servers;
		}

		let table  = document.createElement('table');
		let game;

		
		for (let idx=0; idx<gamedata.servers.length; idx=idx +1) {
			game = gamedata.servers[idx];
			let row  = document.createElement('tr');
			let data;

			// what do do when a row is clicked? 
			// open the game.
			// row.onclick = (() => this.select_gamerow(idx));
			// open the verbose description.
			row.onclick = (() => this.about_gamerow(idx));

			table.appendChild(row);

			data  = document.createElement('td');
			data.innerText = "";
			if( (this.hostname == game.host) &&
				(this.port == game.port) &&
				(this.ssl == game.ssl)
			) {  
				// This is the game we're connected to.
				data.innerText += "✅";
			}
			if(game.default_game == 1) {
				// This is a default game.
				data.innerText += "📌";
			}
			if((game.ssl == 1)) {
				// This is in SSL game.
				data.innerText += "🔐";
			} 

			row.appendChild(data);

			data  = document.createElement('td');
			if(game.name && (game.name != "")) {
				data.innerText = game.name;
			} else {
				data.innerText = `${game.host}:${game.port}`;
				data.style.fontStyle = 'italic';
			}
			if(game.default_game == 1) {
				data.style.fontWeight = 'bold';
			}
			row.appendChild(data);
			
			table.appendChild(row);
		}

		gdiv.appendChild(table);
		return;
	}

	// Connect to the game stored in the this.gamelist by number.
	select_gamerow(rownumber) {
		let game = this.gamelist[rownumber];
		this.hostname = game.host;
		this.port = game.port;
		this.ssl = game.ssl;
		this.wants_to_select = false;
		this.in_use = true;
		this.menuhandler.voidLoginAutologin();
		this.menuhandler.close("menu_game_select");
		this.lociterm.terminal.reset();
		this.lociterm.reconnect_key = "";
		this.lociterm.doConnectGame();
	}

	// Connect to the game stored in the this.gamelist by number.
	about_gamerow(rownumber) {
		let game = this.gamelist[rownumber];
		this.menuhandler.open("menu_game_about");
		this.aboutgame = undefined;
		this.update_game_about(game);  // give it what you've already got.
		this.lociterm.requestGameInfo(game);
	}

	about_game_open() {
		if(this.aboutgame == undefined) {
			let req = new Object;
			try {
				req.host = this.lociterm.reconnect_key.host;
				req.port = this.lociterm.reconnect_key.port;
				req.ssl = this.lociterm.reconnect_key.ssl;
				this.lociterm.requestGameInfo(req);
				this.aboutgame = -1;
			} catch {
				// oh well.  can't do it, can't do it.
			}
		}
	}

	create_game_about(elementid) {
		
		let l;
		let cdiv;
		let divstack = [];
		let id;
		let deets;
		let summary;

		this.elementid = elementid;

		let divs = this.menuhandler.create_generic_window(
			elementid,
			"About Game",
			(()=> {
				this.in_use = false;
				this.wants_to_select = false;
				this.menuhandler.done(elementid);
			})
		);
		let overlay = divs[0];
		let content = divs[1];

		cdiv = content;
		cdiv.classList.add('gameabout');

		l = document.createElement('form');
		cdiv.appendChild(l);
		l.setAttribute("actions","");
		l.setAttribute("method","dialog");
		l.classList.add('gameabout');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('imgcontainer');
		l.id = `${elementid}_imgcontainer`;
		divstack.push(l);
		cdiv = l;


		l = document.createElement('span');
		cdiv.appendChild(l);
		l.classList.add('close');
		l.title = `Close ${elementid}`;
		l.innerText = "×";

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		// ------------------- 
		
		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('gameabout');
		l.id = `${elementid}_gameabout`;
		l.innerText = "(Nothing yet...)";

		l = document.createElement('button');
		cdiv.appendChild(l);
		l.id = `${elementid}_connect`;
		l.setAttribute("type","submit");
		l.innerText = "Connect";
		l.onclick = (
			()=> {
				this.menuhandler.close('menu_game_about');
			}
		);

		return(overlay);
	}

	update_game_about(game) {

		let l;
		let t;
		let cdiv;
		let divstack = [];

		if((game == undefined) || (game == {})) {
			return;
		}

		let mssp = {};
		if(game.mssp) {
			if( typeof(game.mssp) != "object" ) {
				try { mssp = JSON.parse(game.mssp) } catch { mssp = {} };
			} else {
				mssp = game.mssp;
			}
		}

		let id = "menu_game_about";
		cdiv = document.getElementById(`${id}_imgcontainer`);

		cdiv.innerText = "";
		while(cdiv.children[0] != undefined) {
			cdiv.children[0].remove();
		}

		l = document.createElement('figure');
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;

		l = document.createElement('img');
		l.classList.add('siteicon');
		if(game.icon) {
			l.src = game.icon;
		} else {
			l.src = TerminalIcon ;
		}
		l.onerror = ((e)=>{ e.currentTarget.onerror=null; e.currentTarget.src = TerminalIcon; });
		cdiv.appendChild(l);

		l = document.createElement('figcaption');
		l.classList.add('gamename');
		if(game.name && (game.name != "") ) {
			l.innerText = `${game.name}`;
		} else {
			l.innerText = `${game.host} ${game.port}`;
		}

		cdiv.appendChild(l);

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

		cdiv = document.getElementById(`${id}_gameabout`);
		// Delete all of the items, we're replacing them with what's in the
		// gamedata object.
		cdiv.innerText = "";
		while(cdiv.children[0] != undefined) {
			cdiv.children[0].remove();
		}

		// ADD one for this is the default game.

		l = document.createElement('div');
		cdiv.appendChild(l);
		divstack.push(l);
		cdiv = l;

		// type of game
		l = document.createElement('div');
		if(mssp.GAMEPLAY) {
			l.innerText += `${mssp.GAMEPLAY} `;
		}
		if(mssp.GENRE && mssp.SUBGENRE) {
			l.innerText += `${mssp.GENRE}/${mssp.SUBGENRE} `;
		} else if(mssp.GENRE) {
			l.innerText += `${mssp.GENRE} `;
		} else if(mssp.SUBGENRE) {
			l.innerText += ` ${mssp.SUBGENRE} `;
		}
		cdiv.appendChild(l);

		l = document.createElement('div');
		if(mssp.LANGUAGE) {
			l.innerText += `${mssp.LANGUAGE} Speaking `;
		}
		if(mssp.LOCATION) {
			l.innerText += `Server in ${mssp.LOCATION} `;
		}
		cdiv.appendChild(l);

		// FAMILY and CODEBASE
		if(mssp.FAMILY || mssp.CODEBASE) {
			l = document.createElement('div');
			l.innerText+= "Running ";
			if(mssp.FAMILY) {
				l.innerText += `${mssp.FAMILY} `;
			}
			if(mssp.CODEBASE) {
				l.innerText += `${mssp.CODEBASE}`;
			}
		cdiv.appendChild(l);
		}

		if(mssp.DESCRIPTION) {
			l = document.createElement('div');
			l.innerText = `${mssp.DESCRIPTION}`;
			cdiv.appendChild(l);
			divstack.push(l);
			cdiv = l;
		}

		if(mssp.WEBSITE) {
			l = document.createElement('div');
			cdiv.appendChild(l);
			divstack.push(l);
			cdiv = l;
			t = document.createTextNode("Website: ");
			cdiv.appendChild(t);
			l = document.createElement('a');
			l.href = mssp.WEBSITE;
			l.target = "_blank";
			if(mssp.WEBSITE.length > 30) {
				l.innerText = mssp.WEBSITE.substr(0,30);
				l.innerText += " …";
			} else {
				l.innerText = mssp.WEBSITE;
			}
			cdiv.appendChild(l);
			divstack.pop(); //imgcontainer
			cdiv = divstack[divstack.length-1];
		}

		if(mssp.DISCORD) {
			l = document.createElement('div');
			cdiv.appendChild(l);
			divstack.push(l);
			cdiv = l;
			t = document.createTextNode("Discord: ");
			cdiv.appendChild(t);
			l = document.createElement('a');
			l.href = mssp.WEBSITE;
			l.target = "_blank";
			if(mssp.DISCORD.length > 32) {
				l.innerText = mssp.DISCORD.substr(0,32);
				l.innerText += "…";
			} else {
				l.innerText = mssp.DISCORD;
			}
			cdiv.appendChild(l);
			divstack.pop(); //imgcontainer
			cdiv = divstack[divstack.length-1];
		}

		if(mssp.CONTACT) {
			l = document.createElement('div');
			l.innerText = `Contact: ${mssp.CONTACT}`;
			cdiv.appendChild(l);
		}

		l = document.createElement('div');
		if(game.ssl) {
			l.innerText = "telnets://";
		} else {
			l.innerText = "telnet://";
		}
		l.innerText += `${game.host}:${game.port}`;
		cdiv.appendChild(l);

		divstack.pop(); 
		cdiv = divstack[divstack.length-1];

		l = document.getElementById(`${id}_connect`);
		l.onclick = (
			()=> {
				this.menuhandler.done();
				this.in_use = true;
				let server = {};
				server.hostname = this.hostname = game.host;
				server.port = this.port = game.port;
				server.ssl = this.ssl = game.ssl;
				// Disable autologin.  This is to avoid giving old creds to a new server. 
				this.menuhandler.voidLoginAutologin();
				this.lociterm.terminal.reset();
				this.connect_direct(server);
			}
		);

		return;
	}

}

export { ConnectGame };
