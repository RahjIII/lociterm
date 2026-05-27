// gmcp_testpanel.js - Developer GMCP test panel
// Created: $Date$
// $Id: $

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
//
// Floating dev panel for testing GMCP commands from the browser.
// Activates when hostname is localhost/127.0.0.1 or the URL has ?gmcpdev.
// Toggle with Ctrl+Shift+G.
// The panel calls lociterm.gmcp.parse() directly, bypassing the websocket,
// so it exercises the exact same handler code path the real server uses.

const PRESETS = [
	{ label: "-- select a preset --", module: "", payload: "" },
	// --- Loci.Prefs ---
	{ label: "Prefs.Set — skin: lociterm (default)",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ ui: { skinname: "lociterm" } }, null, 2) },
	{ label: "Prefs.Set — skin: lociterm-dark",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ ui: { skinname: "lociterm-dark" } }, null, 2) },
	{ label: "Prefs.Set — skin: minimal",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ ui: { skinname: "minimal" } }, null, 2) },
	{ label: "Prefs.Set — skin: minimal-dark",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ ui: { skinname: "minimal-dark" } }, null, 2) },
	{ label: "Prefs.Set — skin: futuristic",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ ui: { skinname: "futuristic" } }, null, 2) },
	{ label: "Prefs.Set — menubox: top-left, panel: top-left",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ menu: { bgridAnchor: "tl", menusideAnchor: "tl" } }, null, 2) },
	{ label: "Prefs.Set — menubox: top-right, panel: top-right",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ menu: { bgridAnchor: "tr", menusideAnchor: "tr" } }, null, 2) },
	{ label: "Prefs.Set — menubox: top-right, panel: bottom-right (default)",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ menu: { bgridAnchor: "tr", menusideAnchor: "br" } }, null, 2) },
	{ label: "Prefs.Set — nerfbar: show",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ nerf: { enabled: true } }, null, 2) },
	{ label: "Prefs.Set — nerfbar: hide",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ nerf: { enabled: false } }, null, 2) },
	{ label: "Prefs.Set — full lock-down example",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({
		ui:   { skinname: "minimal-dark" },
		menu: { bgridAnchor: "tl", menusideAnchor: "tl", fade: 0.3 },
		nerf: { enabled: true }
	  }, null, 2) },
	{ label: "Prefs.Reset",
	  module: "Loci.Prefs.Reset",
	  payload: "{}" },
	// --- Loci.Skin ---
	{ label: "Skin.Set — custom blue/steel",
	  module: "Loci.Skin.Set",
	  payload: JSON.stringify({
		coverColor:          "#1a4a6e",
		paperColor:          "#0d1f30",
		altpaperColor:       "#162840",
		textColor:           "#a8c8e8",
		linkColor:           "#5ab0d8",
		borderRadiusPanel:   "0px",
		borderRadiusPopup:   "0px",
		borderRadiusControl: "0px",
		borderWidth:         "1px",
		panelShadow:         "0 0 6px #1a4a6e",
		nerfbarExtras:       "none"
	  }, null, 2) },
	{ label: "Skin.Reset",
	  module: "Loci.Skin.Reset",
	  payload: "{}" },
	// --- Loci.Menu ---
	{ label: "Menu.Reset",
	  module: "Loci.Menu.Reset",
	  payload: "{}" },
	// --- ui.skin (custom skin object, session-only via GMCP) ---
	{ label: "Prefs.Set — ui.skin: custom blue/steel",
	  module: "Loci.Prefs.Set",
	  payload: JSON.stringify({ ui: { skin: {
		coverColor:          "#1a4a6e",
		paperColor:          "#0d1f30",
		altpaperColor:       "#162840",
		textColor:           "#a8c8e8",
		linkColor:           "#5ab0d8",
		visitedColor:        "#4890b8",
		borderRadiusPanel:   "0px",
		borderRadiusPopup:   "0px",
		borderRadiusControl: "0px",
		borderWidth:         "1px",
		panelShadow:         "0 0 6px #1a4a6e",
		nerfbarExtras:       "none",
	  }}}, null, 2) },
	// --- Batch (module field empty — payload keys are module names) ---
	{ label: "Batch — portal.json format example",
	  module: "",
	  payload: JSON.stringify({
		"Loci.Prefs.Set": {
			ui:   { skinname: "minimal-dark" },
			menu: { bgridAnchor: "tr", menusideAnchor: "br", fade: 0.4 },
			nerf: { enabled: true }
		},
		"Loci.Menu.Set": {
			name:  "fed2",
			label: "Federation 2 Community Edition",
			menubox: {
				width: 4, height: 4,
				buttons: [
					{ name: "Out",       text: "<>",  send: "out\n"   },
					{ name: "In",        text: "><",  send: "in\n"    },
					{ name: "Board",     text: "🚀",  send: "board\n", color: "cyan" },
					{ name: "Northeast", text: "↗",   send: "ne\n"    },
					{ name: "North",     text: "⬆",   send: "n\n"     },
					{ name: "Northwest", text: "↖",   send: "nw\n"    },
					{ name: "Up",        text: "⭜",   send: "u\n"     },
					{ name: "East",      text: "➡",   send: "e\n"     },
					{ name: "Look",      text: "👁️",  send: "look\n"  },
					{ name: "West",      text: "⬅",   send: "w\n"     },
					{ name: "Down",      text: "⭝",   send: "d\n"     },
					{ name: "Southeast", text: "↘",   send: "se\n"    },
					{ name: "South",     text: "⬇",   send: "s\n"     },
					{ name: "Southwest", text: "↙",   send: "sw\n"    },
				]
			},
			menubar: [
				{ id: "sys_client", item: [
					{ label: "Login",         open: "sys_loginbox"    },
					{ label: "Logout",        open: "sys_disconnect"  },
					{ label: "User Interface",open: "sys_settings"    },
					{ label: "About",         open: "sys_about_which" },
				]}
			]
		}
	  }, null, 2) },
];

