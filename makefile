# $Id: makefile,v 1.11 2024/09/20 17:53:40 malakai Exp $
#
# makefile - LociTerm 
# Created: Sun May  1 10:42:59 PM EDT 2022 malakai
# $Id: makefile,v 1.11 2024/09/20 17:53:40 malakai Exp $

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

# This one location controls the version string that appears in the client,
# server, and archive files!
LOCITERM_VERSION = 2.0.0
#

# #### Variable definitions ####
BUILD = ./dist
INSTALL = /usr/local
SERVERDIR = ./server
CLIENTDIR = ./client
NPM = ./client/node_modules
CERTNAME = loci
DATEKEY = `date +%y%m%d%H%M`
TARFILE = ../lociterm_$(LOCITERM_VERSION).tgz

# #### Recipies Start Here ####

$(info ---------- START OF BUILD -----------)
all : $(BUILD) $(NPM) server client
	$(info ---------- END OF BUILD --- SUCCESS! -----------)

.PHONY : server
server : $(BUILD)
	cd $(SERVERDIR)/src; make "LOCITERM_VERSION = $(LOCITERM_VERSION)"
	cp $(SERVERDIR)/src/build/locid $(BUILD)/bin
	cp $(SERVERDIR)/locid.conf $(BUILD)/etc

.PHONY : client 
client : $(NPM) $(BUILD)
	cd $(CLIENTDIR); npm version --allow-same-version $(LOCITERM_VERSION)
	cd $(CLIENTDIR); npm run build
	cp -r $(CLIENTDIR)/dist/* $(BUILD)/var/www/lociterm

# Create run directory...
$(BUILD) : 
	mkdir -p $(BUILD)
	mkdir -p $(BUILD)/bin
	mkdir -p $(BUILD)/etc
	mkdir -p $(BUILD)/etc/ssl/certs
	mkdir -p $(BUILD)/etc/ssl/private
	mkdir -p $(BUILD)/var/www/lociterm
	mkdir -p $(BUILD)/var/lib/lociterm

$(NPM) :
	cd $(CLIENTDIR); npm install

.PHONY: cert
cert : $(BUILD)
	$(info --- Creating self-signed cert and key ----)
	openssl req -nodes -new -x509 \
		-keyout $(BUILD)/etc/ssl/private/$(CERTNAME)_key.pem \
		-out $(BUILD)/etc/ssl/certs/$(CERTNAME)_cert.pem

# Cleaning up...
.PHONY : clean
clean : 
	cd $(SERVERDIR)/src; make clean
	cd $(CLIENTDIR); npm run clean

.PHONY : install
install :
	$(info --- install ----)
	mv -f $(INSTALL)/bin/locid $(INSTALL)/bin/locid.prev 2>/dev/null || true
	cp -av $(BUILD)/* $(INSTALL)
	@echo
	@echo ---- Run \`systemctl restart lociterm.service\` as root to go live ----

.PHONY: systemd
systemd: 
	cp server/lociterm.service /etc/systemd/system
	systemctl enable lociterm.service

.PHONY : tar
tar :
	$(info --- Tar file create ----)
	tar -cvz --exclude-vcs --exclude-from=.exclude  -f $(TARFILE) .
	@echo
	@echo ---- Tar File is $(TARFILE) ----
