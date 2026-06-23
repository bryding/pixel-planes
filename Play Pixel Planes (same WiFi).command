#!/bin/bash
# Double-click this to start Pixel Planes for same-WiFi play.
# It needs Python (every Mac has it). No accounts, no installs.
cd "$(dirname "$0")"
echo "Starting Pixel Planes..."
python3 server/server.py
