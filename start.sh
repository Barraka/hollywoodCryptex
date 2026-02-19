#!/bin/bash
# Start Cryptex prop: controller + web UI + kiosk

# Install controller dependencies if needed
cd ~/cryptex/controller
if [ ! -d "node_modules" ]; then
  echo "[Start] Installing controller dependencies..."
  npm install
fi

# Start controller (GPIO + MQTT + local WS)
node index.js &
CONTROLLER_PID=$!
echo "[Start] Controller started (PID $CONTROLLER_PID)"

# Start web server for UI
cd ~/cryptex/ui
npx serve . -l 8080 &
SERVE_PID=$!
echo "[Start] Web server started (PID $SERVE_PID)"

# Wait for both services to be ready
sleep 4

# Start Chromium in kiosk mode
chromium --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:8080

# Cleanup on exit
kill $CONTROLLER_PID $SERVE_PID 2>/dev/null
