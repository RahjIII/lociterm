## What's New

### Version 2.14.0

- Added 'scan-force' option to locid to force a refresh of the DOWN hosts in
  the database without needing to update the [scan] portion of the config file.

- Removed the requirement that the configured log-file be writable before locid
  can do anything.

### Version 2.11.0

- Added optional "Keep Command Selected" behavior to the nerfbar line editor.
  Instead clearing the input after it is sent, the input is selected and left
  in the buffer so that: 'Enter' will re-send the same command; hitting the
  'down history' arrow will erase the command; and any other keystroke should
  overwrite the selection.  (Keeping the last command in the line editor is a
  non-standard behavior in a traditional line mode Telnet client, but it is a
  common behavior in many line-mode-only MUD clients that MUD players have
  grown accustomed to, and have requested.)

- Added additional Ctrl-M shortcut and keyboard focus management.  Ctrl-M will
  jump between the terminal / line editor and the menubox.  Any non menu
  navigation keystrokes made while the menubox or a submenu is active will
  automatically focus and go to the terminal.


### Version 2.10.0

- Logout menu has changed to support a fast game reload (game disconnect
  followed by game reconnect) option.  Also zvailable as Alt-R keyboard
  shortcut withing the nerfbar line editor interface.

- Added an explicit client reload option to the logout menu to request fresh
  client code from the locid server.  Normally the client code detects a change
  in locid server version, but reload option can be useful for development.

### Version 2.9.0

- Rework of libtelnet to support MCCP2 and MCCPX-draft compression protocols.

### Version 2.6.0

- Reworked keyboard accessibility for the button grid and side menus.
- Added Ctrl-m shortcut to jump focus to the Client Settings menu.
- Added ARIA hinting around the newly keyboard navigable menus.
- Fixed a layout bug that caused popup menu buttons to not have the same button
  height as the grid menu buttons.

### Version 2.5.2

- Tweaks and bugfixes for GMCP Client.Media sound and music.

### Version 2.5.0

- Added support for GMCP Client.Media sound and music.

### Version 2.4.0

- bugfix to keep the line mode password from echoing
- added OSC8 send: and prompt: hyperlink parser

### Version 2.3.1

- Added terminal state restoration on refresh.
- Better end-to-end CHARSET support.

### Version 2.3.0

- Added network stats monitor
- Re-worked the preferences manager.
- Split control for text size into Terminal and Menu prefs.
- Added Line Spacing to terminal size
- Added "Enhance Contrast" min contrast ratio control.
- Added "Bold is Bright" control.
- Moved CRT Filters into User Interface
- Added control to Hide Scroll Bar
- Added Terminal Settings for local line mod, line mode echo, local cmd chains.
- Added control for Backspace to send DEL or BS
- Added terminal character set encoding selector

### Version 2.2.0

- First version with locibot db scanner.

### Version 2.1.0

- First public relase of LociTerm 2 source!
- Many improvements over LociTerm 1, too many to list here.

### Version 2.0.x

- No public release.

### Version 1.9.0 

- Relased as a .tgz on LO pubcode archive.
- Ran well for a long time!

### Version 1.0.0 and earlier...

- Ancient History.
