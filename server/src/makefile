# $Id: makefile,v 1.1 2022/05/02 02:35:25 malakai Exp $
#
# Copyright © 2022 Jeff Jahr <malakai@jeffrika.com> - All Rights Reserved
# This is NOT open source software.  Redistribution and use in source and
# binary forms, with or without modification, are NOT permitted.  Contact
# author for additional license information.

# $(LOCI) is the name of the last-outpost server binary. Make install will copy
# it to ../$(LOCI).next so that the guardian script can pick it up on the next
# reboot.
LOCI = locid

# List the LOCI .c files here.  Order doesn't matter.  Dont worry
# about header file dependencies, this makefile will figure them out
# automatically.
LOCI_CFILES = locid.c debug.c locilws.c client.c game.c telnet.c libtelnet.c

# The list of HFILES, (required for making the ctags database) is generated
# automatically from the LOCI_CFILES list.  However, not everything in LOCI_CFILES
# has a corresponding .h file.  MISSING_HFILES lists the .h's that aren't
# expected to exist.  ADDITIONAL_HFILES lists the .h's for which no .c exists.
ADDITIONAL_HFILES = 
MISSING_HFILES = 

# CDEBUG, use -g for gdb symbols.  For gprof, add -pg and -no-pie.
CDEBUG = -g -Og

# #### Flags and linklibs definitions ####

CFLAGS = -Wall -Wno-discarded-qualifiers -Wno-unused-variable -Wno-unused-function -Wno-unused-but-set-variable `pkg-config --cflags glib-2.0`

LDFLAGS = -L/usr/local/lib
LINKLIBS = -lwebsockets `pkg-config --libs glib-2.0`

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

$(info ---------- START OF LAST-OUTPOST COMPILATION -----------)
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
	$(CC) $(CDEBUG) $(LDFLAGS) $^ -o $(@) $(LINKLIBS)

# check the .h dependency rules in the .d files made by gcc
-include $(LOCI_DFILES)

# Build the .o's from the .c files, building .d's as you go.
$(BUILD)/%.o : %.c
	$(CC) $(CDEBUG) $(CFLAGS) -MMD -c $< -o $(@)

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

