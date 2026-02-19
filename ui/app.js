// =====================
// Cryptex Prop - UI Logic
// =====================
// Target: Raspberry Pi + 7" HDMI Touch (1024×600)
// Correct code: 1234 (configurable below)
// Swipe up = increment, swipe down = decrement

const CORRECT_CODE = [1, 2, 3, 4];
const ANIMATION_DURATION = 150; // ms, matches CSS transition
const DRAG_COMMIT_RATIO = 0.25; // fraction of cell height to commit during drag

// =====================
// State
// =====================
const state = {
  values: [0, 0, 0, 0],
  solved: false,
  animating: [false, false, false, false],
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
// Value Change (keyboard/wheel animation)
// =====================
function changeValue(colIndex, direction) {
  if (state.solved || state.animating[colIndex]) return;

  state.animating[colIndex] = true;
  const col = columns[colIndex];
  const wrapper = col.querySelector('.number-wrapper');

  const nums = getDisplayNumbers(state.values[colIndex]);
  const children = wrapper.querySelectorAll('.number');
  children[0].textContent = nums.prev;
  children[1].textContent = nums.current;
  children[2].textContent = nums.next;

  wrapper.classList.add(direction === 'up' ? 'slide-up' : 'slide-down');

  setTimeout(() => {
    state.values[colIndex] = direction === 'up'
      ? (state.values[colIndex] + 1) % 10
      : (state.values[colIndex] - 1 + 10) % 10;
    updateColumnDisplay(colIndex);
    state.animating[colIndex] = false;
    checkSolved();
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

  // TODO: Send MQTT solved event
  console.log('[Cryptex] SOLVED! Code:', state.values.join(''));
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
// Drag Handling (touch + mouse)
// =====================
columns.forEach((col, index) => {
  let isDragging = false;
  let lastY = 0;

  function onDragStart(y) {
    if (state.solved) return;
    lastY = y;
    isDragging = true;
    col.classList.add('touching');

    // Disable CSS transition so wrapper follows finger instantly
    const wrapper = col.querySelector('.number-wrapper');
    wrapper.classList.remove('slide-up', 'slide-down');
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'translateY(0)';
  }

  function onDragMove(y) {
    if (!isDragging || state.solved) return;

    const delta = lastY - y; // positive = dragging up
    const wrapper = col.querySelector('.number-wrapper');
    const colHeight = col.offsetHeight;
    const cellHeight = colHeight / 3;
    const commitThreshold = cellHeight * DRAG_COMMIT_RATIO;

    if (Math.abs(delta) >= commitThreshold) {
      // Commit number change
      if (delta > 0) {
        state.values[index] = (state.values[index] + 1) % 10;
      } else {
        state.values[index] = (state.values[index] - 1 + 10) % 10;
      }

      // Update display and snap wrapper back to center
      const nums = getDisplayNumbers(state.values[index]);
      const children = wrapper.querySelectorAll('.number');
      children[0].textContent = nums.prev;
      children[1].textContent = nums.current;
      children[2].textContent = nums.next;

      wrapper.style.transform = 'translateY(0)';
      lastY = y;
      checkSolved();
    } else {
      // Live drag: wrapper follows finger
      const pct = -(delta / colHeight) * 100;
      wrapper.style.transform = `translateY(${pct}%)`;
    }
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    col.classList.remove('touching');

    // Snap back to center with short animation
    const wrapper = col.querySelector('.number-wrapper');
    wrapper.style.transition = `transform ${ANIMATION_DURATION}ms cubic-bezier(0.22, 0.68, 0.35, 1.2)`;
    wrapper.style.transform = 'translateY(0)';
    setTimeout(() => {
      wrapper.style.transition = '';
      wrapper.style.transform = '';
    }, ANIMATION_DURATION);
  }

  // --- Touch Events ---
  col.addEventListener('touchstart', (e) => {
    onDragStart(e.touches[0].clientY);
  }, { passive: true });

  col.addEventListener('touchmove', (e) => {
    e.preventDefault();
    onDragMove(e.touches[0].clientY);
  }, { passive: false });

  col.addEventListener('touchend', () => onDragEnd(), { passive: true });

  // --- Mouse Events (for desktop testing) ---
  col.addEventListener('mousedown', (e) => {
    onDragStart(e.clientY);
    e.preventDefault();
  });

  col.addEventListener('mousemove', (e) => onDragMove(e.clientY));
  col.addEventListener('mouseup', () => onDragEnd());
  col.addEventListener('mouseleave', () => {
    if (isDragging) onDragEnd();
  });

  // --- Scroll Wheel ---
  col.addEventListener('wheel', (e) => {
    if (state.solved) return;
    e.preventDefault();
    changeValue(index, e.deltaY < 0 ? 'up' : 'down');
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
// Init
// =====================
columns.forEach((_, i) => updateColumnDisplay(i));
console.log('[Cryptex] Ready. Code:', CORRECT_CODE.join(''));
console.log('[Cryptex] Controls: Swipe/drag up/down on columns, scroll wheel, or keys 1-4 + Arrow Up/Down. R to reset.');
