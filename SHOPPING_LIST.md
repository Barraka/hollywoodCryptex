# Cryptex Prop - Shopping List

## Overview

Hardware needed to build the Cryptex prop: a touchscreen with 4 colored number columns that controls a maglock via a Raspberry Pi.

**Architecture**: Raspberry Pi + HDMI Touch Display + MQTT → Room Controller

---

## Components

### 1. Display (DECIDED)

| Item | Spec | Qty | Est. Price | Source |
|------|------|-----|-----------|--------|
| **ELECROW 7" HDMI Capacitive Touch** | 1024×600, IPS, 5-point capacitive, 170° viewing angle, plug-and-play | 1 | ~€55-65 | Amazon.fr |

**Key features**:
- HDMI for video + USB for touch (no drivers needed)
- Compatible with Pi Zero, Pi 3, Pi 4
- 4 mounting holes on corners (perfect for embedding in prop housing)
- Backlight adjustment + screen rotation
- Brass standoffs included for Pi mounting

---

### 2. Controller

| Item | Spec | Qty | Est. Price | Notes |
|------|------|-----|-----------|-------|
| **Raspberry Pi Zero 2W** | Quad-core, WiFi, Bluetooth | 1 | ~€18 | Budget option. Compact (65mm × 30mm). Confirmed compatible with ELECROW 7" display. |
| **OR** Raspberry Pi 4B (2GB) | Quad-core, WiFi, 2× micro HDMI, Ethernet | 1 | ~€45 | Easier for development (more USB ports, Ethernet for SSH). |
| MicroSD card (32GB) | Class 10 / A1 minimum | 1 | ~€8 | For Raspberry Pi OS. |

**Recommendation**: Start with Pi 4B for development, consider Pi Zero 2W for production if size matters.

---

### 3. Cables & Adapters

| Item | Spec | Qty | Est. Price | Notes |
|------|------|-----|-----------|-------|
| Micro HDMI → HDMI adapter | For Pi Zero 2W or Pi 4B | 1 | ~€5 | Both Pi Zero 2W and Pi 4B use micro HDMI. Check if included with display. |
| Micro USB OTG adapter | For Pi Zero 2W only | 1 | ~€3 | Needed to connect USB touch cable on Pi Zero. Pi 4B has USB-A ports. |
| HDMI cable (short, 30cm) | Standard HDMI | 1 | ~€5 | Short cable for clean wiring. Check if included with display. |
| USB cable (short, 30cm) | USB-A to Micro USB | 1 | ~€3 | For touch input from display. Check if included. |

---

### 4. Maglock & Control

| Item | Spec | Qty | Est. Price | Notes |
|------|------|-----|-----------|-------|
| 12V DC Electromagnetic Lock | 60kg+ holding force | 1 | ~€10-15 | Standard escape room maglock. Fail-secure (locks when powered). |
| MOSFET module (IRF520 or IRLZ44N) | Logic-level, 12V capable | 1 | ~€2 | Controls maglock from Pi GPIO (3.3V → 12V switching). |
| Flyback diode (1N4007) | Protects MOSFET from back-EMF | 1 | ~€0.50 | Solder across maglock terminals. Critical for protection. |
| Dupont jumper wires (F-F) | 20cm, assorted | 10 | ~€2 | GPIO connections between Pi and MOSFET. |

---

### 5. Power

| Item | Spec | Qty | Est. Price | Notes |
|------|------|-----|-----------|-------|
| 12V DC Power Supply | 2A minimum (for maglock) | 1 | ~€8 | Or tap from room's existing 12V distribution block. |
| 12V → 5V Buck Converter | 3A output (for Pi + display) | 1 | ~€3 | Converts 12V room power to 5V for Pi. |
| USB-C cable (short) | For Pi 4B power input | 1 | ~€3 | Or micro USB for Pi Zero 2W. |

**Alternative**: If a USB power outlet is available near the prop, skip the buck converter and power the Pi with a standard USB-C charger (~€10).

---

## Cost Summary

### Option A: Budget (Pi Zero 2W)

