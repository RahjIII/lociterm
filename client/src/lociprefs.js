// lociprefs.js - LociTerm user preferences
// Created: Mon Mar  3 11:49:41 AM EST 2025
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


// LociPrefs contains the full set of default values for any and all of the
// preferences that can be set, and is always loaded first.  User's saved prefs
// are loaded on top of the default set.
import LociPrefs from './default_prefs.json';

// Themes contain pref deltas from the default set.  Themes do not have to
// define every value, and should NOT define values for things that a user
// probably doesn't want re-themeed- like the location of the menus or grids.
import lociThemes from './themes.json';

// Javascript does kind of suck.
import * as ObjDeep from './objdeep.js';

class LociPreferences {

	constructor(lociterm,storageKey="lociprefs") {

		// Link to containing lociterm.
		this.lociterm = lociterm;
		// The localStorage key under which this instance saves its data.
		this.storageKey = storageKey;
		this.defaultPrefs = LociPrefs;
		this.merged = {};
		
		this.apply(this.defaultPrefs);
		this.load(this.storageKey);
		this.autosave = true;  // After init, changes always save.
	}

	get(path) {
		return(this.findobj(path,this.merged));
	}

	set(path,val) {
		let delta={};
		this.setobj(path,delta,val);
		this.apply(delta);
	}

	findobj(path,obj) {
		return path.split('.').reduce(
			(p, c) => { return p ? p[c] : null },
			obj
		)
	}

	setobj(path,obj,val) {
		let keys = path.split(".");
		let lastkey = keys.pop();
		let spot = keys.reduce(
			(o,p)=> {
				if( o[p] === undefined ) {
					o[p] = {};
				}
				return(o[p]);
			},
			obj
		);
		spot[lastkey] = val;
		return(val);
	}


