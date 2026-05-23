// portalconfig.js - Optional portal configuration loader
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
// Loads an optional portal configuration JSON and applies it as deployment
// defaults.  Application priority differs by context:
//
// Browser (not standalone):
//   Portal defaults are applied on top of user saved prefs and written back to
//   localStorage, so they persist as the deployment baseline across page loads
//   and GMCP resets.  This is appropriate for a web portal that always wants a
//   specific look regardless of prior user customizations.
//   Priority: GMCP (session) > portal (deployment) > prior user > factory
//
// Installed PWA (standalone display mode):
//   Portal defaults are applied without persisting, then user saved prefs are
//   re-loaded on top.  The installed app is the user's own context; their saved
//   choices are respected over the deployment defaults.
//   Priority: GMCP (session) > user (saved) > portal (default) > factory
//
// Config is resolved in priority order:
//   1. ?portal=<filename>  — fetched as ./<filename> from the deployment root
//   2. ./portal.json       — fetched relative to the deployment root (fallback)
//
// If ?portal= is present but the fetch fails, portal.json is NOT tried as
// a fallback — silence the URL param or fix the filename.
//
// Config JSON format uses GMCP module names as top-level keys:
//   {
//     "Loci.Prefs.Set": { ...standard prefs delta, same structure as default_prefs.json... },
//     "Loci.Skin.Set":  { ...full skin object, same properties as Loci.Skin.Set GMCP... },
//     "Loci.Menu.Set":  { ...menu object, same structure as Loci.Menu.Set GMCP... }
//   }
//
// All sections are optional.  This format is intentionally identical to the
// batch payload format accepted by the GMCP dev test panel (empty module field),
// so the same JSON can be used for both portal.json and live testing.
//
// Loci.Prefs.Set applies settings as a delta; skinname within it is applied first
// so that Loci.Skin.Set properties can override individual skin fields on top.
//
// Loci.Menu.Set is registered as a named theme "portal" in menuThemes.
// In browser mode the theme name is also stored in localStorage so
// Loci.Menu.Reset re-applies it on reconnect.  In PWA mode, it is applied
// live only and not persisted.

async function applyPortalConfig(lociterm) {

	const urlParams = new URLSearchParams(window.location.search);
	const portalParam = urlParams.get('portal');

	let config = null;

	if (portalParam !== null) {
		// ?portal= was explicitly specified — fetch only that file, no fallback.
		const url = './' + portalParam;
		try {
			const resp = await fetch(url);
			if (resp.ok) {
				config = await resp.json();
			} else {
				console.warn(`LociTerm portal: ${url} returned HTTP ${resp.status}`);
			}
		} catch (e) {
			console.warn(`LociTerm portal: failed to load ${url} —`, e.message);
		}
	} else {
		// No URL param — try portal.json at the deployment root.
		try {
			const resp = await fetch('./portal.json');
			if (resp.ok) config = await resp.json();
			// 404 is expected when not a portal deployment; swallow silently.
		} catch (e) {
			// Network or parse error — still not fatal.
		}
	}

	if (!config) return;

	// Detect whether running as an installed PWA (standalone display mode).
	// iOS Safari sets navigator.standalone; everywhere else uses the media query.
	const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
	                     window.navigator.standalone === true;

	// Dispatch each top-level key as a module name, same as the GMCP batch format.
	const handlers = {

		'Loci.Prefs.Set': (payload) => {
			const pref = lociterm.pref;
			if (isStandalone) {
				// PWA: apply defaults without persisting, then restore user prefs on top.
				pref.autosave = false;
				pref.apply(payload);
				pref.load(pref.storageKey);
				pref.autosave = true;
			} else {
				// Browser: apply as the persistent deployment baseline.
				// autosave=true here, so the delta is written to localStorage and
				// re-applied on every subsequent page load and after GMCP reset.
				pref.apply(payload);
			}
		},

		'Loci.Skin.Set': (payload) => {
			// Session-only skin override — same behaviour as the GMCP Loci.Skin.Set
			// handler.  Applied after Loci.Prefs.Set so it can override named skins.
			lociterm.pref.applySkin(payload);
		},

		'Loci.Menu.Set': (payload) => {
			const menuhandler = lociterm.menuhandler;
			if (!menuhandler) return;
			// Register as a named theme so Loci.Menu.Reset can re-apply it.
			menuhandler.menuThemes.push({ name: "portal", ...payload });
			menuhandler.applyMenuName("portal");
			if (!isStandalone) {
				// Browser mode: persist the theme name so GMCP reset re-applies it.
				localStorage.setItem("menuthemename", "portal");
			}
			// PWA mode: menu applied live but not persisted to user's prefs.
		},
	};

	for (const [module, payload] of Object.entries(config)) {
		const handler = handlers[module];
		if (handler) {
			handler(payload);
		} else {
			console.warn(`LociTerm portal: unknown module "${module}" — skipped`);
		}
	}
}

export { applyPortalConfig };
