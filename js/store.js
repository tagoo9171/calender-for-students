// The app's data and every change to it. Saved as JSON in localStorage.
//
// A task looks like:
//   { id, name, start, end, cat, date, repeat, skip }
//   start/end: minutes after midnight
//   date:      "YYYY-MM-DD" — the day of a one-off task, or the first day of a repeating one
//   repeat:    null, or weekdays it repeats on (0 = Sunday … 6 = Saturday)
//   skip:      days removed from a repeating task
// "Done" is tracked per day in state.done["<id>|<date>"], so each repeat is ticked off separately.

import { parseKey } from './time.js';

export const KEY = 'daybook:v2';
const OLD_KEY = 'daybook-v1';
export const CATS = ['work', 'study', 'personal', 'break'];

export const emptyState = () => ({ tasks: [], done: {}, settings: { remind: 5 }, nextId: 1 });

// Returns the saved state, or null on a first visit.
export function load(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const s = { ...emptyState(), ...JSON.parse(raw) };
      s.settings = { ...emptyState().settings, ...s.settings };
      return s;
    }
  } catch { /* fall through */ }
  try {
    const old = JSON.parse(storage.getItem(OLD_KEY));
    if (old) return migrateV1(old);
  } catch { /* nothing to migrate */ }
  return null;
}

// Plans made in the first, single-page planner
export function migrateV1(old) {
  const s = emptyState();
  for (const [date, list] of Object.entries(old)) {
    for (const it of list) {
      if (it.ex) continue;
      const t = addTask(s, { name: it.name, start: it.s, end: it.e, cat: it.cat, date, repeat: null });
      if (it.done) s.done[t.id + '|' + date] = true;
    }
  }
  return s;
}

export function save(storage, state) {
  try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export function occursOn(t, dk) {
  if (!t.repeat) return t.date === dk;
  if (dk < t.date || t.skip?.includes(dk)) return false;
  return t.repeat.includes(parseKey(dk).getDay());
}

// Everything planned for one day, sorted, with that day's done flag
export function dayItems(state, dk) {
  return state.tasks
    .filter(t => occursOn(t, dk))
    .map(t => ({ ...t, occ: dk, done: !!state.done[t.id + '|' + dk] }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function validate({ name, start, end, repeat }) {
  if (!name || !name.trim()) return 'Give the task a name.';
  if (end <= start) return 'The end time must be after the start time.';
  if (repeat && !repeat.length) return 'Pick at least one day to repeat on.';
  return null;
}

export function addTask(state, data) {
  const t = { id: state.nextId++, skip: [], ...data };
  state.tasks.push(t);
  return t;
}

export function updateTask(state, id, data) {
  const t = state.tasks.find(x => x.id === id);
  if (t) Object.assign(t, data);
  return t;
}

export function removeTask(state, id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  for (const k of Object.keys(state.done)) if (k.startsWith(id + '|')) delete state.done[k];
}

// Removes one day from a repeating task
export function skipDay(state, id, dk) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.skip = [...(t.skip || []), dk];
  delete state.done[id + '|' + dk];
}

export function toggleDone(state, id, dk) {
  const k = id + '|' + dk;
  if (state.done[k]) delete state.done[k];
  else state.done[k] = true;
}
