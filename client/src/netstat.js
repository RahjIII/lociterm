// netstat.js - network statistics window
// Created: Wed Mar 19 10:14:56 AM EDT 2025

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

class NetStat {

	constructor(lociterm,menuhandler) {
		this.lociterm = lociterm;
		this.menuhandler = menuhandler
		this.menuname = "sys_netstat";
		this.mostrecent = {};
		this.refreshTimeout = undefined;
		this.refreshSeconds = 10;
	}

	create_netstat(menuname="sys_netstat") {
		
		this.menuname = menuname;

		let handle = this.menuhandler.create_generic_live_window(
			menuname,
			"Network Status",
			()=>this.create_netstat(menuname), // required fn pointer back to this function.
			"" // whatever is the default for onclose.
		);

		if(handle.wait) {
			return(handle.overlay);
		}

		let win = handle.content;
		win.classList.add("netstat");

		this.refresh(this.refreshSeconds * 1000);

	}

	hostline(host,state,encrypted) {
		let line = "";

		if(host === "") {
			host="Unknown";
		}

		if(state === "") {
			host="INIT";
		}

		let lock = (encrypted==true)?"🔐":"🔍";

		line = `${host} is ${state} ${lock}`;
		return(line);

	}

	update(data) {

		this.mostrecent = data;
		let deets;

		let l;
		let win = document.getElementById(`${this.menuname}_content`);
		if(win === null) {
			console.error(`Couldn't find ${this.menuname}_content for update!`);
		}
		// flush whatever is in there already, but try and preserve the open status.
		let openstatus = [];
		while(win.children[0] != undefined) {
			if(win.children[0].name) {
				openstatus[win.children[0].name] = (win.children[0].open)?true:false;
			}
			win.children[0].remove();
		}
		win.innerText = "";

		
		data.websocket = this.lociterm.socket.readyState;
		if(data.websocket !== undefined) {

			deets = this.menuhandler.create_generic_details("Client to LociTerm",`${this.menuname}_web`);
			win.appendChild(deets);

			l = document.createElement('div');
			let readystates = ["Connecting","UP","Closing","DOWN"]
			let readystate = readystates[data.websocket];
			l.innerText = this.hostline(this.lociterm.url,readystate,this.lociterm.url.startsWith("wss"));
			deets.appendChild(l);
			if(openstatus[deets.name]==true) {
				deets.setAttribute("open","");
			}

			if(data.websocket !== 1) {
				deets.setAttribute("open","");
			} 

		}

		if(data.client) {
			let deets = this.menuhandler.create_generic_details("LociTerm to Client",`${this.menuname}_client`);
			win.appendChild(deets);
			if(openstatus[deets.name]==true) {
				deets.setAttribute("open","");
			} else if (openstatus[deets.name]==undefined) {
				deets.setAttribute("open","");
			}

			l = document.createElement('div');
			l.innerText = this.hostline(data.client.host,data.client.state,data.client.ssl);
			deets.appendChild(l);

			l = document.createElement('div');
			l.innerText = `${data.client.data}`;
			deets.appendChild(l);

			l = document.createElement('div');
			l.innerText = `${data.client.rate}`;
			deets.appendChild(l);

			l = document.createElement('div');
			let rtt = data.client.rtt / 1000.0;
			l.innerText = `TCP RTT: ${rtt.toFixed(2)} ms`;
			deets.appendChild(l);

		}

		if(data.proxycount) {
			let deets = this.menuhandler.create_generic_details("LociTerm",`${this.menuname}_proxy`);
			win.appendChild(deets);
			if(openstatus[deets.name]==true) {
				deets.setAttribute("open","");
			}

			l = document.createElement('div');
			l.innerText = `Active Sessions: ${data.proxycount}`;
			deets.appendChild(l);
		}

		if(data.server) {
			let deets = this.menuhandler.create_generic_details("LociTerm to Server",`${this.menuname}_server`);
			win.appendChild(deets);
			if(openstatus[deets.name]==true) {
				deets.setAttribute("open","");
			} else if (openstatus[deets.name]==undefined) {
				deets.setAttribute("open","");
			}

			l = document.createElement('div');
			let host = `${data.server.host}:${data.server.port}`
			l.innerText = this.hostline(host,data.server.state,data.server.ssl);
			deets.appendChild(l);

			l = document.createElement('div');
			l.innerText = `${data.server.data}`;
			deets.appendChild(l);

			l = document.createElement('div');
			l.innerText = `${data.server.rate}`;
			deets.appendChild(l);

			l = document.createElement('div');
			let rtt = data.server.rtt / 1000.0;
			l.innerText = `TCP RTT: ${rtt.toFixed(2)} ms`;
			deets.appendChild(l);
			
			if(data.server.reconnections) {
				l = document.createElement('div');
				l.innerText = `Reconnections: ${data.server.reconnections}`;
				deets.appendChild(l);
			}

		}

		if(data.telnet) {
			let row;
			let tab;
			let deets = this.menuhandler.create_generic_details("Telnet",`${this.menuname}_telnet`);
			win.appendChild(deets);
			if(openstatus[deets.name]==true) {
				deets.setAttribute("open","");
			}
			
			tab = document.createElement('table');
			deets.appendChild(tab);

			row = document.createElement('tr');
			tab.appendChild(row);

			l= document.createElement('th');
			l.innerText = "Telopt";
			row.appendChild(l);

			l= document.createElement('th');
			l.innerText = "LociTerm";
			row.appendChild(l);

			l= document.createElement('th');
			l.innerText = "Server";
			row.appendChild(l);

			for (const [key,val] of Object.entries(data.telnet)) {
				row = document.createElement('tr');
				tab.appendChild(row);
				
				l= document.createElement('td');
				l.innerText = `${key}`;
				row.appendChild(l);

				l= document.createElement('td');
				l.innerText = (val.c===1)?"✔️":"❌";
				row.appendChild(l);

				l= document.createElement('td');
				l.innerText = (val.s===1)?"✔️":"❌";
				row.appendChild(l);
			}
		}

		if(this.lociterm.gmcp.isEnabled()) {
			let deets = this.menuhandler.create_generic_details("GMCP",`${this.menuname}_gmcp`);
			win.appendChild(deets);
			if(openstatus[deets.name]==true) {
				deets.setAttribute("open","");
			}

			let tab = document.createElement('table');
			deets.appendChild(tab);

			let row = document.createElement('tr');
			tab.appendChild(row);

			l= document.createElement('th');
			l.innerText = "Module";
			row.appendChild(l);

			l= document.createElement('th');
			l.innerText = "Known";
			row.appendChild(l);

			l= document.createElement('th');
			l.innerText = "Count";
			row.appendChild(l);

			for (const [key,val] of Object.entries(this.lociterm.gmcp.moduleCount)) {
				row = document.createElement('tr');
				tab.appendChild(row);

				l= document.createElement('td');
				l.innerText = `${key}`;
				row.appendChild(l);

				l= document.createElement('td');
				l.innerText = (this.lociterm.gmcp.isSupportedModule(key))?"✔️":"❌";
				row.appendChild(l);

				l= document.createElement('td');
				l.innerText = `${val}`;
				row.appendChild(l);
			}
		}

	}

	refresh(timeout) {
		let menu = (document.getElementById(`${this.menuname}`));
		if( menu.style?.visibility != 'hidden' ) {
			if(this.lociterm.socket.readyState == 1) {
				this.lociterm.requestNetStat();
			} else {
				this.update({});
			}

			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = setTimeout(()=>this.refresh(timeout),timeout);
		}
	}

}

export { NetStat };
