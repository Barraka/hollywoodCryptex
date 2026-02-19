#!/bin/bash
# Wait for pm2 services to be ready
sleep 5

# Start Chromium in kiosk mode
DISPLAY=:0 chromium --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:8080
