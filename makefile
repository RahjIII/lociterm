# $Id: makefile,v 1.1 2022/05/02 02:35:25 malakai Exp $
#

# #### Variable definitions ####
RUN = ./run
SERVERDIR = ./server
CLIENTDIR = ./client
NPM = ./client/node_modules

# #### Recipies Start Here ####

$(info ---------- START OF RUN -----------)
all : $(RUN) $(NPM) server client tags
	$(info ---------- END OF RUN --- SUCCESS! -----------)

.PHONY : server
server : $(RUN)
	cd $(SERVERDIR)/src; make
	cp $(SERVERDIR)/src/build/locid $(RUN)/bin
	cp $(SERVERDIR)/locid.conf $(RUN)/etc

.PHONY : client 
client : $(RUN)
	cd $(CLIENTDIR); npm run build
	cp $(CLIENTDIR)/dist/* $(RUN)/var/www/loci

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
