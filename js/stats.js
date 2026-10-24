import { addDays, dateKey } from './time.js';
import { dayItems, CATS } from './store.js';

// Planned and done minutes for the 7 days starting at weekStart,
// in total, per day and per type.
export function weekStats(state, weekStart) {
  const cats = Object.fromEntries(CATS.map(c => [c, { planned: 0, done: 0 }]));
  const days = [];
  let planned = 0, done = 0, count = 0, doneCount = 0;
  for (let i = 0; i < 7; i++) {
    const dk = dateKey(addDays(weekStart, i));
    let p = 0, d = 0;
    for (const it of dayItems(state, dk)) {
      const m = it.end - it.start;
      p += m;
      count++;
      cats[it.cat].planned += m;
      if (it.done) { d += m; doneCount++; cats[it.cat].done += m; }
    }
    days.push({ dk, planned: p, done: d });
    planned += p;
    done += d;
  }
  return { days, cats, planned, done, count, doneCount };
}