	// Do what you've got to do to apply the pref delta.
	apply(delta) {

		let reflow = false;  // set to true if applyXtermoptions needs to be forced.

		// Apply LociTerm elements.
		if(delta.lociterm) {
			if(delta.lociterm.encoding) {
				this.lociterm.encoding = delta.lociterm.encoding;
			}
		}

		// Apply UI elements.
		if(delta.ui) {

			if(delta.ui.themename) {
				let themeno = this.lociterm.lociThemes.findIndex(
					(x)=>x.name == delta.ui.themename
				);
				let blob = {};
				if(themeno > -1) {
					blob = structuredClone(this.lociterm.lociThemes[themeno]);
				} else {
					blob = structuredClone(this.defaultPrefs);
				}
				if(blob.name !== undefined) {
					delete blob.name;
				}
				if(blob.ui && blob.ui.themename) {
					delete blob.ui.themename;
				}
				this.apply(blob);
			}

			if(delta.ui.fingerSize != undefined) {
				document.documentElement.style.setProperty('--finger-size', delta.ui.fingerSize);
			}
			if(delta.ui.fontSize != undefined) {
				document.documentElement.style.setProperty('--font-size', delta.ui.fontSize);
			}

			// Set the main backgound.
			if(delta.ui.background != undefined) {
				document.documentElement.style.setProperty('--background-color', delta.ui.background);
			}

			if(delta.ui.termScrollBar != undefined) {
				if(delta.ui.termScrollBar == true) {
					document.documentElement.style.setProperty('--terminal-sb-visibility', "block");
					document.documentElement.style.setProperty('--terminal-sb-display', "block");
					document.documentElement.style.setProperty('--terminal-sb-width', "auto");
				} else {
					document.documentElement.style.setProperty('--terminal-sb-visibility', "hidden");
					document.documentElement.style.setProperty('--terminal-sb-display', "hidden");
					document.documentElement.style.setProperty('--terminal-sb-width', "none");
				}
				reflow = true;
			}

			if(delta.ui.terminalMargin != undefined) {
				document.documentElement.style.setProperty('--terminal-margin', delta.ui.terminalMargin );
				reflow = true;
			}

			if(delta.ui.skinname != undefined) {
				let skin = this.lociterm.lociSkins.find(
					(x) => x.name == delta.ui.skinname
				);
				if(skin != undefined) {
					this.applySkin(skin);
				}
			}

			// Full skin object — used by portal config to persist custom skins.
			// Applied after skinname so it can override individual properties of
			// a named skin.
			if(delta.ui.skin != undefined) {
				this.applySkin(delta.ui.skin);
			}

		}

		// Apply the nerfbar preferences.
		if(delta.nerf) {

			if(delta.nerf.enabled != undefined) {
				if(this.lociterm.echo_mode == 3) {
					if(delta.nerf.enabled == true) {
						this.lociterm.nerfbar.open();
					} else {
						this.lociterm.nerfbar.close();
					}
				} else {
					/* open the nerfbar. */
					this.lociterm.nerfbar.open();
					this.lociterm.nerfbar.nofade();
				}
			}

		}

		// Apply the sfx preferences.
		if(delta.sfx) {
			if(delta.sfx.mcmpPlayAudio != undefined) {
				this.lociterm.gmcp.mod("ClientMedia").enabled = delta.sfx.mcmpPlayAudio;
				if(delta.sfx.mcmpPlayAudio == false) {
					this.lociterm.gmcp.mod("ClientMedia").stop({});
				}
			}
			if(delta.sfx.mcmpShowCaptions != undefined) {
				this.lociterm.gmcp.mod("ClientMedia").cc = delta.sfx.mcmpShowCaptions;
			}
		}

		// apply prefrences for the menu tree
		if(delta.menu !== undefined) {
			
			if(delta.menu.fade != undefined) {
				document.documentElement.style.setProperty('--menufade-hidden', delta.menu.fade);
			}

			if(delta.menu.bgridAnchor != undefined) {
				let anchor = delta.menu.bgridAnchor;
				if( anchor[0] == 't' ) {
					document.documentElement.style.setProperty('--bgridAnchor-top', "0");
					document.documentElement.style.setProperty('--bgridAnchor-bottom', 'unset');
				} else {
					document.documentElement.style.setProperty('--bgridAnchor-top', 'unset');
					document.documentElement.style.setProperty('--bgridAnchor-bottom', "var(--finger-size)");
				}
				if( anchor[1] == 'l' ) {
					document.documentElement.style.setProperty('--bgridAnchor-left', "0");
					document.documentElement.style.setProperty('--bgridAnchor-right', 'uset');
				} else {
					document.documentElement.style.setProperty('--bgridAnchor-left', 'unset');
					document.documentElement.style.setProperty('--bgridAnchor-right', "0");
				}
			}

			if(delta.menu.menusideAnchor != undefined) {
				let anchor = delta.menu.menusideAnchor;
				if( anchor[0] == 't' ) {
					document.documentElement.style.setProperty('--menuside-open-top', 0);
					document.documentElement.style.setProperty('--menuside-open-bottom', 'unset');
					document.documentElement.style.setProperty('--menuside-close-top', "-100%");
					document.documentElement.style.setProperty('--menuside-close-bottom', 'unset');
				} else {
					document.documentElement.style.setProperty('--menuside-open-top', 'unset');
					document.documentElement.style.setProperty('--menuside-open-bottom', 'var(--nerfbar-offsetHeight)');
					document.documentElement.style.setProperty('--menuside-close-top', 'unset');
					document.documentElement.style.setProperty('--menuside-close-bottom', "-100%");
				}
				if( anchor[1] == 'l' ) {
					document.documentElement.style.setProperty('--menuside-open-left', 0);
					document.documentElement.style.setProperty('--menuside-open-right', 'unset');
					document.documentElement.style.setProperty('--menuside-close-left', "-100%");
					document.documentElement.style.setProperty('--menuside-close-right', 'unset');
				} else {
					document.documentElement.style.setProperty('--menuside-open-left', 'unset');
					document.documentElement.style.setProperty('--menuside-open-right', 0);
					document.documentElement.style.setProperty('--menuside-close-left', 'unset');
					document.documentElement.style.setProperty('--menuside-close-right', "-100%");
				}
			}

			if(delta.menu.themename != undefined) {
				this.lociterm.menuhandler.applyMenuName(delta.menu.themename);
			}

		}

		if(delta.name != undefined) {
			this.lociterm.themeName = delta.name;
		}
	
		// CRT options
		if(delta.crtoptions != undefined) {
			this.lociterm.crtfilter.update(delta.crtoptions);
		}

		// Apply the xtermjs specific theme items.
		if(delta.xtermoptions != undefined) {
	
			// I can't figure out how to tell if a font has loaded.  Best I can
			// come up with is to request a load every time, then load the
			// xtermoptions from within the resulting promise.
			if(delta.xtermoptions.fontFamily != undefined) {
				document.fonts.load(`16px ${delta.xtermoptions.fontFamily}`).then((x)=>{
					this.applyXtermoptions(delta);
				});
			} else {
				// if there's no font, there's no problem.  Just apply stuff.
				this.applyXtermoptions(delta);
			}

		}

		if(reflow === true) {
			this.applyXtermoptions(delta);
		}

		// merge this apply delta to the general prefs 
		// this.merged = { ...this.merged, ...delta };  NOPE
		// Object.assign(this.merged,delta);  NOPE
		// Damn you, javascript!
		this.merged = ObjDeep.merge(this.merged,delta);

		if(this.autosave) {
			this.save();
		}
	}

