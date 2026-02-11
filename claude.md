# Hollywood Cryptex Prop

## Overview

Touchscreen-based escape room prop for the **Hollywood** room at Escape Yourself. Players swipe 4 colored number columns to find the correct combination. When solved, a maglock opens a trap door.

## Architecture

```
ELECROW 7" HDMI Touch Display (1024×600, IPS, capacitive)
    │ HDMI (video)
    │ USB (touch input)
    ▼
Raspberry Pi (Zero 2W or 4B)
    ├── Chromium (kiosk mode, fullscreen)
    │   └── Cryptex Web UI (localhost:8080)
    ├── Node.js
    │   ├── HTTP server (serves UI)
    │   ├── MQTT client (Room Controller comms)
    │   └── GPIO control (maglock via onoff/pigpio)
    └── WiFi → MQTT Broker → Room Controller
                                  ↕ WebSocket
                              GM Dashboard
```

## Project Structure

```
Cryptex/
├── claude.md              # This file
├── Explanations.txt       # Original prop concept
├── SHOPPING_LIST.md       # Hardware parts list & costs
└── ui/                    # Web UI (runs in Chromium on Pi)
    ├── index.html         # Main page (4 colored columns)
    ├── style.css          # Dark theme, column colors, animations
    └── app.js             # Touch/swipe logic, solve detection
```

## Gameplay

1. Display shows 4 columns, each at **0**, each a different color (blue, red, green, yellow)
2. Players **swipe up/down** on each column to change the number (0-9, wraps around)
3. When the correct code is entered (**1234** by default), the prop triggers:
   - Columns flash green one by one
   - "OUVERT" overlay appears
   - Maglock releases (trap door opens)
4. GM can **reset** the prop via Dashboard (MQTT command), returning all columns to 0

## Configuration

All configurable values are at the top of `ui/app.js`:

```javascript
const CORRECT_CODE = [1, 2, 3, 4];   // The solution
const SWIPE_THRESHOLD = 30;           // px minimum swipe distance
const ANIMATION_DURATION = 250;       // ms slide animation
```

Column colors are set via `data-color` attributes in `index.html`:
- Column 1: `blue`
- Column 2: `red`
- Column 3: `green`
- Column 4: `yellow`

Colors can be changed by editing the `data-color` attribute and corresponding CSS in `style.css`.

## Controls (Desktop Testing)

| Input | Action |
|-------|--------|
| Mouse drag up/down | Change number on column |
| Scroll wheel | Change number on column |
| Keys 1-4 + Arrow Up/Down | Select column + change value |
| R key | Reset all columns to 0 |
| `window.resetCryptex()` | Reset from browser console |

## MQTT Integration (Planned)

Will follow the existing MQTT Contract v1.0:

**Topic**: `ey/<site>/<room>/prop/hollywood_cryptex/{status|event|cmd}`

**Status message** (published on state change):
```json
{
  "type": "status",
  "solved": true,
  "online": true,
  "override": false,
  "name": "Cryptex",
  "details": {
    "sensors": [
      {"sensorId": "col0", "triggered": true},
      {"sensorId": "col1", "triggered": true},
      {"sensorId": "col2", "triggered": true},
      {"sensorId": "col3", "triggered": true}
    ]
  }
}
```

**Commands** (received from Room Controller):
- `force_solve` → Set correct code + trigger solve animation + open maglock
- `reset` → Reset all columns to 0 + lock maglock

## Hardware

See `SHOPPING_LIST.md` for full parts list.

**Summary**:
- **Controller**: Raspberry Pi Zero 2W (~€18) or Pi 4B (~€45)
- **Display**: ELECROW 7" HDMI Capacitive Touch (~€60)
- **Actuator**: 12V DC maglock via MOSFET on GPIO
- **Power**: 12V PSU + 5V buck converter
- **Total cost**: ~€125-149

## Development

**Local testing** (no hardware needed):
```bash
# Just open ui/index.html in your browser
# Or use a local server:
cd ui
npx serve .
# Open http://localhost:3000
```

**On Raspberry Pi** (planned):
```bash
# Install dependencies
npm install

# Start server
npm start
# Opens Chromium in kiosk mode automatically
```

## Version

- **Prop Version**: 1.0.0
- **MQTT Contract**: v1.0 (same as other props)
- **UI**: Vanilla HTML/CSS/JS (no framework)

## Key Design Decisions

1. **Web UI instead of native**: Easier to develop and iterate (HTML/CSS/JS vs C++/LVGL)
2. **Raspberry Pi instead of ESP32**: Enables web-based UI via Chromium + HDMI display
3. **HDMI + USB touch**: Plug-and-play, no custom display drivers
4. **Same MQTT contract**: Integrates with existing Room Controller without changes
5. **Vanilla JS**: No build step, runs directly in browser, matches project convention (no TypeScript)
