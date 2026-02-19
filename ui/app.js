// =====================
// Cryptex Prop - UI Logic
// =====================
// Target: Raspberry Pi + 7" HDMI Touch (1024×600)
// Correct code: 1234 (configurable below)
// Swipe up = increment, swipe down = decrement

const CORRECT_CODE = [1, 2, 3, 4];
const SWIPE_THRESHOLD = 15; // px minimum swipe distance
const ANIMATION_DURATION = 200; // ms, matches CSS transition

// =====================
// State
// =====================
const state = {
  values: [0, 0, 0, 0],
  solved: false,
  animating: [false, false, false, false],
  animTimers: [null, null, null, null],
};

// =====================
// DOM References
// =====================
const columns = document.querySelectorAll('.column');
const solvedOverlay = document.getElementById('solved-overlay');

// =====================
// Number Display
// =====================
function getDisplayNumbers(value) {
  const prev = (value - 1 + 10) % 10;
  const next = (value + 1) % 10;
  return { prev, current: value, next };
}

function updateColumnDisplay(colIndex) {
  const col = columns[colIndex];
  const wrapper = col.querySelector('.number-wrapper');
  const nums = getDisplayNumbers(state.values[colIndex]);
  const children = wrapper.querySelectorAll('.number');

  children[0].textContent = nums.prev;
  children[1].textContent = nums.current;
  children[2].textContent = nums.next;

  // Reset transform
  wrapper.style.transition = 'none';
  wrapper.classList.remove('slide-up', 'slide-down');
  // Force reflow
  wrapper.offsetHeight;
  wrapper.style.transition = '';
}

// =====================
// Value Change (with rotation animation)
// =====================
function changeValue(colIndex, direction) {
  if (state.solved) return;

  // If already animating, interrupt: cancel timer and snap to current state
  if (state.animating[colIndex]) {
    clearTimeout(state.animTimers[colIndex]);
    updateColumnDisplay(colIndex);
  }

  state.animating[colIndex] = true;
  const col = columns[colIndex];
  const wrapper = col.querySelector('.number-wrapper');

  // Show current values before animating
  const nums = getDisplayNumbers(state.values[colIndex]);
  const children = wrapper.querySelectorAll('.number');
  children[0].textContent = nums.prev;
  children[1].textContent = nums.current;
  children[2].textContent = nums.next;

  // Start rotation animation
  wrapper.classList.add(direction === 'up' ? 'slide-up' : 'slide-down');

  // Update state immediately (don't wait for animation)
  state.values[colIndex] = direction === 'up'
    ? (state.values[colIndex] + 1) % 10
    : (state.values[colIndex] - 1 + 10) % 10;
  checkSolved();

  // After animation, update display to match new state
  state.animTimers[colIndex] = setTimeout(() => {
    updateColumnDisplay(colIndex);
    state.animating[colIndex] = false;
  }, ANIMATION_DURATION);
}

// =====================
// Solve Detection
// =====================
function checkSolved() {
  if (state.solved) return;

  const match = state.values.every((val, i) => val === CORRECT_CODE[i]);
  if (match) {
    state.solved = true;
    onSolved();
  }
}

function onSolved() {
  // Flash columns green one by one
  columns.forEach((col, i) => {
    setTimeout(() => {
      col.classList.add('solved');
    }, i * 200);
  });

  // Show overlay after columns flash
  setTimeout(() => {
    solvedOverlay.classList.add('visible');
  }, columns.length * 200 + 400);

  // Notify controller (maglock + MQTT)
  sendToController({ type: 'solved' });
  console.log('[Cryptex] SOLVED! Code:', state.values.join(''));
}

// =====================
// Force Solve (triggered by GM via controller)
// =====================
function forceSolve() {
  if (state.solved) return;
  state.values = [...CORRECT_CODE];
  columns.forEach((_, i) => updateColumnDisplay(i));
  state.solved = true;
  onSolved();
}

