#!/bin/bash
# Double-click to start Pixel Planes for same-WiFi play.
# Uses Python (already on every Mac). No installs, no accounts.
cd "$(dirname "$0")"
echo "Starting Pixel Planes..."
# Open the game in your browser automatically (at the correct local address).
( sleep 2; open "http://localhost:8080" ) &
python3 server/server.py
