
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
