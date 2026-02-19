# Hollywood Cryptex Prop

## Overview

Touchscreen-based escape room prop for the **Hollywood** room at Escape Yourself. Players swipe 4 colored number columns to find the correct combination. When solved, a maglock releases a trap door.

## Architecture

The **Room Controller** is the backend (source of truth). The Cryptex Pi is a display + input device + maglock actuator.

```
ELECROW 7" HDMI Touch Display (1024×600, IPS, capacitive)
    │ HDMI (video)
    │ USB (touch input)
    ▼
Raspberry Pi 4B (192.168.1.207, user: escape)
    ├── Chromium (kiosk mode, fullscreen)
    │   └── Cryptex Web UI (served on localhost:8080)
    │       └── Connects to controller via ws://localhost:9000
    ├── controller/index.js (Node.js)
    │   ├── Local WebSocket server (port 9000) ↔ browser UI
    │   ├── MQTT client → Room Controller broker (192.168.1.99:1883)
    │   └── GPIO 17 → gpioset → MOSFET → 12V maglock
    └── WiFi → MQTT Broker (on Room Controller MiniPC)

Room Controller (MiniPC, 192.168.1.99) ← SOURCE OF TRUTH / BACKEND
    ├── MQTT broker (Mosquitto, port 1883)
    ├── State management (props, session)
    ├── WebSocket server → GM Dashboard
    └── Handles force_solve / reset commands
```

## Project Structure

```
Cryptex/
├── claude.md              # This file
├── Explanations.txt       # Original prop concept
├── SHOPPING_LIST.md       # Hardware parts list & costs
├── ecosystem.config.cjs   # pm2 process config
├── start.sh               # Manual startup script (legacy)
├── start-kiosk.sh         # Chromium kiosk launcher
├── controller/            # Node.js controller (runs on Pi)
│   ├── package.json       # Dependencies: mqtt, ws
│   └── index.js           # MQTT bridge + GPIO + local WS server
└── ui/                    # Web UI (runs in Chromium on Pi)
    ├── package.json       # Dependencies: serve
    ├── index.html         # Main page (4 colored columns)
    ├── style.css          # Dark theme, column colors, animations
    └── app.js             # Touch/swipe logic, solve detection, WS client
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
const SWIPE_THRESHOLD = 15;           // px minimum swipe distance
const ANIMATION_DURATION = 200;       // ms slide animation
```

Controller config at the top of `controller/index.js`:

```javascript
const CONFIG = {
  propId: 'hollywood_cryptex',
  propName: 'Cryptex',
  site: 'ey1',
  room: 'hollywood',
  mqttBroker: 'mqtt://192.168.1.99:1883',
  gpioChip: 'gpiochip0',
  gpioLine: 17,           // Physical pin 11
  wsPort: 9000,
};
```

Column colors are set via `data-color` attributes in `index.html`:
- Column 1: `blue`
- Column 2: `red`
- Column 3: `green`
- Column 4: `yellow`

## Controls (Desktop Testing)

| Input | Action |
|-------|--------|
| Mouse drag up/down | Change number on column |
| Scroll wheel | Change number on column |
| Keys 1-4 + Arrow Up/Down | Select column + change value |
| R key | Reset all columns to 0 |
| `window.resetCryptex()` | Reset from browser console |

## MQTT Integration

Follows the MQTT Contract v1.0.

**Topics**: `ey/ey1/hollywood/prop/hollywood_cryptex/{status|event|cmd}`

**Status message** (published on state change, retained):
```json
{
  "type": "status",
  "propId": "hollywood_cryptex",
  "name": "Cryptex",
  "online": true,
  "solved": true,
  "override": false,
  "timestamp": 1739980000000,
  "lastChangeSource": "player"
}
```

**Commands** (received from Room Controller):
- `force_solved` → Set correct code + trigger solve animation + open maglock
- `reset` → Reset all columns to 0 + lock maglock

**LWT**: Publishes offline status (retained) on unexpected disconnect.

## Hardware

See `SHOPPING_LIST.md` for full parts list.

