// connect.js - direct connection window
// Created: Mon Aug  5 08:54:28 AM EDT 2024
// $Id: connect.js,v 1.10 2024/11/26 05:33:09 malakai Exp $

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
			this.create_connect_direct("sys_connect_direct")
		);

		this.menuhandler.mydiv.appendChild(
			this.create_game_select("sys_game_select")
		);
		this.menuhandler.openHandler.set(	
			"sys_game_select", 
			() => { 
				this.wants_to_select = true;
				this.lociterm.requestGameList(); 
			}
		);

		this.menuhandler.mydiv.appendChild(
			this.create_game_about("sys_game_about")
		);
		this.menuhandler.openHandler.set(	
			"sys_game_about", 
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

		let divs = this.menuhandler.create_generic_window(
			elementid,
			"Suggest Game",
			(()=> {
				this.in_use = false;
				this.menuhandler.done(elementid);
			} 
			)
		);

		let overlay = divs[0];
		let content = divs[1];

		cdiv = content;

		l = document.createElement('form');
		cdiv.appendChild(l);
		l.setAttribute("actions","");
		l.setAttribute("method","dialog");
		//l.classList.add('menupop');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('div');
		cdiv.appendChild(l);
		l.classList.add('imgcontainer');
		divstack.push(l);
		cdiv = l;

		l = document.createElement('label');
		cdiv.appendChild(l);
		l.innerText = "💡Games must have a DNS hostname, and be open to the public. Connections to non-telnet ports are queued for adminstrative approval, and will not be immediately available.";

		divstack.pop(); //imgcontainer
		cdiv = divstack[divstack.length-1];

		id = `${elementid}_hostname`;
		l = this.generic_field(id,"Host Name",
			((e)=>{this.hostname = e.target.value.trim() })
		);
		cdiv.appendChild(l);

		id = `${elementid}_port`;
		l = this.generic_field(id,"Port Number",
			((e)=>{this.port = e.target.value.trim() })
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
				this.hostname = document.getElementById(`${elementid}_hostname_input`).value;
				this.port = document.getElementById(`${elementid}_port_input`).value;
				this.ssl = document.getElementById(`${elementid}_ssl_checkbox`).checked;
				let server = {};
				if( (this.hostname == "") || (this.port =="") || (this.port == 0) ) {
					this.host == "";
					this.port == 0;
					this.ssl = 0;
					this.in_use = false;
				} else {
					server.hostname = this.hostname;
					server.port = this.port;
					server.ssl = this.ssl;
					this.in_use = true;
				}
				this.menuhandler.close(this.elementid);
				this.menuhandler.loadLogin();
				this.lociterm.resetTerm();
				this.connect_direct(server);
			}
		);

		this.menuhandler.openHandler.set(
			"sys_game_select", 
			() => { 
				document.getElementById(`${elementid}_hostname_input`).value = this.host;
				document.getElementById(`${elementid}_port_input`).value = this.port;
				document.getElementById(`${elementid}_ssl_checkbox`).checked = this.ssl;
			}
		);
	
		return(overlay);
	}

	connect_direct(server) {
		// console.log(`connect_direct: ${server.hostname} ${server.port} ssl=${server.ssl}`);
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
			this.wants_to_select = false;
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

		let legend = document.createElement('div');
		{
			let deets = document.createElement('details');
			legend.appendChild(deets)
			let summary = document.createElement('summary');
			summary.innerText = "Legend";
			deets.appendChild(summary);
			let ul = document.createElement('ul');
			deets.appendChild(ul);
			let data = new Array;
			data.push("📌 LociTerm Default");
			data.push("✅ Connected");
			data.push("🔥 Recently Updated");
			data.push("🔐 Uses Encrypted Telnet");

			data.forEach( (v,i,a) => {
				let li = document.createElement('li');
				ul.appendChild(li);
				li.innerText = v;
			});
		}
		cdiv.appendChild(legend);

		l = document.createElement('button');
		cdiv.appendChild(l);
		l.id = `${elementid}_suggest`;
		l.setAttribute("type","submit");
		l.innerText = "Suggest New";
		l.onclick = (
			()=> {
				this.menuhandler.close(this.elementid);
				this.menuhandler.open("sys_connect_direct");
				this.wants_to_select = false;
			}
		);

		return(overlay);
	}

	// update the list of games in the UI.
	update_game_select(gamedata) {

		let gdiv = document.getElementById("sys_game_select_gamelist");
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
				(this.ssl == (game.ssl | false))
			) {  
				// This is the game we're connected to.
				data.innerText += "✅";
			}
			if(game.default_game == 1) {
				// This is a default game.
				data.innerText += "📌";
			}
			if((game.updated == 1)) {
				// Server says recently changed mssp data
				// data.innerText += "🌱";
				data.innerText += "🔥";
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

		if(gamedata.suggestions !== undefined) {
			let sugdiv = document.getElementById("sys_game_select_suggest");
			if(gamedata.suggestions == 0) {
				sugdiv.style.display = "none";
			} else {
				sugdiv.style.display = "unset";
			}
		}
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
		//this.menuhandler.voidLoginAutologin();
		this.menuhandler.loadLogin();
		this.menuhandler.close("sys_game_select");
		this.lociterm.resetTerm();
		this.lociterm.reconnect_key = "";
		this.lociterm.doConnectGame();
	}

	// Connect to the game stored in the this.gamelist by number.
	about_gamerow(rownumber) {
		let game = this.gamelist[rownumber];
		this.wants_to_select = false;
		this.menuhandler.open("sys_game_about");
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
			"",
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
				this.menuhandler.close('sys_game_about');
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

		let id = "sys_game_about";
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
		l.id = `${id}_description`;
		cdiv.appendChild(l);

		// type of game
		let mssptext = "";

		if(mssp.GAMESYSTEM && (mssp.GAMESYSTEM.toLowerCase() !== "none")) {
			mssptext += ` ${mssp.GAMESYSTEM}`;
		}
		if(mssp.GAMEPLAY && (mssp.GAMEPLAY.toLowerCase() !== "none")) {
			mssptext += ` ${mssp.GAMEPLAY}`;
		}

		if(mssp.GENRE && mssp.SUBGENRE) {
			mssptext += ` ${mssp.GENRE} / ${mssp.SUBGENRE}`;
		} else if(mssp.GENRE) {
			mssptext += ` ${mssp.GENRE}`;
		} else if(mssp.SUBGENRE) {
			mssptext += ` ${mssp.SUBGENRE}`;
		}

		if(mssp.LANGUAGE) {
			mssptext += ` ${mssp.LANGUAGE} Speaking Server`;
		}

		if(mssp.LOCATION) {
			mssptext += ` located in ${mssp.LOCATION}`;
		}

		if(mssptext !== "") {
			mssptext += `. `;
		}
		l.innerText += mssptext;
	
		// FAMILY and CODEBASE
		if(mssp.FAMILY || mssp.CODEBASE) {
			mssptext = " Runs";
			if(mssp.FAMILY) {
				mssptext += ` ${mssp.FAMILY}`;
			}
			if(mssp.CODEBASE) {
				mssptext += ` ${mssp.CODEBASE}`;
			}
			mssptext += `. `;
			l.innerText += mssptext;
		}


		if( (!game.ssl) &&
			(mssp.SSL) &&
			(mssp.SSL > 1)
		) {
			mssptext = ` Supports SSL on port ${mssp.SSL}. `;
			l.innerText += mssptext;
		}

		if(mssp.CREATED) {
			let now = new Date().getFullYear();
			let years = now - mssp.CREATED;
			if( years > 1 ) {
				l.innerText += ` Online for ${years} years.`;
			}
		}

		// Age warning
		if( mssp["MINIMUM AGE"] > 4 ) {
			l.innerText += ` For players age ${mssp["MINIMUM AGE"]} or older.`;
		}


		if(mssp.DESCRIPTION) {
			l = document.createElement('div');
			l.innerText = `${mssp.DESCRIPTION}`;
			cdiv.appendChild(l);
		}
		
		if(mssp.WEBSITE) {
			l = this.connect_link("Website",mssp.WEBSITE,"");
			cdiv.appendChild(l);
		}

		if(mssp.CONTACT) {
			l = this.connect_link("Contact",`mailto:${mssp.CONTACT}`,mssp.CONTACT);
			cdiv.appendChild(l);
		}

		if(mssp.DISCORD) {
			l = this.connect_link("Discord",mssp.DISCORD,"");
			cdiv.appendChild(l);
		}

		if(1) {  // Telnet: link
			let l;
			if(game.ssl) {
				l = this.connect_link(`TelnetSSL`,
					`telnets://${game.host}:${game.port}`,
					`telnet-ssl ${game.host} ${game.port}`
				);
			} else {
				l = this.connect_link(`Telnet`,
					`telnet://${game.host}:${game.port}`,
					`telnet ${game.host} ${game.port}`
				);
			}
			cdiv.appendChild(l);
		}

		if(1) {  // Lociterm: share link
			let locihref = `${document.location.origin}${document.location.pathname}?host=${game.host}&port=${game.port}`
			if(game.ssl) {
				locihref += `&ssl=1`
			}
			l = this.connect_link("LociTerm",locihref,"");
			cdiv.appendChild(l);
		}


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
				//this.menuhandler.voidLoginAutologin();
				this.menuhandler.loadLogin();
				this.lociterm.resetTerm();
				this.connect_direct(server);
			}
		);

		return;
	}

	// search is a string in url search format, i.e. "?var1=val1&var2=val2",
	// as would be obtained from document.location.search.
	connect_from_search(search) {

		let ret = new Object;
		let items = search.slice(1).split('&');

		items.forEach( (item) => {
			item = item.split('=');
			ret[item[0]] = decodeURIComponent(item[1] || '');
		});

		// if they gave us both a host and port...
		if( ret.host && ret.port ) {
			let rk = (this.lociterm.reconnect_key || {});

			// only dump the reconnect key if host or port are different.
			if ( (ret.host != rk.host) || (ret.port != rk.port)) {
				// console.log(`Using search suggestion ${search}`);
				this.lociterm.reconnect_key = "";
				this.hostname = ret.host;
				this.port = ret.port;
				this.ssl = (ret.ssl || 0);
				this.in_use = true;
			}
		}
		if( ret.menu ) {
			let idx = this.lociterm.menuhandler.menuThemes.findIndex( 
				(x)=>{return(x.name === ret.menu)}
			);
			if(idx != -1) {
				this.lociterm.menuhandler.applyMenuNo(idx);
			}
		}
	}

	// Create a div with a titled link in it.
	connect_link( name, href, text="" ) {

		if( text === "" ) {
			if(href.length > 28) {
				text = href.substr(0,26);
				text += " …";
			} else {
				text = href;
			}
		}

		let cdiv = document.createElement('div');
		cdiv.classList.add('stdlink');
		//let t = document.createTextNode(name);
		let t = document.createElement("label");
		t.innerText = name+":";
		t.classList.add('stdlink');
		cdiv.appendChild(t);
		let l = document.createElement('a');
		l.classList.add('stdlink');
		l.href = href;
		l.target = "_blank";
		l.innerText = text;

		cdiv.appendChild(l);
		return(cdiv);

	}

}

export { ConnectGame };
