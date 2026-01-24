# makefile - LociTerm 
# Created: Sun May  1 10:42:59 PM EDT 2022 malakai

# Copyright © 2022-2026 Jeff Jahr <malakai@jeffrika.com>
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

# This section controls the version string that appears in the client, server,
# and archive files, and in the client/server hello protocol.  It is a
# major.minor.patch semver.  If you are adding localized changes and want to
# bump a version number, don't modify LOCITERM_CORE, instead see the META_
# section below.
LOCITERM_CORE = 2.12.0

# Define these meta-data variables after this comment block if you are keeping
# localized modifications to the code that are not included in the upstream
# lociterm release, but are still roughly compatible with the upstream code.
# This lets you keep track of the version of your localized changes while
# maintaining the ability to merge in lociterm code changes from upstream.
# Browser cached lociterm client code will detect changes in the META_VERSION,
# and reload to get updates.
#
# META_NAME = MyGame
# META_VERSION = 1.0.0
#

# #### Variable definitions ####
BUILD = ./dist
INSTALL = /usr/local
SERVERDIR = ./server
CLIENTDIR = ./client
NPM = ./client/node_modules
CERTNAME = loci

# #### End of tunable makefile parameters ###

# set up LOCITERM_VERSION based on provided semver parameters.
ifneq ($(origin META_NAME), undefined) 
	LOCITERM_VERSION = $(LOCITERM_CORE)-$(META_NAME).$(META_VERSION)
else 
	LOCITERM_VERSION = $(LOCITERM_CORE)
endif

TARFILE = ../lociterm_$(LOCITERM_VERSION).tgz
DATEKEY = `date +%y%m%d%H%M`

# #### Recipies Start Here ####


$(info ---------- START OF BUILD -----------)
all : $(BUILD) $(NPM) server client distlauncher
	$(info ---------- END OF BUILD --- SUCCESS! -----------)
	@echo ---- Run \`./lociterm\` to test out the build, then
	@echo ---- run \`make install\` as root to install into $(INSTALL)

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

.PHONY : distlauncher
distlauncher : $(BUILD) server/lociterm.sh
	cp server/lociterm.sh lociterm
	chmod +x lociterm

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
	rm lociterm

.PHONY : install
install :
	$(info --- install ----)
	mv -f $(INSTALL)/bin/locid $(INSTALL)/bin/locid.prev 2>/dev/null || true
	cp -av $(BUILD)/* $(INSTALL)
	@echo
	@echo ---- Ensure you have manually backed up any DB files, THEN...    ----
	@echo ---- Run \`systemctl restart lociterm.service\` as root to go live ----

.PHONY: systemd
systemd: 
	cp server/lociterm.service /etc/systemd/system
	systemctl enable lociterm.service

.PHONY : tar
tar :
	$(info --- Tar file create ----)
	tar -C .. -cvz --exclude-vcs --exclude-from=.exclude  -f $(TARFILE) lociterm
	@echo
	@echo ---- Tar File is $(TARFILE) ----

.PHONY : push
push: 
	@git tag -a lociterm$(LOCITERM_CORE) -m "Version $(LOCITERM_CORE)" || { echo "Remember to update LOCITERM_CORE in the makefile."; exit 1; }
	git push origin dev --tags
	@echo ---- Run \`make github\` to publish there ----

.PHONY : github
github: 
	git push github dev --tags
