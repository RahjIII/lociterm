// index.js - LociTerm entry js
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: index.js,v 1.12 2024/03/08 15:38:28 malakai Exp $

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

// You can use this local copy of xterm.css that you've made
// import './xterm.css';
// or use the one that comes stock with xterm
import '@xterm/xterm/css/xterm.css';
import './menuhandler.css';
import './nerfbar.css';
import './styles.css';

import lociThemes from './themes.json';

import { LociTerm } from './lociterm.js';

// lociTermBegin();

const terminal = new LociTerm(
	document.getElementById('terminal'), // the anchor div
	lociThemes
);

// The websocket's use of SSL will follow the page's use.
let wsproto = "wss:";
if(document.location.protocol == "http:") {
	wsproto = "ws:";
}
let websocket_url = `${wsproto}//${document.location.host}${document.location.pathname}`;
console.log(`Websocket URL is ${websocket_url}`)

// The npm serve mode is pretty handy, but it uses a different host port than
// the websocket server.  Account for that here.
if( document.location.port == 5001 ) { 
	websocket_url = `${wsproto}//${document.location.hostname}:4005${document.location.pathname}`;
	console.log(`NPM serve mode detected.  Connecting to ${websocket_url} instead.`)
} 

// open it up and go.
terminal.connect(websocket_url);

