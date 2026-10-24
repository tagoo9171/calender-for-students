// The focus timer: 25 minutes of focus, then a 5 minute break, and so on.
// The timer keeps the time it ends at, not a countdown, so it stays right while
// the tab is in the background. It is saved so a reload doesn't lose it.

import { pad } from './time.js';

export const FOCUS_MIN = 25, BREAK_MIN = 5;
const KEY = 'daybook:timer';
const $ = id => document.getElementById(id);

export const phaseLength = phase => (phase === 'focus' ? FOCUS_MIN : BREAK_MIN) * 60000;

export const fresh = () => ({ phase: 'focus', endAt: null, left: phaseLength('focus') });

// Milliseconds left at time `now`
export const remaining = (t, now) => (t.endAt ? Math.max(0, t.endAt - now) : t.left);

export const clock = ms => {
  const s = Math.ceil(ms / 1000);
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
};

function load() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY));
    if (t && (t.phase === 'focus' || t.phase === 'break')) return t;
  } catch { /* start fresh */ }
  return fresh();
}

function save(t) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

// onFocusDone(minutes) runs when a focus session finishes,
// onBreakDone() when a break finishes.
export function createFocusTimer({ onFocusDone, onBreakDone }) {
  const dlg = $('focusDlg');
  let t = load();
  let ticker = null;

  function draw() {
    const left = remaining(t, Date.now());
    $('fcTime').textContent = clock(left);
    $('fcPhase').textContent = t.phase === 'focus' ? 'Focus' : 'Break';
    dlg.dataset.phase = t.phase;
    $('fcStart').textContent = t.endAt ? 'Pause' : left < phaseLength(t.phase) ? 'Resume' : 'Start';
    $('fcSkip').textContent = t.phase === 'focus' ? 'Skip to break' : 'Skip break';
    $('focusBtn').textContent = t.endAt || left < phaseLength(t.phase) ? '⏱ ' + clock(left) : '⏱';
    $('focusBtn').classList.toggle('running', !!t.endAt);
  }

  function nextPhase() {
    t = { phase: t.phase === 'focus' ? 'break' : 'focus', endAt: null, left: 0 };
    t.left = phaseLength(t.phase);
  }

  function tick() {
    if (t.endAt && Date.now() >= t.endAt) {
      const was = t.phase;
      nextPhase();
      // A break starts on its own; the next focus session waits for Start
      if (was === 'focus') t.endAt = Date.now() + t.left;
      else run(false);
      save(t);
      if (was === 'focus') onFocusDone(FOCUS_MIN);
      else onBreakDone();
    }
    draw();
  }

  function run(on) {
    clearInterval(ticker);
    ticker = on ? setInterval(tick, 1000) : null;
  }

  $('fcStart').addEventListener('click', () => {
    if (t.endAt) t = { ...t, endAt: null, left: remaining(t, Date.now()) };
    else t = { ...t, endAt: Date.now() + t.left };
    save(t);
    run(!!t.endAt);
    draw();
  });
  $('fcReset').addEventListener('click', () => { t = fresh(); save(t); run(false); draw(); });
  $('fcSkip').addEventListener('click', () => {
    const running = !!t.endAt;
    nextPhase();
    if (running) t.endAt = Date.now() + t.left;
    save(t);
    draw();
  });
  $('fcClose').addEventListener('click', () => dlg.close());
  $('focusBtn').addEventListener('click', () => { draw(); dlg.showModal(); });

  // A session that ended while the app was closed still counts
  tick();
  run(!!t.endAt);
}
