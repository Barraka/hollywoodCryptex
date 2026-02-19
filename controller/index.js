// =====================
// Cryptex Controller
// =====================
// Runs on Raspberry Pi. Bridges:
//   Browser UI ←(local WS)→ Controller ←(MQTT)→ Room Controller
//   Controller → GPIO → MOSFET → Maglock
//
// GPIO uses system `gpioset` (gpiod v2) — no native npm deps.

import { spawn } from 'child_process';
import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';

// =====================
// Configuration
// =====================
const CONFIG = {
  propId: 'hollywood_cryptex',
  propName: 'Cryptex',
  site: 'ey1',
  room: 'hollywood',
  mqttBroker: process.env.MQTT_BROKER || 'mqtt://192.168.1.99:1883',
  gpioChip: 'gpiochip0',
  gpioLine: 17,
  wsPort: 9000,
};

const TOPIC_BASE = `ey/${CONFIG.site}/${CONFIG.room}/prop/${CONFIG.propId}`;
const TOPICS = {
  status: `${TOPIC_BASE}/status`,
  event: `${TOPIC_BASE}/event`,
  cmd: `${TOPIC_BASE}/cmd`,
  broadcastCmd: `ey/${CONFIG.site}/${CONFIG.room}/all/cmd`,
};

// =====================
// State
// =====================
let solved = false;
let override = false;

// =====================
// GPIO (maglock via gpioset)
// =====================
let gpioProcess = null;

function setMaglock(locked) {
  if (gpioProcess) {
    gpioProcess.kill();
    gpioProcess = null;
  }

  const value = locked ? '1' : '0';
  gpioProcess = spawn('gpioset', ['-c', CONFIG.gpioChip, `${CONFIG.gpioLine}=${value}`], {
    stdio: 'ignore',
  });

  gpioProcess.on('error', (err) => {
    console.error('[GPIO] Error:', err.message);
    console.error('[GPIO] Is gpiod installed? Try: sudo apt install gpiod');
  });

  console.log(`[Maglock] ${locked ? 'LOCKED' : 'UNLOCKED'}`);
}

// =====================
// MQTT
// =====================
function buildStatus() {
  return JSON.stringify({
    type: 'status',
    propId: CONFIG.propId,
    name: CONFIG.propName,
    online: true,
    solved,
    override,
    timestamp: Date.now(),
    lastChangeSource: override ? 'gm' : (solved ? 'player' : 'system'),
  });
}

function buildOfflineStatus() {
  return JSON.stringify({
    type: 'status',
    propId: CONFIG.propId,
    name: CONFIG.propName,
    online: false,
    solved: false,
    override: false,
    timestamp: Date.now(),
  });
}

function buildEvent(action, source) {
  return JSON.stringify({
    type: 'event',
    propId: CONFIG.propId,
    action,
    source,
    timestamp: Date.now(),
  });
}

const mqttClient = mqtt.connect(CONFIG.mqttBroker, {
  clientId: `cryptex-${Date.now()}`,
  will: {
    topic: TOPICS.status,
    payload: buildOfflineStatus(),
    retain: true,
    qos: 1,
  },
  reconnectPeriod: 5000,
});

mqttClient.on('connect', () => {
  console.log(`[MQTT] Connected to ${CONFIG.mqttBroker}`);

  // Subscribe to commands
  mqttClient.subscribe([TOPICS.cmd, TOPICS.broadcastCmd], (err) => {
    if (err) console.error('[MQTT] Subscribe error:', err.message);
    else console.log('[MQTT] Subscribed to commands');
  });

  // Publish online status
  publishStatus();
});

mqttClient.on('reconnect', () => {
  console.log('[MQTT] Reconnecting...');
});

mqttClient.on('error', (err) => {
  console.error('[MQTT] Error:', err.message);
});

mqttClient.on('message', (topic, payload) => {
  let msg;
  try {
    msg = JSON.parse(payload.toString());
  } catch {
    return;
  }

  if (msg.type !== 'cmd') return;

  // Ignore commands meant for other props (broadcast topic)
  if (msg.propId && msg.propId !== CONFIG.propId) return;

  console.log(`[MQTT] Command: ${msg.command}`, msg.params || '');

  switch (msg.command) {
    case 'force_solved':
      handleForceSolve();
      break;
    case 'reset':
      handleReset();
      break;
    default:
      console.log(`[MQTT] Unknown command: ${msg.command}`);
  }
});

function publishStatus() {
  mqttClient.publish(TOPICS.status, buildStatus(), { retain: true, qos: 1 });
}

function publishEvent(action, source) {
  mqttClient.publish(TOPICS.event, buildEvent(action, source), { retain: false });
}

// =====================
// Local WebSocket (browser UI ↔ controller)
// =====================
const wss = new WebSocketServer({ port: CONFIG.wsPort });
let uiSocket = null;

wss.on('listening', () => {
  console.log(`[WS] Local server on ws://localhost:${CONFIG.wsPort}`);
});

wss.on('connection', (ws) => {
  console.log('[WS] Browser UI connected');
  uiSocket = ws;

  // Send current state so UI can sync
  ws.send(JSON.stringify({ type: 'state', solved, override }));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === 'solved') {
      handlePlayerSolved();
    }
  });

  ws.on('close', () => {
    console.log('[WS] Browser UI disconnected');
    if (uiSocket === ws) uiSocket = null;
  });
});

function sendToUI(msg) {
  if (uiSocket && uiSocket.readyState === 1) {
    uiSocket.send(JSON.stringify(msg));
  }
}

// =====================
// Actions
// =====================
function handlePlayerSolved() {
  if (solved) return;
  console.log('[Cryptex] SOLVED by player');
  solved = true;
  override = false;
  setMaglock(false);
  publishStatus();
  publishEvent('solved', 'player');
}

function handleForceSolve() {
  if (solved) return;
  console.log('[Cryptex] FORCE SOLVED by GM');
  solved = true;
  override = true;
  setMaglock(false);
  publishStatus();
  publishEvent('force_solved', 'gm');
  sendToUI({ type: 'force_solve' });
}

function handleReset() {
  console.log('[Cryptex] RESET');
  solved = false;
  override = false;
  setMaglock(true);
  publishStatus();
  publishEvent('reset', 'system');
  sendToUI({ type: 'reset' });
}

// =====================
// Startup
// =====================
console.log('[Cryptex Controller] Starting...');
console.log(`[Config] Prop: ${CONFIG.propId}, MQTT: ${CONFIG.mqttBroker}`);
console.log(`[Config] GPIO: ${CONFIG.gpioChip} line ${CONFIG.gpioLine}, WS: port ${CONFIG.wsPort}`);

// Lock maglock on startup
setMaglock(true);

// =====================
// Cleanup
// =====================
function cleanup() {
  console.log('[Cryptex Controller] Shutting down...');
  if (gpioProcess) {
    gpioProcess.kill();
    gpioProcess = null;
  }
  mqttClient.end();
  wss.close();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