**Summary**:
- **Controller**: Raspberry Pi 4B
- **Display**: ELECROW 7" HDMI Capacitive Touch (1024×600)
- **Actuator**: 12V DC maglock via MOSFET on GPIO 17 (physical pin 11)
- **Power**: 12V PSU + 5V buck converter

**Wiring**:
```
Pi GPIO 17 (pin 11) → MOSFET SIG (gate)
Pi 3.3V (pin 1)     → MOSFET VCC
Pi GND (pin 6)      → MOSFET GND ← 12V PSU (-)   [shared ground]
12V PSU (+)          → MOSFET V+/V- → Maglock
Flyback diode (1N4007) across maglock terminals (band toward +)
```

## Deployment (Raspberry Pi)

**OS**: Debian 13 (Trixie), Node.js v20

**Services managed by pm2** (auto-start on boot):
- `cryptex-controller` — MQTT + GPIO + local WS (port 9000)
- `cryptex-serve` — Static file server for UI (port 8080)

**Chromium kiosk** auto-starts via `~/.config/autostart/cryptex-kiosk.desktop`

**Useful commands** (via SSH):
```bash
# View process status
pm2 list

# View controller logs
pm2 logs cryptex-controller

# Restart everything
pm2 restart all
pkill chromium; DISPLAY=:0 chromium --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:8080 &

# Full reboot (everything auto-starts)
sudo reboot
```

**SSH access**:
```bash
ssh escape@192.168.1.207   # Passwordless (ed25519 key)
```

## Development

**Local testing** (no hardware needed):
```bash
# Just open ui/index.html in your browser
# Or use a local server:
cd ui
npx serve . -l 8080
# Open http://localhost:8080
# WS connection to controller will fail silently — UI still works standalone
```

## Version

- **Prop Version**: 1.3.0
- **MQTT Contract**: v1.0 (same as other props)
- **UI**: Vanilla HTML/CSS/JS (no framework)

### v1.3.0 — Controller + GPIO + MQTT Integration
- Added `controller/index.js`: bridges browser UI, MQTT, and GPIO
- GPIO via system `gpioset` (gpiod v2) — no native npm dependencies
- Browser UI connects to controller via local WebSocket (port 9000)
- Handles player solve → maglock release → MQTT status publish
- Handles GM force_solve and reset via MQTT commands
- pm2 process management with auto-start on boot
- Chromium kiosk auto-starts via desktop autostart entry

### v1.2.1 — UX Improvements
- Increased prev/next number opacity (0.12 → 0.3) for better visibility
- Swipe triggers on touchmove (mid-drag) instead of touchend
- Continuous scrolling: keep dragging for multiple number changes
- Animation duration tuned to 200ms

### v1.2.0 — Full-screen UI Overhaul
- Full-screen layout: columns stretch edge-to-edge, no padding/border-radius
- Monospace font (Courier New) for code/lock aesthetic
- Metallic groove separators between columns
- Edge fades (top/bottom) for depth
- Subtle ambient breathing pulse on each column (staggered)
- Brighter touch glow with triple-layer shadow
- Wheel-like number animation: numbers morph in size/opacity during slide
- Vignette overlay for cinematic feel
- Brighter solved state (#2aff6a) with scale-in bounce
- Swipe threshold lowered to 15px for touchscreen responsiveness

### v1.1.0 — Audit Bug Fix Pass
- Removed 4 dead `document.addEventListener('mousemove')` listeners that were created inside a per-column `forEach` loop and never removed (memory leak)

## Key Design Decisions

1. **Web UI instead of native**: Easier to develop and iterate (HTML/CSS/JS vs C++/LVGL)
2. **Raspberry Pi 4B**: Enables web-based UI via Chromium + HDMI display, plenty of GPIO
3. **HDMI + USB touch**: Plug-and-play, no custom display drivers
4. **Same MQTT contract**: Integrates with existing Room Controller without changes
5. **Vanilla JS**: No build step, runs directly in browser, matches project convention (no TypeScript)
6. **GPIO via gpioset**: Uses system gpiod tools, avoids native npm compilation issues on Debian Trixie
7. **Local WebSocket bridge**: Browser UI ↔ controller communication without requiring MQTT WebSocket support on the broker
8. **pm2 for process management**: Auto-restart on crash, auto-start on boot, log management
