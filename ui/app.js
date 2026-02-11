// =====================
// Cryptex Prop - UI Logic
// =====================
// Target: Raspberry Pi + 7" HDMI Touch (1024×600)
// Correct code: 1234 (configurable below)
// Swipe up = increment, swipe down = decrement

const CORRECT_CODE = [1, 2, 3, 4];
const SWIPE_THRESHOLD = 30; // px minimum swipe distance
const ANIMATION_DURATION = 250; // ms, matches CSS transition

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
// Value Change (with animation)
// =====================
function changeValue(colIndex, direction) {
  if (state.solved || state.animating[colIndex]) return;

  state.animating[colIndex] = true;
  const col = columns[colIndex];
  const wrapper = col.querySelector('.number-wrapper');

  if (direction === 'up') {
    // Increment: slide numbers up (show next)
    const nextValue = (state.values[colIndex] + 1) % 10;

    // Update display to show correct prev/next before animating
    const nums = getDisplayNumbers(state.values[colIndex]);
    const children = wrapper.querySelectorAll('.number');
    children[0].textContent = nums.prev;
    children[1].textContent = nums.current;
    children[2].textContent = nums.next;

    // Animate
    wrapper.classList.add('slide-up');

    setTimeout(() => {
      state.values[colIndex] = nextValue;
      updateColumnDisplay(colIndex);
      state.animating[colIndex] = false;
      checkSolved();
    }, ANIMATION_DURATION);

  } else {
    // Decrement: slide numbers down (show prev)
    const prevValue = (state.values[colIndex] - 1 + 10) % 10;

    const nums = getDisplayNumbers(state.values[colIndex]);
    const children = wrapper.querySelectorAll('.number');
    children[0].textContent = nums.prev;
    children[1].textContent = nums.current;
    children[2].textContent = nums.next;

    // Animate
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
// Touch Handling
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
    // Prevent page scroll
    e.preventDefault();
  }, { passive: false });

  col.addEventListener('touchend', (e) => {
    if (!isDragging || state.solved) return;
    isDragging = false;
    col.classList.remove('touching');

    const endY = e.changedTouches[0].clientY;
    const deltaY = startY - endY;

    if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
      if (deltaY > 0) {
        // Swiped up → increment
        changeValue(index, 'up');
      } else {
        // Swiped down → decrement
        changeValue(index, 'down');
      }
    }
  }, { passive: true });

  // --- Mouse Events (for desktop testing) ---
  col.addEventListener('mousedown', (e) => {
    if (state.solved) return;
    startY = e.clientY;
    isDragging = true;
    col.classList.add('touching');
    e.preventDefault();
  });

  col.addEventListener('mouseup', (e) => {
    if (!isDragging || state.solved) return;
    isDragging = false;
    col.classList.remove('touching');

    const deltaY = startY - e.clientY;
    if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
      if (deltaY > 0) {
        changeValue(index, 'up');
      } else {
        changeValue(index, 'down');
      }
    }
  });

  col.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      col.classList.remove('touching');
    }
  });

  // --- Scroll Wheel (bonus: for desktop testing) ---
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
// Keys 1-4 select column, Up/Down change value
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
