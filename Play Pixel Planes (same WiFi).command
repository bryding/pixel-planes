#!/bin/bash
# Double-click to start Pixel Planes for same-WiFi play (the ONE shared world).
# This runs the Node server (it serves the game AND hosts the live world).
cd "$(dirname "$0")"
echo "Starting Pixel Planes..."

# Need Node for the server (it uses the tiny "ws" library).
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node isn't installed. Get it (one time) from https://nodejs.org"
  echo "  then double-click this file again."
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

# First run: install the server's one dependency (ws).
if [ ! -d server/node_modules ]; then
  echo "First-time setup: installing the server bits..."
  ( cd server && npm install )
fi

# Open the game in your browser automatically (at the correct local address).
( sleep 2; open "http://localhost:8080" ) &
node server/server.js
