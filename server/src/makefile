# makefile - LociTerm locid server
# Created: Sun May  1 10:42:59 PM EDT 2022 malakai
# $Id: makefile,v 1.9 2024/09/15 16:39:29 malakai Exp $

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


# $(LOCI) is the name of the LociTerm server binary. Make install will copy
# it to ../$(LOCI).next so that the guardian script can pick it up on the next
# reboot.
LOCI = locid

# Ideally, this should match the LOCITERM_VERSION in the toplevel makefile.
# This is only here so that if you make only the server, there's at least some
# version number.
LOCITERM_VERSION ?= 2.0.0-dev

# List the LOCI .c files here.  Order doesn't matter.  Dont worry
# about header file dependencies, this makefile will figure them out
# automatically.
LOCI_CFILES = locid.c debug.c proxy.c client.c game.c connect.c telnet.c libtelnet.c gamedb.c

# The list of HFILES, (required for making the ctags database) is generated
# automatically from the LOCI_CFILES list.  However, not everything in LOCI_CFILES
# has a corresponding .h file.  MISSING_HFILES lists the .h's that aren't
# expected to exist.  ADDITIONAL_HFILES lists the .h's for which no .c exists.
ADDITIONAL_HFILES = 
MISSING_HFILES = 

# CDEBUG, use -g for gdb symbols.  For gprof, add -pg and -no-pie.
# For ASAN add -fsanitize=address (uses a much larger memory footprint)
# use 'break __sanitizer::Die' inside of gdb to stop on a san error
#CDEBUG = -g -Og
CDEBUG = -g 
# CDEBUG = -g  -fsanitize=address

# CDEFINES, for passing version number in through makefiles.
CDEFINES = -D'LOCITERM_VERSION="$(LOCITERM_VERSION)"'

# #### Flags and linklibs definitions ####

CFLAGS = -I/usr/local/include -Wall -Wno-discarded-qualifiers -Wno-unused-variable -Wno-unused-function -Wno-unused-but-set-variable -DHAVE_ZLIB
CFLAGS += `pkg-config --cflags glib-2.0`
CFLAGS += `pkg-config --cflags libwebsockets`
CFLAGS += `pkg-config --cflags json-c`
CFLAGS += `pkg-config --cflags sqlite3`



LDFLAGS = -L/usr/local/lib
LINKLIBS = -lz
LINKLIBS += `pkg-config --libs libwebsockets` 
LINKLIBS += `pkg-config --libs glib-2.0`
LINKLIBS += `pkg-config --libs json-c`
LINKLIBS += `pkg-config --libs sqlite3`

# #### ############################################# ###
# ####         Makefile magic begins here.           ###
# #### Very little needs to change beyond this line! ###
# #### ############################################# ###


CC=gcc
BUILD = ./build

CFILES = $(LOCI_CFILES)

# HFILES generated automatically from CFILES, with additions and exclusions
HFILES := $(ADDITIONAL_HFILES)
HFILES += $(addsuffix .h, $(basename $(CFILES)))
HFILES := $(filter-out $(MISSING_HFILES), $(HFILES))

LOCI_OFILES = $(LOCI_CFILES:%.c=$(BUILD)/%.o)
OFILES = $(LOCI_OFILES)

LOCI_DFILES = $(LOCI_CFILES:%.c=$(BUILD)/%.d)
DFILES = $(LOCI_DFILES)

RUN = .

# #### Recipies Start Here ####

$(info ---------- START OF LOCID COMPILATION -----------)
all : $(BUILD) run tags

# Copying the binaries...
#.PHONY: $(LOCI)
$(LOCI) : $(BUILD) $(BUILD)/$(LOCI)

.PHONY: run
run : $(LOCI) $(RUN)/$(LOCI)

# The mv command is to prevent 'text file busy' error, and the 2>/ is some bash
# bullshit to keep the command from failing the make if the source file doesn't
# exist.
$(RUN)/$(LOCI) : $(BUILD)/$(LOCI)
	-mv -f $(RUN)/$(LOCI) $(RUN)/$(LOCI).prev 2>/dev/null || true
	cp $(BUILD)/$(LOCI) $(RUN)/$(LOCI)

# Create build directory...
$(BUILD) : 
	mkdir -p $(BUILD)

# Create run directory...
$(RUN) : 
	mkdir -p $(RUN)

# Linking the LOCI binary...
$(BUILD)/$(LOCI) : $(LOCI_OFILES)
	$(CC) $(CDEBUG) $(CDEFINES) $(LDFLAGS) $^ -o $(@) $(LINKLIBS)

# check the .h dependency rules in the .d files made by gcc
-include $(LOCI_DFILES)

# Build the .o's from the .c files, building .d's as you go.
$(BUILD)/%.o : %.c
	$(CC) $(CDEBUG) $(CDEFINES) $(CFLAGS) -MMD -c $< -o $(@)

# Updating the tags file...
tags : $(HFILES) $(CFILES)
	ctags $(HFILES) $(CFILES)

# Cleaning up...
# .PHONY just means 'not really a filename to check for'
.PHONY: clean
clean : 
	-rm $(BUILD)/$(LOCI) $(LOCI) $(OFILES) $(DFILES) tags
	-rmdir $(BUILD)

install: $(LOCI) 
	$(info ---- Not written yet! ----)

.PHONY: wall-summary
wall-summary: 
	$(info ** Enable these errors in the CFLAGS section to track them down. )
	$(info ** Run this after a make clean for full effect! )
	make "CFLAGS=-Wall" 2>&1 | egrep -o "\[-W.*\]" | sort | uniq -c | sort -n

