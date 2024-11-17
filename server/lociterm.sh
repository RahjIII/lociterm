#!/bin/bash
#
# Start up a local locid instance for testing out of the top level dist
# directory.  Runs locid on port 4500 by default, configured to connect to a
# mud running on localhost 4000.   No SSL enabled.
#
echo "LociTerm will try to connect to default game at localhost:4000"
echo "Look for a new browser tab or window to appear."
echo ""
echo "(Note- you can choose a different Game Server from within LociTerm"
echo "Settings if you don't have a mud on port 4000.)"
echo ""

./dist/bin/locid -c ./server/dist.conf --browser