// =====================
// Reset (called by GM via MQTT)
// =====================
function resetCryptex() {
  state.solved = false;
  state.values = [0, 0, 0, 0];

  solvedOverlay.classList.remove('visible');

  columns.forEach((col, i) => {
    col.classList.remove('solved');
    updateColumnDisplay(i);
  });

  console.log('[Cryptex] RESET');
}

// Expose for external calls (MQTT handler, devtools)
window.resetCryptex = resetCryptex;

// =====================
// Touch / Mouse Handling
// =====================
columns.forEach((col, index) => {
  let startY = 0;
  let isDragging = false;

  // --- Touch Events ---
  col.addEventListener('touchstart', (e) => {
    if (state.solved) return;
    startY = e.touches[0].clientY;
    isDragging = true;
    col.classList.add('touching');
  }, { passive: true });

  col.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDragging || state.solved) return;

    const currentY = e.touches[0].clientY;
    const deltaY = startY - currentY;

    // Trigger as soon as threshold is crossed (don't wait for finger lift)
    if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
      startY = currentY; // reset anchor so continued drag triggers next change
      if (deltaY > 0) {
        changeValue(index, 'up');
      } else {
        changeValue(index, 'down');
      }
    }
  }, { passive: false });

  col.addEventListener('touchend', () => {
    isDragging = false;
    col.classList.remove('touching');
  }, { passive: true });

  // --- Mouse Events (for desktop testing) ---
  col.addEventListener('mousedown', (e) => {
    if (state.solved) return;
    startY = e.clientY;
    isDragging = true;
    col.classList.add('touching');
    e.preventDefault();
  });

  col.addEventListener('mousemove', (e) => {
    if (!isDragging || state.solved) return;

    const deltaY = startY - e.clientY;

    if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
      startY = e.clientY;
      if (deltaY > 0) {
        changeValue(index, 'up');
      } else {
        changeValue(index, 'down');
      }
    }
  });

  col.addEventListener('mouseup', () => {
    isDragging = false;
    col.classList.remove('touching');
  });

  col.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      col.classList.remove('touching');
    }
  });

  // --- Scroll Wheel ---
  col.addEventListener('wheel', (e) => {
    if (state.solved) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      changeValue(index, 'up');
    } else {
      changeValue(index, 'down');
    }
  }, { passive: false });
});

// =====================
// Keyboard (for desktop testing)
// =====================
let selectedColumn = 0;

document.addEventListener('keydown', (e) => {
  if (state.solved && e.key !== 'r') return;

  if (e.key >= '1' && e.key <= '4') {
    selectedColumn = parseInt(e.key) - 1;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    changeValue(selectedColumn, 'up');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    changeValue(selectedColumn, 'down');
  } else if (e.key === 'r') {
    resetCryptex();
  }
});

// =====================
// Controller WebSocket
// =====================
const WS_URL = 'ws://localhost:9000';
let ws = null;
let wsReconnectTimer = null;

function connectController() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[WS] Connected to controller');
    if (wsReconnectTimer) {
      clearInterval(wsReconnectTimer);
      wsReconnectTimer = null;
    }
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    switch (msg.type) {
      case 'reset':
        resetCryptex();
        break;
      case 'force_solve':
        forceSolve();
        break;
      case 'state':
        // Sync state on reconnect
        if (msg.solved && !state.solved) forceSolve();
        if (!msg.solved && state.solved) resetCryptex();
        break;
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected from controller');
    ws = null;
    if (!wsReconnectTimer) {
      wsReconnectTimer = setInterval(connectController, 3000);
    }
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function sendToController(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// =====================
// Init
// =====================
columns.forEach((_, i) => updateColumnDisplay(i));
connectController();
console.log('[Cryptex] Ready. Code:', CORRECT_CODE.join(''));
console.log('[Cryptex] Controls: Swipe/drag up/down on columns, scroll wheel, or keys 1-4 + Arrow Up/Down. R to reset.');
