// objdeep.js - deep merge and intersect for jobjs.
// Created: 
// $Id: objdeep.js,v 1.1 2024/04/30 16:53:36 malakai Exp $

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


// This function stolen from stack overflow, without attribution. :( sorry.
export function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

// This function stolen from stack overflow, without attribution. :( sorry.
export function merge(target, source) {
	const isObject = (item) => { 
		return (item && typeof item === 'object' && !Array.isArray(item));
	};
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = merge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

// This code was modified from above code.  -jsj
// Merge source with target, but only for keys defined in target.
export function intersect(target, source) {
	const isObject = (item) => { 
		return (item && typeof item === 'object' && !Array.isArray(item));
	};
	let output = Object.assign({}, target);
	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach(key => {
			if ((key in target)) {
				if (isObject(source[key])) {
					output[key] = intersect(target[key], source[key]);
				} else {
					Object.assign(output, { [key]: source[key] });
				}
			}
		});
	}
	return output;
}
