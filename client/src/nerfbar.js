// nerfbar.js - pitiful line mode support
// Created: Mon 26 Dec 2022 11:55:45 PM EST
// $Id: nerfbar.js,v 1.2 2023/01/30 00:01:58 malakai Exp $

// Copyright © 2023 Jeff Jahr <malakai@jeffrika.com>
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
// Eventually, this may become a "line mode editor" option for the web client.
// Right now it is a simple work in progress.

class NerfBar {

	constructor(lociterm,elementid) {

		this.lociterm = lociterm;
		if ((this.mydiv = document.getElementById(elementid)) == undefined) {
			this.mydiv = document.createElement('div');
			this.mydiv.id='elementid';
			this.lociterm.mydiv.appendChild(this.mydiv);
		}
		this.mydiv.classList.add('nerfbar');
		this.create_nerfbar();
		
	}

	// Add the NerfBar definition to the DOM.
	create_nerfbar() {
		let box = this.mydiv;
		let label;
		let input;
		let sendkey;
		let tabkey;

		//label = document.createElement('label');
		//label.setAttribute("for","nerfinput");
		//label.innerText = "NerfBar";
		//box.appendChild(label);

		input = document.createElement('input');
		input.setAttribute("name","nerfinput");
		input.setAttribute("type","text");
		input.setAttribute("autocapitalize","none");
		input.setAttribute("autocomplete","off");
		input.setAttribute("autococorrect","off");
		input.placeholder = "Enter a command...";
		input.id = "nerfinput";

		input.onchange = ((e)=>{
			this.lociterm.paste(e.srcElement.value);
			this.lociterm.paste("\n");
			e.srcElement.value = "";
		});

		input.onkeydown = ((e)=>{
			if(e.code == "Enter") {
				this.lociterm.paste(e.srcElement.value);
				this.lociterm.paste("\n");
				e.srcElement.value = "";
				e.preventDefault();
			}
			if(e.code == "Tab") {
				this.lociterm.paste(e.srcElement.value);
				this.lociterm.paste("\t");
				e.srcElement.value = "";
				e.preventDefault();
			}
		});
		box.appendChild(input);

		tabkey = document.createElement('button');
		tabkey.setAttribute("type","button");
		tabkey.onclick = ((e)=>{
			this.lociterm.paste(input.value);
			this.lociterm.paste("\t");
			input.value = "";
		});
		tabkey.innerText = "↹";
		box.appendChild(tabkey);

		sendkey = document.createElement('button');
		sendkey.setAttribute("type","button");
		sendkey.onclick = ((e)=>{
			this.lociterm.paste(input.value);
			this.lociterm.paste("\n");
			input.value = "";
		});
		sendkey.innerText = "⏎";
		box.appendChild(sendkey);

		return(box);
	}

	// make the nerfbar appear.
	open() {
		this.mydiv.style.display= 
			getComputedStyle(document.documentElement).getPropertyValue('--nerfbar-open-display');
		this.lociterm.fitAddon.fit();
		this.lociterm.doWindowResize();
	}

	// make the nerfbar DIE DIE DIE. I hate you, nerfbar.
	close() {
		this.mydiv.style.display=
			getComputedStyle(document.documentElement).getPropertyValue('--nerfbar-close-display');
		this.lociterm.fitAddon.fit();
		this.lociterm.doWindowResize();
	}

}

export { NerfBar };
