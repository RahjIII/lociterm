# $Id: makefile,v 1.3 2022/05/08 18:30:10 malakai Exp $
#
# makefile - LociTerm 
# Created: Sun May  1 10:42:59 PM EDT 2022 malakai
# $Id: makefile,v 1.3 2022/05/08 18:30:10 malakai Exp $

# Copyright © 2022 Jeff Jahr <malakai@jeffrika.com>
#
# This file is part of LociTerm - Last Outpost Client Implementation Terminal
#
# LociTerm is free software: you can redistribute it and/or modify it under
# the terms of the GNU Lesser General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# LociTerm is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for
# more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with LociTerm.  If not, see <https://www.gnu.org/licenses/>.
#


# #### Variable definitions ####
RUN = ./run
SERVERDIR = ./server
CLIENTDIR = ./client
NPM = ./client/node_modules

# #### Recipies Start Here ####

$(info ---------- START OF RUN -----------)
all : $(RUN) $(NPM) server client
	$(info ---------- END OF RUN --- SUCCESS! -----------)

.PHONY : server
server : $(RUN)
	cd $(SERVERDIR)/src; make
	cp $(SERVERDIR)/src/build/locid $(RUN)/bin
	cp $(SERVERDIR)/locid.conf $(RUN)/etc

.PHONY : client 
client : $(RUN)
	cd $(CLIENTDIR); npm run build
	cp -r $(CLIENTDIR)/dist/* $(RUN)/var/www/loci

# Create run directory...
$(RUN) : 
	mkdir -p $(RUN)
	mkdir -p $(RUN)/bin
	mkdir -p $(RUN)/etc
	mkdir -p $(RUN)/var/www/loci

$(NPM) : 
	cd $(CLIENTDIR); npm install

# Cleaning up...
.PHONY : clean
clean : 
	cd server; make clean
	cd client; npm run build
