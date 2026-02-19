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
  if (state.solved || state.animating[colIndex]) return;

  state.animating[colIndex] = true;
  const col = columns[colIndex];
  const wrapper = col.querySelector('.number-wrapper');

  if (direction === 'up') {
    const nextValue = (state.values[colIndex] + 1) % 10;

    const nums = getDisplayNumbers(state.values[colIndex]);
    const children = wrapper.querySelectorAll('.number');
    children[0].textContent = nums.prev;
    children[1].textContent = nums.current;
    children[2].textContent = nums.next;

    wrapper.classList.add('slide-up');

    setTimeout(() => {
      state.values[colIndex] = nextValue;
      updateColumnDisplay(colIndex);
      state.animating[colIndex] = false;
      checkSolved();
    }, ANIMATION_DURATION);

  } else {
    const prevValue = (state.values[colIndex] - 1 + 10) % 10;

    const nums = getDisplayNumbers(state.values[colIndex]);
    const children = wrapper.querySelectorAll('.number');
    children[0].textContent = nums.prev;
    children[1].textContent = nums.current;
    children[2].textContent = nums.next;

    wrapper.classList.add('slide-down');

    setTimeout(() => {
      state.values[colIndex] = prevValue;
      updateColumnDisplay(colIndex);
      state.animating[colIndex] = false;
      checkSolved();
    }, ANIMATION_DURATION);
  }
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
    if (Math.abs(deltaY) >= SWIPE_THRESHOLD && !state.animating[index]) {
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

    if (Math.abs(deltaY) >= SWIPE_THRESHOLD && !state.animating[index]) {
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
// Init
// =====================
columns.forEach((_, i) => updateColumnDisplay(i));
console.log('[Cryptex] Ready. Code:', CORRECT_CODE.join(''));
console.log('[Cryptex] Controls: Swipe/drag up/down on columns, scroll wheel, or keys 1-4 + Arrow Up/Down. R to reset.');
