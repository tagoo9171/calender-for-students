import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { columns, toMin, fmt, startOfWeek, dateKey } from '../js/time.js';
import { weekStats } from '../js/stats.js';
import { dueReminders } from '../js/reminders.js';

// 2026-10-19 is a Monday
const MON = '2026-10-19', TUE = '2026-10-20', WED = '2026-10-21', SUN = '2026-10-25';

function memoryStorage(init = {}) {
  const data = { ...init };
  return { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
}

test('time helpers', () => {
  assert.equal(toMin('09:30'), 570);
  assert.equal(fmt(570), '09:30');
  assert.equal(fmt(1440), '00:00');
  assert.equal(dateKey(startOfWeek(new Date(2026, 9, 25))), MON); // Sunday → Monday before
});

test('one-off task appears only on its day', () => {
  const s = store.emptyState();
  store.addTask(s, { name: 'Dentist', start: 600, end: 660, cat: 'personal', date: TUE, repeat: null });
  assert.equal(store.dayItems(s, TUE).length, 1);
  assert.equal(store.dayItems(s, WED).length, 0);
});

test('repeating task follows weekdays, start date and skipped days', () => {
  const s = store.emptyState();
  const t = store.addTask(s, { name: 'Gym', start: 1080, end: 1140, cat: 'personal', date: TUE, repeat: [1, 3] });
  assert.equal(store.dayItems(s, MON).length, 0, 'before the start date');
  assert.equal(store.dayItems(s, WED).length, 1);
  assert.equal(store.dayItems(s, '2026-10-26').length, 1, 'next Monday');
  store.skipDay(s, t.id, WED);
  assert.equal(store.dayItems(s, WED).length, 0);
});

test('done is tracked per day', () => {
  const s = store.emptyState();
  const t = store.addTask(s, { name: 'Read', start: 1260, end: 1290, cat: 'study', date: MON, repeat: [0, 1, 2, 3, 4, 5, 6] });
  store.toggleDone(s, t.id, MON);
  assert.equal(store.dayItems(s, MON)[0].done, true);
  assert.equal(store.dayItems(s, TUE)[0].done, false);
  store.removeTask(s, t.id);
  assert.deepEqual(s.done, {});
});

test('validate', () => {
  assert.equal(store.validate({ name: ' ', start: 0, end: 60 }), 'Give the task a name.');
  assert.match(store.validate({ name: 'x', start: 60, end: 60 }), /end time/);
  assert.match(store.validate({ name: 'x', start: 0, end: 60, repeat: [] }), /at least one day/);
  assert.equal(store.validate({ name: 'x', start: 0, end: 60, repeat: null }), null);
});

test('save and load round trip, and v1 migration skips examples', () => {
  const st = memoryStorage();
  assert.equal(store.load(st), null);
  const s = store.emptyState();
  store.addTask(s, { name: 'A', start: 0, end: 30, cat: 'work', date: MON, repeat: null });
  store.save(st, s);
  assert.equal(store.load(st).tasks[0].name, 'A');

  const old = memoryStorage({ 'daybook-v1': JSON.stringify({ [MON]: [
    { id: 1, name: 'Sample', s: 60, e: 90, cat: 'work', ex: true },
    { id: 2, name: 'Mine', s: 600, e: 660, cat: 'study', done: true },
  ] }) });
  const m = store.load(old);
  assert.equal(m.tasks.length, 1);
  assert.equal(store.dayItems(m, MON)[0].done, true);
});

test('overlapping items get side-by-side columns', () => {
  const out = columns([
    { start: 540, end: 600 }, { start: 570, end: 630 }, { start: 700, end: 720 },
  ]);
  assert.deepEqual(out.map(x => [x._c, x._n]), [[0, 2], [1, 2], [0, 1]]);
});

test('weekStats sums planned and done minutes', () => {
  const s = store.emptyState();
  const t = store.addTask(s, { name: 'Work', start: 540, end: 660, cat: 'work', date: MON, repeat: [1, 2, 3, 4, 5] });
  store.addTask(s, { name: 'Walk', start: 420, end: 450, cat: 'personal', date: SUN, repeat: null });
  store.toggleDone(s, t.id, MON);
  const ws = weekStats(s, new Date(2026, 9, 19));
  assert.equal(ws.planned, 5 * 120 + 30);
  assert.equal(ws.done, 120);
  assert.equal(ws.cats.work.planned, 600);
  assert.equal(ws.count, 6);
  assert.equal(ws.doneCount, 1);
});

test('dueReminders picks tasks starting soon, once', () => {
  const items = [
    { id: 1, occ: MON, start: 600, done: false },
    { id: 2, occ: MON, start: 700, done: false },
    { id: 3, occ: MON, start: 603, done: true },
  ];
  assert.deepEqual(dueReminders(items, 596, 5, new Set()).map(x => x.id), [1]);
  assert.deepEqual(dueReminders(items, 596, 5, new Set(['1|' + MON])), []);
  assert.deepEqual(dueReminders(items, 596, 0, new Set()), []);
});