| Category | Cost |
|----------|------|
| Raspberry Pi Zero 2W | €18 |
| MicroSD 32GB | €8 |
| ELECROW 7" Touch Display | €60 |
| Adapters (micro HDMI + USB OTG) | €8 |
| Maglock + MOSFET + diode | €15 |
| Power (12V PSU + buck converter) | €11 |
| Cables & wires | €5 |
| **Total** | **~€125** |

### Option B: Comfortable (Pi 4B)

| Category | Cost |
|----------|------|
| Raspberry Pi 4B (2GB) | €45 |
| MicroSD 32GB | €8 |
| ELECROW 7" Touch Display | €60 |
| Adapter (micro HDMI) | €5 |
| Maglock + MOSFET + diode | €15 |
| Power (12V PSU + buck converter) | €11 |
| Cables & wires | €5 |
| **Total** | **~€149** |

---

## Architecture Diagram

```
┌──────────────────────────────────────────┐
│          ELECROW 7" Touch Display        │
│          1024×600 IPS Capacitive         │
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │  3   │ │  7   │ │  1   │ │  9   │   │  ← Players swipe
│  │ Blue │ │ Red  │ │Green │ │Yellow│   │     up/down
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                          │
└─────┬──────────────┬─────────────────────┘
      │ HDMI         │ USB (touch)
      └──────┬───────┘
             ▼
    ┌─────────────────┐
    │  Raspberry Pi   │
    │  (Zero 2W / 4B) │
    │                 │
    │  Chromium Kiosk │ ← Web UI (HTML/CSS/JS)
    │  MQTT client    │ ← Connects to Room Controller (backend)
    │  GPIO 17 ───────┼──→ MOSFET → 12V Maglock
    │                 │
    │  WiFi ──────────┼──→ MQTT Broker (Room Controller)
    └─────────────────┘
             │
             ▼ MQTT
    ┌─────────────────┐
    │ Room Controller  │ ← Source of truth
    │ (MiniPC)        │
    └─────────────────┘
```

---

## Software Stack (On Pi)

The Room Controller (MiniPC) is the backend. The Pi does NOT run its own server.

```
Raspberry Pi OS Lite (headless)
├── Chromium (kiosk mode, fullscreen)
│   └── Cryptex Web UI (file:// or simple local serve)
│       ├── index.html (4 colored columns)
│       ├── style.css (swipe animations)
│       └── app.js (touch handling, solve logic)
├── Lightweight MQTT client (Node.js script)
│   ├── Connects to Room Controller's MQTT broker
│   └── Relays solved/reset between UI and Room Controller
├── GPIO control (maglock via onoff or pigpio)
└── Auto-start on boot (systemd service)
```

---

## Tools Needed (Not Purchased)

- [ ] Soldering iron (for MOSFET + diode wiring)
- [ ] Wire strippers
- [ ] Multimeter (for testing voltages)
- [ ] MicroSD card reader (for flashing Pi OS)
- [ ] Laptop with SSH client (for Pi setup)

---

## Ordering Checklist

- [ ] Order Raspberry Pi (Zero 2W or 4B)
- [ ] Order MicroSD card (32GB, Class 10)
- [ ] Order ELECROW 7" HDMI capacitive touch display
- [ ] Order micro HDMI → HDMI adapter (check if included with display)
- [ ] Order USB OTG adapter (if Pi Zero 2W)
- [ ] Order 12V maglock
- [ ] Order MOSFET module (IRF520 or similar)
- [ ] Order flyback diode (1N4007)
- [ ] Order 12V → 5V buck converter
- [ ] Order dupont jumper wires
- [ ] Order 12V power supply (if not using room distribution)

---

## Notes

- **Display**: The ELECROW 7" includes brass standoffs for mounting the Pi directly on the back of the screen.
- **Cables**: Check what's included with the display before ordering extra HDMI/USB cables.
- **Maglock**: Verify voltage (12V vs 24V) and holding force for your trap door weight.
- **Power**: If prop is near the room's 12V distribution block, tap directly instead of buying a separate PSU.
- **Spare parts**: Consider ordering 2× MOSFET modules and 2× diodes (cheap, saves time if one fails).
- **Dev tip**: You can prototype the Cryptex web UI on your PC browser before the hardware arrives.
