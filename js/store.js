// The app's data and every change to it. Saved as JSON in localStorage.
//
// A task looks like:
//   { id, name, start, end, cat, date, repeat, every, until, skip, room, course }
//   start/end: minutes after midnight
//   date:      "YYYY-MM-DD" — the day of a one-off task, or the first day of a repeating one
//   repeat:    null, or weekdays it repeats on (0 = Sunday … 6 = Saturday)
//   every:     repeat every 1, 2, 3 or 4 weeks (missing means 1)
//   until:     null, or the last day a repeating task can happen on
//   skip:      days removed from a repeating task
//   room:      null, or where it happens
//   course:    for lessons (cat 'class'), the id of their course; the name follows the course
// "Done" is tracked per day in state.done["<id>|<date>"], so each repeat is ticked off separately.
//
// A course looks like { id, name, teacher, color }.
// Homework looks like { id, name, due, done }, with due as "YYYY-MM-DD".
// Focus minutes are kept per day in state.focus["<date>"].

import { parseKey, startOfWeek } from './time.js';

export const KEY = 'daybook:v2';
const OLD_KEY = 'daybook-v1';
export const CATS = ['class', 'study', 'work', 'personal', 'break'];
export const COURSE_COLORS = ['#2f5bd3', '#7a4fd1', '#1f8f6a', '#c98a12', '#d0455b', '#0e8fa3', '#8a6d3b', '#5b6b85'];

export const emptyState = () => ({
  tasks: [], done: {}, homework: [], focus: {}, courses: [],
  settings: { remind: 5, studyGoal: 10, termEnd: null }, nextId: 1,
});

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

// Whole weeks between the weeks (Monday to Sunday) that two days fall in
export function weeksBetween(fromK, toK) {
  const ms = startOfWeek(parseKey(toK)) - startOfWeek(parseKey(fromK));
  return Math.round(ms / (7 * 864e5)); // round, because of daylight saving changes
}

export function occursOn(t, dk) {
  if (!t.repeat) return t.date === dk;
  if (dk < t.date || (t.until && dk > t.until) || t.skip?.includes(dk)) return false;
  if (!t.repeat.includes(parseKey(dk).getDay())) return false;
  return weeksBetween(t.date, dk) % (t.every || 1) === 0;
}

// Everything planned for one day, sorted, with that day's done flag
export function dayItems(state, dk) {
  return state.tasks
    .filter(t => occursOn(t, dk))
    .map(t => ({ ...t, occ: dk, done: !!state.done[t.id + '|' + dk], color: courseColor(state, t) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function validate({ name, start, end, repeat, date, until, cat, course }) {
  if (cat === 'class' && !course) return 'Pick a course. Add one on the Classes screen first.';
  if (!name || !name.trim()) return 'Give the task a name.';
  if (end <= start) return 'The end time must be after the start time.';
  if (repeat && !repeat.length) return 'Pick at least one day to repeat on.';
  if (repeat && until && until < date) return 'The repeat must end after it starts.';
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

// Every repeating task, in week order: by its first day (Monday first), then start time
export function repeatingTasks(state) {
  const first = t => Math.min(...t.repeat.map(d => (d + 6) % 7));
  return state.tasks.filter(t => t.repeat).sort((a, b) => first(a) - first(b) || a.start - b.start);
}

// Minutes a repeating task takes up in an average week
export const weeklyMinutes = t => (t.end - t.start) * t.repeat.length / (t.every || 1);

// Changes one day of a repeating task: that day is removed from the repeat
// and a one-off task with the changes takes its place.
export function editOneDay(state, id, dk, data) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return null;
  const wasDone = !!state.done[id + '|' + dk];
  skipDay(state, id, dk);
  const one = addTask(state, { ...data, date: dk, repeat: null, every: 1, until: null });
  if (wasDone) state.done[one.id + '|' + dk] = true;
  return one;
}

export function toggleDone(state, id, dk) {
  const k = id + '|' + dk;
  if (state.done[k]) delete state.done[k];
  else state.done[k] = true;
}

// ---------- homework ----------

export function addHomework(state, { name, due }) {
  const h = { id: state.nextId++, name, due, done: false };
  state.homework.push(h);
  return h;
}

export function toggleHomework(state, id) {
  const h = state.homework.find(x => x.id === id);
  if (h) h.done = !h.done;
}

export function removeHomework(state, id) {
  state.homework = state.homework.filter(h => h.id !== id);
}

// Homework due on dk. On today, unfinished homework from earlier days is included
// too, marked overdue, so nothing slips through.
export function homeworkFor(state, dk, todayK) {
  return state.homework
    .filter(h => h.due === dk || (dk === todayK && h.due < dk && !h.done))
    .map(h => ({ ...h, overdue: h.due < todayK && !h.done }))
    .sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id);
}

// ---------- focus timer ----------

export function addFocus(state, dk, minutes) {
  state.focus[dk] = (state.focus[dk] || 0) + minutes;
}

// ---------- courses ----------

export const courseColor = (state, t) => (t.course && state.courses.find(c => c.id === t.course)?.color) || null;

export function addCourse(state, { name, teacher = '', color }) {
  const c = { id: state.nextId++, name, teacher, color: color || COURSE_COLORS[state.courses.length % COURSE_COLORS.length] };
  state.courses.push(c);
  return c;
}

// Renaming a course renames its lessons too
export function updateCourse(state, id, data) {
  const c = state.courses.find(x => x.id === id);
  if (!c) return null;
  Object.assign(c, data);
  for (const t of state.tasks) if (t.course === id) t.name = c.name;
  return c;
}

// Removes the course and all its lessons
export function removeCourse(state, id) {
  for (const t of state.tasks.filter(x => x.course === id)) removeTask(state, t.id);
  state.courses = state.courses.filter(c => c.id !== id);
}

// A course's repeating lessons, in week order
export const lessonsOf = (state, id) => repeatingTasks(state).filter(t => t.course === id);

// The lessons of a normal week, by weekday (0 = Sunday … 6 = Saturday).
// Lessons whose end date has passed are left out.
export function timetable(state, todayK) {
  const days = Array.from({ length: 7 }, () => []);
  for (const t of state.tasks) {
    if (!t.course || !t.repeat || (t.until && t.until < todayK)) continue;
    for (const d of t.repeat) days[d].push({ ...t, color: courseColor(state, t) });
  }
  for (const list of days) list.sort((a, b) => a.start - b.start || a.end - b.end);
  return days;
}
