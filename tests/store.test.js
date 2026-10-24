import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { columns, toMin, fmt, startOfWeek, dateKey } from '../js/time.js';
import { weekStats } from '../js/stats.js';
import { dueReminders } from '../js/reminders.js';
import * as focus from '../js/focus.js';
import { repeatLabel } from '../js/views.js';

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

test('homework shows on its due day, and overdue work shows on today', () => {
  const s = store.emptyState();
  const old = store.addHomework(s, { name: 'Essay', due: MON });
  store.addHomework(s, { name: 'Worksheet', due: WED });
  assert.deepEqual(store.homeworkFor(s, WED, TUE).map(h => h.name), ['Worksheet']);
  const today = store.homeworkFor(s, TUE, TUE);
  assert.deepEqual(today.map(h => [h.name, h.overdue]), [['Essay', true]]);
  store.toggleHomework(s, old.id);
  assert.equal(store.homeworkFor(s, TUE, TUE).length, 0, 'finished work is no longer overdue');
  assert.equal(store.homeworkFor(s, MON, TUE)[0].done, true, 'but still shows on its own day');
  store.removeHomework(s, old.id);
  assert.equal(s.homework.length, 1);
});

test('focus minutes add up per day', () => {
  const s = store.emptyState();
  store.addFocus(s, MON, 25);
  store.addFocus(s, MON, 25);
  assert.equal(s.focus[MON], 50);
  assert.equal(s.focus[TUE], undefined);
});

test('old saves get the new fields', () => {
  const st = memoryStorage({ [store.KEY]: JSON.stringify({ tasks: [], done: {}, settings: { remind: 10 }, nextId: 3 }) });
  const s = store.load(st);
  assert.deepEqual(s.homework, []);
  assert.deepEqual(s.focus, {});
  assert.deepEqual(s.settings, { remind: 10, studyGoal: 10 });
});

test('focus timer helpers', () => {
  assert.equal(focus.clock(25 * 60000), '25:00');
  assert.equal(focus.clock(61500), '01:02', 'rounds up partial seconds');
  const t = { phase: 'focus', endAt: 10000, left: 0 };
  assert.equal(focus.remaining(t, 4000), 6000);
  assert.equal(focus.remaining(t, 99999), 0);
  assert.equal(focus.remaining(focus.fresh(), 123), 25 * 60000, 'paused timer keeps its time');
});

test('repeat every 2 weeks, until a date', () => {
  const s = store.emptyState();
  // Lab on Tuesdays, every other week, from 20 Oct until 1 Dec
  store.addTask(s, { name: 'Lab', start: 600, end: 720, cat: 'study', date: TUE, repeat: [2], every: 2, until: '2026-12-01' });
  const on = dk => store.dayItems(s, dk).length === 1;
  assert.ok(on(TUE));
  assert.ok(!on('2026-10-27'), 'the week in between');
  assert.ok(on('2026-11-03'));
  assert.ok(on('2026-12-01'), 'the last day counts');
  assert.ok(!on('2026-12-15'), 'after the end date');
  // Weeks are counted from the week it starts, not the first day it happens
  const t = store.addTask(s, { name: 'Club', start: 0, end: 60, cat: 'personal', date: WED, repeat: [1, 5], every: 2 });
  assert.ok(store.occursOn(t, '2026-10-23'), 'Friday of the first week');
  assert.ok(!store.occursOn(t, '2026-10-26'), 'Monday of the next week');
  assert.ok(store.occursOn(t, '2026-11-02'));
});

test('weeks are counted right across a daylight saving change', () => {
  assert.equal(store.weeksBetween('2026-10-19', '2026-11-02'), 2); // clocks change on 25 Oct in Europe
  assert.equal(store.weeksBetween('2026-03-23', '2026-03-30'), 1);
});

test('validate checks the end date of a repeat', () => {
  assert.match(store.validate({ name: 'x', start: 0, end: 60, repeat: [1], date: TUE, until: MON }), /end after it starts/);
  assert.equal(store.validate({ name: 'x', start: 0, end: 60, repeat: [1], date: TUE, until: TUE }), null);
});

test('edit one day of a repeating task', () => {
  const s = store.emptyState();
  const t = store.addTask(s, { name: 'Maths', start: 540, end: 600, cat: 'study', date: MON, repeat: [1, 3] });
  store.toggleDone(s, t.id, WED);
  store.editOneDay(s, t.id, WED, { name: 'Maths (room 12)', start: 600, end: 660, cat: 'study', date: MON, repeat: [1, 3] });
  const wed = store.dayItems(s, WED);
  assert.deepEqual(wed.map(x => [x.name, x.start, x.done, x.repeat]), [['Maths (room 12)', 600, true, null]]);
  assert.equal(store.dayItems(s, '2026-10-26')[0].name, 'Maths', 'other days keep the old details');
});

test('repeat labels', () => {
  assert.equal(repeatLabel({ repeat: [3, 1] }), 'every Mon, Wed');
  assert.equal(repeatLabel({ repeat: [1, 2, 3, 4, 5] }), 'every weekday');
  assert.equal(repeatLabel({ repeat: [0, 1, 2, 3, 4, 5, 6], every: 2 }), 'every 2 weeks on all days');
  assert.equal(repeatLabel({ repeat: [2], until: '2026-12-01' }), 'every Tue until 1 Dec');
});

test('repeating tasks are listed in week order with their weekly time', () => {
  const s = store.emptyState();
  store.addTask(s, { name: 'Football', start: 1080, end: 1200, cat: 'personal', date: MON, repeat: [6] });
  store.addTask(s, { name: 'Dentist', start: 600, end: 660, cat: 'personal', date: TUE, repeat: null });
  store.addTask(s, { name: 'Maths', start: 540, end: 600, cat: 'study', date: MON, repeat: [3, 1] });
  store.addTask(s, { name: 'Choir', start: 480, end: 540, cat: 'personal', date: MON, repeat: [0] });
  store.addTask(s, { name: 'Lab', start: 840, end: 960, cat: 'study', date: MON, repeat: [2], every: 2 });
  assert.deepEqual(store.repeatingTasks(s).map(t => t.name), ['Maths', 'Lab', 'Football', 'Choir']);
  assert.deepEqual(store.repeatingTasks(s).map(store.weeklyMinutes), [120, 60, 120, 60]);
});
