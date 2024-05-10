// crtfilter.js - create <svg> DOM node with custom filters.
// Created: Tue Apr 30 11:45:30 AM EDT 2024
// $Id: crtfilter.js,v 1.2 2024/05/10 15:03:21 malakai Exp $

// Copyright © 2024 Jeff Jahr <malakai@jeffrika.com>
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

// Need some object deep merging functions.
import * as ObjDeep from './objdeep.js';

// CRTFilter creates a bunch of svg filters based on the opts, and stores the
// filter definition in a css variable named `--${this.filterid}-filter`.
// Apply 'filter: var(--${this.filterid}-filter)' to a div to have the filters
// take effect.  Note that as of Apr 30 2024, Firefox does not like puting
// url() filters onto div, and the filters won't work. :(
class CRTFilter { 

	constructor(filterid) {

		// Used as a name for this instance in various places.
		this.filterid = filterid;

		// These options enumerate all of the possible values.
		this.defaultopts = {
			enabled: false,
			monotone: {
				enabled: true,
				saturation: 0.0,
				red: 0.2,
				green: 1.0,
				blue: 0.4,
				exponent: 0.8,
				offset: 0.02
			},
			scanline: true,
			dotstretch: true,
			bloom: {
				enabled: true,
				stdDeviation: 5,
				bloom: 1.0,
				beam: 1.0
			},
			barrel: {
				enabled: true,
				showfilter: false,
				exponent: 1.8,
				scale: 64
			},
			saturate: 1.0,
			brightness: 1.0,
			contrast: 1.0,
			hue_rotate: 0
		};

		// These options are the load/saveable ones.
		this.storedopts = {
			enabled: false,
			monotone: {
				enabled: true,
			},
			hue_rotate: 0,
			bloom: {
				bloom: 1.0,
			},
			barrel: {
				scale: 64
			}
		};

		// These options are the ones that will get applied.  Set these values
		// and call this.update();
		this.opts = this.defaultopts;
		
		let opts = this.opts;

		// The SVG filter definitions have to stored in the defs section under
		// an svg object in the document root.  Construct it.
		let svg = this.createSvgElement('svg');
		svg.id = `${filterid}`;
		svg.setAttribute("display","none");
		svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
		document.body.appendChild(svg);
		let defs = this.createSvgElement('defs');
		svg.appendChild(defs);

		// Construct the filters.
		defs.appendChild(this.filter_monotone(filterid,opts));
		defs.appendChild(this.filter_scanline(filterid,opts));
		defs.appendChild(this.filter_dotstretch(filterid,opts));
		defs.appendChild(this.filter_barrel(filterid,opts));
		defs.appendChild(this.filter_bloom(filterid,opts));

		// ...and apply the defaults to them.
		this.update();

		return(this);
	}

