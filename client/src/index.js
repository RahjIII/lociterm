// index.js - LociTerm entry js
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: index.js,v 1.2 2022/05/02 03:18:36 malakai Exp $

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

import './styles.css';
import 'xterm/css/xterm.css';

import './menuhandler.css';
import { MenuHandler } from './menuhandler.js';

import { LociTerm } from './lociterm.js';

let termoptions = {
	"fontSize": 18,
	"cursorBlink": true
};

const terminal = new LociTerm(
	document.getElementById('terminal') // the anchor div
);

const mh = new MenuHandler(
	document.getElementById('menuhandler'), // the anchor div
	((m) => terminal.paste(m)),				// the paste hook
	(() => terminal.focus())				// the focus hook
);

// terminal.url="ws://localhost:4567";
terminal.connect("ws://zeppelin.lake.jeffrika.com:4005");
