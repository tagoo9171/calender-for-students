import { dateKey, parseKey, addDays, startOfWeek, nowMinutes, toMin } from './time.js';
import * as store from './store.js';
import { weekStats } from './stats.js';
import { renderDay, renderWeek, renderStats, renderRepeats, renderClasses, START_H } from './views.js';
import { createCourseEditor } from './courses.js';
import { createEditor } from './editor.js';
import { startReminders, askPermission, notificationsSupported, notify } from './reminders.js';
import { createFocusTimer } from './focus.js';

const $ = id => document.getElementById(id);
const VIEW_KEY = 'daybook:view';

let state = store.load(localStorage) ?? seed();
let view = (() => { try { return localStorage.getItem(VIEW_KEY) || 'day'; } catch { return 'day'; } })();
let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
let undoSnapshot = null;

// First visit: a sample day so the app isn't empty
function seed() {
  const s = store.emptyState();
  const today = dateKey(new Date());
  const ex = { date: today, repeat: null, ex: true };
  store.addTask(s, { ...ex, name: 'Morning walk', start: 420, end: 465, cat: 'personal' });
  store.addTask(s, { ...ex, name: 'Deep work: project report', start: 540, end: 660, cat: 'work' });
  store.addTask(s, { ...ex, name: 'Lunch', start: 750, end: 810, cat: 'break' });
  store.addTask(s, { ...ex, name: 'English practice', start: 840, end: 900, cat: 'study', repeat: [1, 2, 3, 4, 5] });
  store.addTask(s, { ...ex, name: 'Gym', start: 1110, end: 1170, cat: 'personal', repeat: [1, 3, 5] });
  return s;
}

function commit(message, { undo = false } = {}) {
  store.save(localStorage, state);
  render();
  if (message) toast(message, undo);
}

function snapshot() { undoSnapshot = JSON.stringify(state); }

// ---------- rendering ----------