	// applies this.opts to the various parts of the individual filters,
	// re-builds the filterstring, and updates the style variable.  This
	// wrangling is because the svg filters don't seem to accept var() css
	// styles like it seems they should, so there has to be some direct writing
	// of values.
	update(merge={}) {
		let filterstring = "";

		this.opts = ObjDeep.merge(this.opts,merge);
		let opts = this.opts;

		if(opts.enabled == false) {
			document.setElementById("filters-select", opts.enabled);
			filterstring = "unset";
		} else {
			document.setElementById("filters-select", opts.enabled);

			if(opts.monotone && (opts.monotone.enabled != undefined)) {
				document.setElementById("monotone-select", opts.monotone.enabled);
			}
			if(opts.monotone && opts.monotone.enabled) {
				filterstring += `url(#${this.filterid}_monotone)`;
				let item = document.getElementById(`${this.filterid}_monotone`);
				if(opts.monotone.saturation) {
					item.childNodes[0].setAttribute("saturate",`${opts.monotone.saturation}`);
				}
				let element = 	item.childNodes[1];
				for (const [key, value] of Object.entries(opts.monotone)) {
					element.setAttribute(key,value);
				}
			}

			if(opts.scanline) {
				filterstring += ` url(#${this.filterid}_scanline)`;
			}

			if(opts.dotstretch) {
				filterstring += ` url(#${this.filterid}_dotstretch)`;
			}


			if(opts.barrel && opts.barrel.enabled) {
				filterstring += ` url(#${this.filterid}_barrel)`;
				let item = document.getElementById(`${this.filterid}_barrel`);
				// showmap and exponent are also variables, but updating them
				// requires rebuilding the displacement map, and I'm not going
				// to do that right now.  -jsj
				if(opts.barrel.scale != undefined) { 
					document.setElementById("tube-slider", opts.barrel.scale);
					item.childNodes[1].setAttribute("scale",`${opts.barrel.scale}`);
				}
			}

			if(opts.bloom && opts.bloom.enabled) {
				filterstring += ` url(#${this.filterid}_bloom)`;
				let item = document.getElementById(`${this.filterid}_bloom`);
				if(opts.bloom.stdDeviation) {
					item.childNodes[0].setAttribute("stdDeviation",`${opts.bloom.stdDeviation}`);
				}
				if(opts.bloom.bloom != undefined) { 
					document.setElementById("bloom-bloom-slider", opts.bloom.bloom);
					item.childNodes[1].setAttribute("k2",`${opts.bloom.bloom}`);
				}
				if(opts.bloom.beam) { 
					item.childNodes[1].setAttribute("k3",`${opts.bloom.beam}`);
				}
			}

			// hue rotate
			if(opts.hue_rotate != undefined) {
				document.setElementById("hue-slider", opts.hue_rotate);
			}
			if(opts.monotone && opts.monotone.enabled && opts.hue_rotate) {
				filterstring += ` hue-rotate(${opts.hue_rotate}deg)`;
			}
		}

		document.documentElement.style.setProperty(`--${this.filterid}-filter`, filterstring);
		return(filterstring);
	}

	// create an svg document element.  The namespace for SVG elements is
	// different from the default, this call simplifies creation.
	createSvgElement(named,attrs={}) {
		let ns = "http://www.w3.org/2000/svg";
		let element = document.createElementNS(ns,named);
		for (const [key, value] of Object.entries(attrs)) {
			element.setAttribute(key,value);
		}
		return(element);
	}

	// a utility function to create an feComponentTransfer gamma function. 
	gamma(red,green,blue,exponent,offset) {
		let transfer = this.createSvgElement("feComponentTransfer");
		let opts = {};
		opts.type = "gamma";
		opts.exponent = `${exponent}`;
		opts.offset = `${offset}`;

		opts.amplitude = `${red}`;
		transfer.appendChild(
			this.createSvgElement("feFuncR",opts)
		);
		opts.amplitude = `${green}`
		transfer.appendChild(
			this.createSvgElement("feFuncG",opts)
		);
		opts.amplitude = `${blue}`
		transfer.appendChild(
			this.createSvgElement("feFuncB",opts)
		);
		transfer.appendChild(
			this.createSvgElement("feFuncA",{type: "identity"})
		);
		return(transfer);
	}

	// create a DataURL containing the scanline filter image.
	scanline_dataURL(width,height) {
		let canvas = document.createElement("canvas");
		let ctx = canvas.getContext("2d");
		if(!ctx) { 
			console.error("Bad canvas ctx.");
			return("");
		}
		canvas.width = width;
		canvas.height = height;
		//ctx.fillStyle = "#FFFFFF00";
		//ctx.fillRect(0,0,width,height);
		ctx.globalCompositeOperation = "darken";
		for (let y=0; y<=height; y+=2 ) {
			ctx.fillStyle = "#CCCCCC00";
			ctx.fillRect(0,y-1,width,1);
			ctx.fillStyle = "#000000FF"
			ctx.fillRect(0,y,width,1);
		}
		return(canvas.toDataURL());
	}