class GmcpTestPanel {

	constructor(lociterm) {
		this.lociterm = lociterm;
		this.panel = null;
		this.dragging = false;
		this.dragOffX = 0;
		this.dragOffY = 0;

		const url = new URL(window.location.href);
		const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
		              url.searchParams.has('gmcpdev');
		if (!isDev) return;

		// Expose instance on window for console use in dev mode.
		window.lociterm = lociterm;

		this.build();

		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey && e.shiftKey && e.code === 'KeyG') {
				this.toggle();
				e.preventDefault();
			}
		});
	}

	build() {
		const p = document.createElement('div');
		p.id = 'gmcp-testpanel';

		// Use inline styles + CSS vars so it adopts the current skin automatically.
		Object.assign(p.style, {
			position:       'fixed',
			right:          '12px',
			bottom:         '64px',
			width:          '400px',
			background:     'var(--book-paper-color, #f0f0f0)',
			color:          'var(--book-text-color, #222)',
			border:         '1px solid var(--book-cover-color, #999)',
			borderRadius:   '4px',
			boxShadow:      '0 4px 20px rgba(0,0,0,0.5)',
			zIndex:         '9999',
			display:        'none',
			flexDirection:  'column',
			fontFamily:     'monospace',
			fontSize:       '13px',
			userSelect:     'none',
		});

		const headerStyle = [
			'background: var(--book-cover-color, #666)',
			'color: var(--book-paper-color, #fff)',
			'padding: 5px 8px',
			'cursor: move',
			'display: flex',
			'justify-content: space-between',
			'align-items: center',
			'border-radius: 3px 3px 0 0',
		].join(';');

		const inputStyle = [
			'width: 100%',
			'box-sizing: border-box',
			'background: var(--book-altpaper-color, #fff)',
			'color: var(--book-text-color, #222)',
			'border: 1px solid var(--book-cover-color, #999)',
			'padding: 4px',
			'font-family: monospace',
			'font-size: 13px',
		].join(';');

		const btnPrimaryStyle = [
			'flex: 1',
			'background: var(--book-cover-color, #666)',
			'color: var(--book-paper-color, #fff)',
			'border: none',
			'padding: 6px',
			'cursor: pointer',
			'border-radius: 3px',
			'font-size: 13px',
		].join(';');

		const btnSecondaryStyle = [
			'background: none',
			'color: var(--book-cover-color, #666)',
			'border: 1px solid var(--book-cover-color, #999)',
			'padding: 6px 10px',
			'cursor: pointer',
			'border-radius: 3px',
			'font-size: 13px',
		].join(';');

		p.innerHTML = `
			<div id="gmcp-tp-header" style="${headerStyle}">
				<span>GMCP Dev &nbsp;<small style="opacity:0.65;font-size:11px">Ctrl+Shift+G</small></span>
				<button id="gmcp-tp-close" style="background:none;border:none;color:inherit;cursor:pointer;font-size:18px;padding:0 2px;line-height:1">×</button>
			</div>
			<div style="padding:8px;display:flex;flex-direction:column;gap:6px;">
				<div style="display:flex;gap:6px;align-items:center;">
					<label style="white-space:nowrap;font-size:11px;opacity:0.65;">Preset:</label>
					<select id="gmcp-tp-preset" style="${inputStyle};font-size:11px;"></select>
				</div>
				<div>
					<label style="font-size:11px;opacity:0.65;display:block;margin-bottom:2px;">Module:</label>
					<input id="gmcp-tp-module" type="text" style="${inputStyle}" placeholder="Loci.Prefs.Set  (leave empty for batch)" />
				</div>
				<div>
					<label style="font-size:11px;opacity:0.65;display:block;margin-bottom:2px;">Payload (JSON):</label>
					<textarea id="gmcp-tp-payload" rows="7" style="${inputStyle};height:auto;resize:vertical;">{}</textarea>
				</div>
				<div style="display:flex;gap:6px;">
					<button id="gmcp-tp-send"  style="${btnPrimaryStyle}">Send</button>
					<button id="gmcp-tp-clear" style="${btnSecondaryStyle}">Clear</button>
				</div>
				<div id="gmcp-tp-log" style="font-size:11px;opacity:0.7;max-height:56px;overflow-y:auto;border-top:1px solid var(--book-cover-color,#ccc);padding-top:4px;"></div>
			</div>
		`;

		document.body.appendChild(p);
		this.panel = p;

		// Populate presets dropdown.
		const sel = p.querySelector('#gmcp-tp-preset');
		PRESETS.forEach((pr, i) => {
			const opt = document.createElement('option');
			opt.value = i;
			opt.textContent = pr.label;
			sel.appendChild(opt);
		});

		sel.onchange = () => {
			const pr = PRESETS[+sel.value];
			if (pr && pr.label !== PRESETS[0].label) {
				p.querySelector('#gmcp-tp-module').value  = pr.module  || '';
				p.querySelector('#gmcp-tp-payload').value = pr.payload || '{}';
			}
			// Reset to placeholder so same preset can be re-selected.
			sel.value = 0;
		};

		p.querySelector('#gmcp-tp-send').onclick  = () => this.send();
		p.querySelector('#gmcp-tp-clear').onclick = () => this.clear();
		p.querySelector('#gmcp-tp-close').onclick = () => this.hide();

		// Enter in module field submits.
		p.querySelector('#gmcp-tp-module').addEventListener('keydown', (e) => {
			if (e.code === 'Enter') { this.send(); e.preventDefault(); }
		});

		// Draggable header.
		const header = p.querySelector('#gmcp-tp-header');
		header.addEventListener('mousedown', (e) => {
			if (e.target.id === 'gmcp-tp-close') return;
			this.dragging = true;
			const rect = p.getBoundingClientRect();
			this.dragOffX = e.clientX - rect.left;
			this.dragOffY = e.clientY - rect.top;
			e.preventDefault();
		});
		document.addEventListener('mousemove', (e) => {
			if (!this.dragging) return;
			p.style.left   = `${e.clientX - this.dragOffX}px`;
			p.style.top    = `${e.clientY - this.dragOffY}px`;
			p.style.right  = 'unset';
			p.style.bottom = 'unset';
		});
		document.addEventListener('mouseup', () => { this.dragging = false; });
	}

	send() {
		const module     = this.panel.querySelector('#gmcp-tp-module').value.trim();
		const payloadStr = this.panel.querySelector('#gmcp-tp-payload').value.trim();

		let payload;
		try {
			payload = JSON.parse(payloadStr || '{}');
		} catch (err) {
			this.logMsg(`⚠ JSON: ${err.message}`, '#cc2200');
			return;
		}

		if (!module) {
			// Batch mode: payload keys are module names, values are their payloads.
			const entries = Object.entries(payload);
			if (entries.length === 0) {
				this.logMsg('⚠ Enter a module name or batch object', '#cc2200');
				return;
			}
			let ok = 0;
			for (const [mod, data] of entries) {
				try {
					this.lociterm.gmcp.parse(mod, data);
					ok++;
				} catch (err) {
					this.logMsg(`✗ ${mod}: ${err.message}`, '#cc2200');
				}
			}
			if (ok > 0) this.logMsg(`✓ ${ok} module${ok > 1 ? 's' : ''} sent`);
			return;
		}

		try {
			this.lociterm.gmcp.parse(module, payload);
			this.logMsg(`✓ ${module}`);
		} catch (err) {
			this.logMsg(`✗ ${module}: ${err.message}`, '#cc2200');
		}
	}

	clear() {
		this.panel.querySelector('#gmcp-tp-module').value  = '';
		this.panel.querySelector('#gmcp-tp-payload').value = '{}';
		this.panel.querySelector('#gmcp-tp-log').textContent = '';
	}

	logMsg(msg, color) {
		const log  = this.panel.querySelector('#gmcp-tp-log');
		const line = document.createElement('div');
		line.textContent = msg;
		if (color) line.style.color = color;
		log.insertBefore(line, log.firstChild);
		while (log.children.length > 8) log.removeChild(log.lastChild);
	}

	show()   { this.panel.style.display = 'flex'; }
	hide()   { this.panel.style.display = 'none'; }
	toggle() { this.panel.style.display === 'none' ? this.show() : this.hide(); }

}

export { GmcpTestPanel };
