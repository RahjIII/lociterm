// index.js - LociTerm entry js
// Created: Sun May  1 10:42:59 PM EDT 2022 malakai
// $Id: index.js,v 1.5 2022/05/09 05:16:14 malakai Exp $

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

terminal.connect("ws://zeppelin.lake.jeffrika.com:4005");