	// create a DataURL contianing a barrel map
	barrel_dataURL(width,height,exponent) {
		let canvas = document.createElement("canvas");
		let ctx = canvas.getContext("2d");
		if(!ctx) { 
			console.error("Bad canvas ctx.");
			return("");
		}
		canvas.width = width;
		canvas.height = height;
		//ctx.globalCompositeOperation = "screen";

		const centerw = width / 2;
		const centerh = height / 2;

		const gamma= (x,y,g) => {

			let r = 2.0 * (Math.pow(Math.sqrt( (x*x) + (y*y)) , g)/Math.sqrt(2)) -1.0;

			let dx = x * r;
			let dy = y * r;

			dx = Math.min(1.0,Math.max(-1.0,dx));
			dy = Math.min(1.0,Math.max(-1.0,dy));

			return( [dx,dy] );
		}

		for (let w = 0; w < width; w++) {
			for (let h = 0; h < height; h++) {

				const x = (2*w)/(width-1) -1.0;
				const y = (2*h)/(height-1) -1.0;

				let delta = gamma(x,y,exponent);

				const red = Math.round( (128 * delta[0]) + 128);
				const blue = Math.round( (128 * delta[1]) + 128);
				const green = 0;

				ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
				ctx.fillRect(w, h, 1, 1);
			}
		}
		return(canvas.toDataURL());
	}

	// Construct the monotone filter node.
	filter_monotone ( filterid, opts ) {
		let filter = this.createSvgElement('filter');
		filter.id = `${filterid}_monotone`;

		let saturation = 
			(opts.monotone.saturation)?opts.monotone.saturation:0.0;
		filter.appendChild(
			this.createSvgElement(
				"feColorMatrix",
				{ type: "saturate", values: `${saturation}` }
			)
		);

		let gamma =this.gamma(
			(opts.monotone.red)?opts.monotone.red:0.2,
			(opts.monotone.green)?opts.monotone.green:1.0,
			(opts.monotone.blue)?opts.monotone.blue:0.4,
			(opts.monotone.exponent)?opts.monotone.exponent:0.6,
			(opts.monotone.offset)?opts.monotone.offset:0.05,
			);
		filter.appendChild(gamma);
		return(filter);
	}

	// Construct the scanline filter node.
	filter_scanline ( filterid, opts ) {
		let filter = this.createSvgElement('filter');
		filter.id = `${filterid}_scanline`;

		let width=2;
		let height=2;
		filter.appendChild(
			this.createSvgElement( "feImage", {
				width: `${width}`,
				height: `${height}`,
				href: this.scanline_dataURL(width,height) } 
			)
		);
		filter.appendChild(
			this.createSvgElement("feTile")
		);
		filter.appendChild(
			this.createSvgElement("feBlend", { 
				in2: "SourceGraphic",
				mode: "normal" }
			)
		);
		return(filter);
	}

	// Construct the scanline filter node.  This filter, for whatever reason,
	// doesn't really work very well.  It applies sometimes, it doesn't apply
	// other times.  
	filter_scanline_badsvg ( filterid, opts ) {
		let filter = this.createSvgElement('filter');
		filter.id = `${filterid}_scanline`;
		
		filter.appendChild(
			this.createSvgElement( "feImage" )
		);
			
		filter.appendChild(
			this.createSvgElement( "feFlood", {
				"flood-color": "#00000000",
				x: "-1",
				y: "-1",
				width: "2",
				height: "1",
				result: "scanline" } 
			)
		);
		filter.appendChild(
			this.createSvgElement( "feFlood", {
				"flood-color": "#000000FF",
				x: "-1",
				y: "0",
				width: "2",
				height: "1",
				result: "blankline" } 
			)
		);
		filter.appendChild(
			this.createSvgElement( "feComposite", {
				"in2": "scanline",
				"in": "blankline",
				operator: "over",
				result: "stripes" }
			)
		);
		filter.appendChild(
			this.createSvgElement("feTile", {
				"in": "stripes",
				"result": "scanlines" }
			)
		);
		filter.appendChild(
			this.createSvgElement( "feComposite", {
				"in": "SourceGraphic",
				"in2": "scanlines",
				operator: "in" }
			)
		);
		return(filter);
	}