	// Apply a UI skin object directly, setting the --book-* CSS custom properties.
	// Called from apply() for named skins and directly by the GMCP skin handler
	// for server-provided skins (which bypass the pref save path).
	applySkin(skin) {
		let set = (v,c) => { if(c !== undefined) document.documentElement.style.setProperty(v,c); };
		set('--book-cover-color',           skin.coverColor);
		set('--book-paper-color',           skin.paperColor);
		set('--book-altpaper-color',        skin.altpaperColor);
		set('--book-text-color',            skin.textColor);
		set('--book-link-color',            skin.linkColor);
		set('--book-visited-color',         skin.visitedColor);
		set('--book-border-radius-panel',   skin.borderRadiusPanel);
		set('--book-border-radius-popup',   skin.borderRadiusPopup);
		set('--book-border-radius-control', skin.borderRadiusControl);
		set('--book-border-width',          skin.borderWidth);
		set('--book-panel-shadow',          skin.panelShadow);
		set('--nerfbar-extras-display',     skin.nerfbarExtras);

		// Menubox button text color: light skins use altpaper (bright on dark terminal);
		// dark skins use textColor (designed to contrast against dark panels).
		// Determined by relative luminance of the panel background.
		const paper = skin.paperColor;
		if(paper && paper[0] === '#' && paper.length >= 7) {
			const r = parseInt(paper.slice(1,3), 16) / 255;
			const g = parseInt(paper.slice(3,5), 16) / 255;
			const b = parseInt(paper.slice(5,7), 16) / 255;
			const lum = 0.2126*r + 0.7152*g + 0.0722*b;
			set('--book-button-color', lum < 0.18 ?
				(skin.textColor     || '#cccccc') :
				(skin.altpaperColor || '#ecebe4'));
		}
	}

	save(key=undefined) {
		if(key===undefined) {
			key = this.storageKey;
		}
		let value = JSON.stringify(this.delta(this.merged,this.defaultPrefs));
		localStorage.setItem(key,value);
	}

	load(key=undefined) {
		if(key===undefined) {
			key = this.storageKey;
		}
		let value = localStorage.getItem(key);
		if(value != null) {
			this.apply(JSON.parse(value));
		}
	}

	// apply the xtermoption part of our show.  Can be called from a
	// promise.then for ensuring that the fonts are loaded.
	applyXtermoptions(delta) {
		if(delta.xtermoptions) {
			this.lociterm.terminal.options = { ...delta.xtermoptions };
			if(delta.xtermoptions.theme != undefined) {
				this.lociterm.terminal.options.theme = { ...delta.xtermoptions.theme };
			}
		}
		this.lociterm.fitAddon.fit();
		this.lociterm.terminal.scrollToBottom();
		this.lociterm.terminal.refresh(0,this.lociterm.terminal.rows-1);
		this.lociterm.onWindowResize(); 
		return;
	}

	// returns a copy of a, with key values matching those in b removed.
	// Double damn you, javascript.
	delta(a,b) {
		const isObject = (i) => {
			return(i && typeof i==='object' && !Array.isArray(i));
		}
		let ret = {};
		if(isObject(a) && isObject(b)) {
			Object.keys(a).forEach( k=>{
				if((k in b)) {
					if(isObject(b[k])) {
						let o = this.delta(a[k],b[k]);
						if (Object.keys(o).length !== 0 ) {
							ret[k] = o;
						}
					} else {
						if( a[k] !== b[k] ) {
							Object.assign(ret, { [k]: a[k] });
						}
					}
				}
			});
		}
		return(ret);
	}
}

export { LociPreferences }

