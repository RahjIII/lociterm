// index.js - LociTerm entry js
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: index.js,v 1.6 2022/05/13 04:32:28 malakai Exp $

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

// import './xterm.css';
import 'xterm/css/xterm.css';
import './menuhandler.css';
import './styles.css';

import lociThemes from './themes.json'

import { LociTerm } from './lociterm.js'


// lociTermBegin();
const terminal = new LociTerm(
	document.getElementById('terminal'), // the anchor div
	lociThemes
);

//terminal.connect("ws://zeppelin.lake.jeffrika.com:4005");
let websocket_url = `wss://${document.location.host}${document.location.pathname}`;
console.log(`Websocket URL is ${websocket_url}`)
if( document.location.port == 5001 ) { 
	websocket_url = `wss://${document.location.hostname}:4005${document.location.pathname}`;
	console.log(`NPM serve mode detected.  Connecting to ${websocket_url} instead.`)
} 
terminal.connect(websocket_url);
	