	// Construct the dotstretch filter node.  This applies a little bit of
	// horizontal blur to a pixel, and sharpens up the scanline a little bit.
	filter_dotstretch ( filterid, opts ) {
		let filter = this.createSvgElement('filter');
		filter.id = `${filterid}_dotstretch`;

		let kernelmatrix =	"0 0 0 0 0  0 0 -1 0 0  4 4 10 4 4  0 0 -1 0 0  0 0 0 0 0";
		
		filter.appendChild(
			this.createSvgElement("feConvolveMatrix", 
				{	order: 5,
					kernelMatrix: kernelmatrix, 
					in: "SourceGraphic"
				}
			)
		);
		return(filter);
	}

	// Applies a background glow filter.  The bloom option tends to function
	// like a brightness knob, and can be used as such.
	filter_bloom ( filterid, opts ) {
		let filter = this.createSvgElement('filter');
		filter.id = `${filterid}_bloom`;

		let stddev = (opts.bloom.stdDeviation!=undefined)?opts.bloom.stdDeviation:4.0;
		let bloom = (opts.bloom.bloom!=undefined)?opts.bloom.bloom:1.5;
		let beam = (opts.bloom.beam!=undefined)?opts.bloom.beam:1.0;
			
		filter.appendChild(
			this.createSvgElement("feGaussianBlur", 
				{ stdDeviation: `${stddev}` }
			)
		);
		filter.appendChild(
			this.createSvgElement("feComposite",
				{ operator: "arithmetic", 
					k1: "1.0",
					k2: `${bloom}`, 
					k3: `${beam}`,
					k4: "0.0",
					in2: "SourceGraphic"
				}
			)
		);
		return(filter);
	}

	// Puts a barrel distortion onto the mix. The edges of the div are pinned,
	// and the corners pull in.  Negative scale will give a pincusion effect,
	// but note that the corners will be moved off screen.  A better pincushion
	// would pin the corners and move the edges, but this is not that.
	filter_barrel ( filterid, opts ) {

		let filter = this.createSvgElement('filter');
		filter.id = `${filterid}_barrel`;

		let width = 512;
		let height = 512;
		let scale = (opts.barrel.scale)?opts.barrel.scale:100.0;
		let exponent = (opts.barrel.exponent)?opts.barrel.exponent:2.0;
		filter.appendChild(
			this.createSvgElement( "feImage", {
				//preserveAspectRatio: "xMidyMid slice",
				preserveAspectRatio: "none",
				href: this.barrel_dataURL(width,height,exponent),
				result: "barrelmap"} 
			)
		);
		if(! (opts.barrel.showfilter == true)) {
			filter.appendChild(
				this.createSvgElement("feDisplacementMap", 
					{ 
					id: `${filter.id}_map`,
					in: "SourceGraphic",
					in2: "barrelmap",
					xChannelSelector: "R",
					yChannelSelector: "B",
					// Sadly, this does not seem to work.  The scale has to
					// be a hard coded number inside the feDisplacement
					// map, not a style var reference.  -jsj
					// scale:  "var(--monitor-barrel-scale)"
					scale:  `${scale}`}
				)
			);
		}
		return(filter);
	}

	// store values from into local storage.
	save() {
		let saveme = ObjDeep.intersect(this.storedopts,this.opts);
		localStorage.setItem(this.filterid,JSON.stringify(saveme));
	}
	// load saved values from local storage, and apply to opts. 
	load() {
		try {
			let loadme = JSON.parse(localStorage.getItem(this.filterid));
			this.opts = ObjDeep.merge(this.opts,loadme);
			this.update();
		} catch {
			console.log("No saved ${this.filterid}.");
		}
	}
}

export { CRTFilter };