function render() {
  const todayK = dateKey(new Date());
  const nowMin = nowMinutes();
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === view));

  $('daynav').hidden = view === 'repeats' || view === 'classes';
  if (view === 'classes') {
    $('title').textContent = 'Class timetable';
    $('sub').textContent = 'Your courses and their weekly lessons';
    $('view').innerHTML = renderClasses({
      days: store.timetable(state, todayK),
      courses: state.courses.map(c => ({ ...c, lessons: store.lessonsOf(state, c.id) })),
      todayK,
    });
  } else if (view === 'repeats') {
    const tasks = store.repeatingTasks(state).map(t => ({ ...t, color: store.courseColor(state, t) }));
    $('title').textContent = 'Repeating tasks';
    $('sub').textContent = 'Your weekly routine in one place';
    $('view').innerHTML = renderRepeats({ tasks, todayK });
  } else if (view === 'day') {
    const dk = dateKey(cursor);
    const isToday = dk === todayK;
    $('title').textContent = isToday ? 'Today' : cursor.toLocaleDateString('en-GB', { weekday: 'long' });
    $('sub').textContent = cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('todayBtn').textContent = 'Today';
    $('view').innerHTML = renderDay({
      items: store.dayItems(state, dk), isToday, nowMin, dk,
      homework: store.homeworkFor(state, dk, todayK), focusMin: state.focus[dk] || 0,
    });
  } else {
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    const isThisWeek = dateKey(ws) === dateKey(startOfWeek(new Date()));
    $('title').textContent = isThisWeek ? 'This week' : 'Week of ' + ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    $('sub').textContent = `${ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} – ${we.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    $('todayBtn').textContent = 'This week';
    if (view === 'week') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const dk = dateKey(addDays(ws, i));
        return { dk, isToday: dk === todayK, items: store.dayItems(state, dk), homework: store.homeworkFor(state, dk, todayK) };
      });
      const goal = {
        done: weekStats(state, ws).cats.study.done,
        target: state.settings.studyGoal * 60,
        focus: days.reduce((a, d) => a + (state.focus[d.dk] || 0), 0),
      };
      $('view').innerHTML = renderWeek({ days, nowMin, goal });
    } else {
      $('view').innerHTML = renderStats(weekStats(state, ws));
    }
  }
}

function scrollToNow() {
  const el = $('scroller');
  if (!el) return;
  const hourPx = view === 'day' ? 56 : 40;
  const h = dateKey(cursor) === dateKey(new Date()) || view === 'week' ? new Date().getHours() : 8;
  el.scrollTop = Math.max(0, h - START_H - 1) * hourPx;
}

let toastTimer;
function toast(message, withUndo = false) {
  const el = $('toast');
  el.innerHTML = '';
  el.append(message);
  if (withUndo && undoSnapshot) {
    const b = document.createElement('button');
    b.textContent = 'Undo';
    b.onclick = () => {
      state = JSON.parse(undoSnapshot);
      undoSnapshot = null;
      commit('Restored');
    };
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

// ---------- editor ----------

const editor = createEditor({
  getCourses: () => state.courses,
  getTermEnd: () => state.settings.termEnd,
  onSave(id, data) {
    if (data.course && data.until) state.settings.termEnd = data.until; // the next lesson ends then too
    if (id) {
      store.updateTask(state, id, data);
      commit('Saved');
    } else {
      store.addTask(state, data);
      cursor = parseKey(data.date);
      commit('Added');
    }
  },
  onSaveOne(id, dk, data) { snapshot(); store.editOneDay(state, id, dk, data); commit('Changed for this day only', { undo: true }); },
  onDelete(id) { snapshot(); store.removeTask(state, id); commit('Deleted', { undo: true }); },
  onSkip(id, dk) { snapshot(); store.skipDay(state, id, dk); commit('Removed from this day', { undo: true }); },
});

// ---------- events ----------

$('view').addEventListener('click', e => {
  if (e.target.closest('[data-course-add]')) { courseEditor.open(null, nextColor()); return; }
  const courseEdit = e.target.closest('[data-course-edit]');
  if (courseEdit) { courseEditor.open(state.courses.find(c => c.id === Number(courseEdit.dataset.courseEdit))); return; }
  const lessonAdd = e.target.closest('[data-lesson-add]');
  if (lessonAdd) { editor.open({ date: dateKey(new Date()), start: 540, course: Number(lessonAdd.dataset.lessonAdd) }); return; }
  if (e.target.closest('[data-rt-add]')) { editor.open({ date: dateKey(new Date()), start: 540, repeat: true }); return; }
  const hwAdd = e.target.closest('[data-hw-add]');
  if (hwAdd) { openHomework(hwAdd.dataset.hwAdd); return; }
  const hwDel = e.target.closest('[data-hw-del]');
  if (hwDel) { snapshot(); store.removeHomework(state, Number(hwDel.dataset.hwDel)); commit('Homework deleted', { undo: true }); return; }
  const edit = e.target.closest('[data-edit]');
  if (edit) {
    const task = state.tasks.find(t => t.id === Number(edit.dataset.edit));
    if (task) editor.open({ task, occ: edit.dataset.occ });
    return;
  }
  const day = e.target.closest('[data-day]');
  if (day) { cursor = parseKey(day.dataset.day); setView('day'); }
});

$('view').addEventListener('change', e => {
  const row = e.target.closest('[data-rt]');
  if (row) { setTimes(row); return; }
  const hw = e.target.closest('[data-hw-toggle]');
  if (hw) { store.toggleHomework(state, Number(hw.dataset.hwToggle)); commit(); return; }
  const t = e.target.closest('[data-toggle]');
  if (!t) return;
  store.toggleDone(state, Number(t.dataset.toggle), t.dataset.occ);
  commit();
});

function setView(v) {
  view = v;
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  render();
  scrollToNow();
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

function move(dir) {
  cursor = addDays(cursor, dir * (view === 'day' ? 1 : 7));
  render();
  scrollToNow();
}
$('prev').addEventListener('click', () => move(-1));
$('next').addEventListener('click', () => move(1));
$('todayBtn').addEventListener('click', () => { cursor = new Date(); cursor.setHours(0, 0, 0, 0); render(); scrollToNow(); });

$('addBtn').addEventListener('click', () => {
  if (view === 'classes') {
    if (!state.courses.length) courseEditor.open(null, nextColor());
    else editor.open({ date: dateKey(new Date()), start: 540, course: state.courses[0].id });
    return;
  }
  const isToday = dateKey(cursor) === dateKey(new Date());
  const start = isToday ? Math.min(Math.ceil((nowMinutes() + 1) / 30) * 30, 1380) : 540;
  editor.open({ date: dateKey(cursor), start, repeat: view === 'repeats' });
});

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.target.matches('input, select, textarea')) return;
  if (e.key === 'ArrowLeft') move(-1);
  if (e.key === 'ArrowRight') move(1);
  if (e.key === 'n') $('addBtn').click();
});

// ---------- courses ----------

const nextColor = () => store.COURSE_COLORS.find(c => !state.courses.some(x => x.color === c))
  ?? store.COURSE_COLORS[state.courses.length % store.COURSE_COLORS.length];

const courseEditor = createCourseEditor({
  onSave(id, data) {
    if (id) { store.updateCourse(state, id, data); commit('Course saved'); }
    else { store.addCourse(state, data); commit('Course added. Now add its lessons.'); }
  },
  onDelete(id) { snapshot(); store.removeCourse(state, id); commit('Course deleted', { undo: true }); },
  lessonCount: id => state.tasks.filter(t => t.course === id).length,
});

// ---------- repeating tasks ----------

// Saves the start and end time typed into a row of the Repeats screen
function setTimes(row) {
  const start = row.querySelector('[data-rt-start]').value;
  let end = row.querySelector('[data-rt-end]').value;
  if (!start || !end) return; // still typing
  end = toMin(end) || 1440; // "00:00" as an end time means midnight
  const id = Number(row.dataset.rt);
  const task = state.tasks.find(t => t.id === id);
  const err = store.validate({ ...task, start: toMin(start), end });
  if (err) { toast(err); render(); return; }
  store.updateTask(state, id, { start: toMin(start), end, ex: false });
  commit('Time saved for every repeat');
}

// ---------- homework ----------

function openHomework(date) {
  $('hwName').value = '';
  $('hwDue').value = date;
  $('hwErr').hidden = true;
  $('hwDlg').showModal();
  $('hwName').focus();
}

$('hwForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('hwName').value.trim();
  const due = $('hwDue').value;
  if (!name || !due) {
    $('hwErr').textContent = name ? 'Pick the day it is due.' : 'Give the homework a name.';
    $('hwErr').hidden = false;
    return;
  }
  store.addHomework(state, { name, due });
  $('hwDlg').close();
  commit('Homework added');
});
$('hwCancel').addEventListener('click', () => $('hwDlg').close());

// ---------- focus timer ----------

createFocusTimer({
  onFocusDone(minutes) {
    store.addFocus(state, dateKey(new Date()), minutes);
    commit(`Focus session done (+${minutes} min). Take a short break.`);
    notify('Focus session done', 'Time for a 5 minute break.');
  },
  onBreakDone() {
    toast('Break is over. Start the next focus session when you are ready.');
    notify('Break is over', 'Ready for the next focus session?');
  },
});

// ---------- settings ----------

function syncNotifyStatus() {
  const s = $('notifyStatus');
  if (!notificationsSupported()) { s.textContent = 'This browser does not support notifications. You will still see reminders inside the app.'; $('notifyBtn').hidden = true; return; }
  const p = Notification.permission;
  $('notifyBtn').hidden = p === 'granted';
  s.textContent = p === 'granted' ? 'Notifications are on.'
    : p === 'denied' ? 'Notifications are blocked. Allow them in your browser\'s site settings.'
    : 'Notifications are off. Reminders show only inside the app.';
}

$('settingsBtn').addEventListener('click', () => {
  $('remind').value = String(state.settings.remind);
  $('studyGoal').value = String(state.settings.studyGoal);
  syncNotifyStatus();
  $('settings').showModal();
});
$('remind').addEventListener('change', () => { state.settings.remind = Number($('remind').value); commit(); });
$('studyGoal').addEventListener('change', () => {
  const h = Math.round(Number($('studyGoal').value));
  state.settings.studyGoal = Number.isFinite(h) ? Math.min(Math.max(h, 0), 100) : 10;
  $('studyGoal').value = String(state.settings.studyGoal);
  commit();
});
$('notifyBtn').addEventListener('click', async () => { await askPermission(); syncNotifyStatus(); });
$('closeSettings').addEventListener('click', () => $('settings').close());

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `daybook-backup-${dateKey(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks)) throw new Error();
    snapshot();
    const empty = store.emptyState();
    state = { ...empty, ...data, settings: { ...empty.settings, ...data.settings } };
    $('settings').close();
    commit('Backup restored', { undo: true });
  } catch {
    toast('That file is not a Daybook backup.');
  }
  e.target.value = '';
});

// ---------- start ----------

render();
scrollToNow();
// Redraw every minute for the "now" line, but not while a time is being typed on the Repeats screen
setInterval(() => { if (view !== 'repeats' || !$('view').contains(document.activeElement)) render(); }, 60000);
startReminders(() => state, toast);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* app still works online */ });
}
