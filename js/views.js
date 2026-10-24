// Renders the Day, Week, Classes, Repeats and Stats screens as HTML strings.
// Clicks are handled in app.js through data-* attributes.

import { fmt, hoursLabel, columns, parseKey } from './time.js';
import { CATS, weeklyMinutes } from './store.js';

export const START_H = 6, END_H = 24;
export const CAT_LABEL = { class: 'Class', study: 'Study', work: 'Work', personal: 'Personal', break: 'Break' };

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A lesson takes its course's color, anything else its type's color
const catColor = it => it.color || `var(--c-${it.cat})`;
const roomLabel = it => (it.room ? ' · ' + esc(it.room) : '');

function hourLines(hourPx, labels = true, startH = START_H, endH = END_H) {
  let html = '';
  for (let h = startH; h < endH; h++) {
    html += `<div class="hr" style="top:${(h - startH) * hourPx}px">${labels ? `<span>${String(h).padStart(2, '0')}:00</span>` : ''}</div>`;
  }
  return html;
}

function blocks(items, hourPx, startH = START_H) {
  const visible = items.filter(it => it.end > startH * 60);
  return columns(visible).map(it => {
    const from = Math.max(it.start, startH * 60);
    const top = (from - startH * 60) * hourPx / 60;
    const h = Math.max(20, (it.end - from) * hourPx / 60 - 2);
    const time = `${fmt(it.start)}–${fmt(it.end)}`;
    return `<button class="block${it.done ? ' done' : ''}" data-edit="${it.id}"${it.occ ? ` data-occ="${it.occ}"` : ''}
      style="--cat:${catColor(it)};top:${top}px;height:${h}px;left:calc(${it._c / it._n * 100}% + 2px);width:calc(${100 / it._n}% - 4px)"
      title="${esc(it.name)} · ${time}${roomLabel(it)}"><span class="n">${esc(it.name)}</span>${h > 34 ? `<span class="t">${time}${it.repeat && it.occ ? ' ↻' : ''}${roomLabel(it)}</span>` : ''}</button>`;
  }).join('');
}

function nowLine(nowMin, hourPx) {
  if (nowMin < START_H * 60) return '';
  return `<div class="now" style="top:${(nowMin - START_H * 60) * hourPx / 60}px"></div>`;
}

function upNext(items, isToday, nowMin) {
  const nx = items.find(x => !x.done && (!isToday || x.end > nowMin));
  if (!nx) return '—';
  return (isToday && nx.start <= nowMin ? 'Now · ' : fmt(nx.start) + ' · ') + esc(nx.name);
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "every Mon, Wed", "every 2 weeks on Tue", "every day until 19 Dec"
export function repeatLabel(t) {
  const days = [...t.repeat].sort((a, b) => (a + 6) % 7 - (b + 6) % 7);
  const which = days.length === 7 ? 'day' : days.join() === '1,2,3,4,5' ? 'weekday' : days.map(d => DAY_SHORT[d]).join(', ');
  let s = (t.every || 1) > 1 ? `every ${t.every} weeks on ${{ day: 'all days', weekday: 'weekdays' }[which] || which}` : `every ${which}`;
  if (t.until) s += ' until ' + parseKey(t.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return s;
}

const shortDate = dk => parseKey(dk).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function homeworkPanel(homework, dk, isToday) {
  const when = h => h.overdue ? `Overdue · was due ${shortDate(h.due)}` : isToday ? 'Due today' : 'Due ' + shortDate(dk);
  const list = homework.length ? homework.map(h => `
    <li class="${h.done ? 'done' : ''}${h.overdue ? ' overdue' : ''}">
      <input type="checkbox" data-hw-toggle="${h.id}" ${h.done ? 'checked' : ''} aria-label="Mark ${esc(h.name)} done">
      <span class="item"><span class="time">${when(h)}</span><span class="name">${esc(h.name)}</span></span>
      <button class="link" data-hw-del="${h.id}" aria-label="Delete ${esc(h.name)}">Delete</button>
    </li>`).join('')
    : '<li class="empty">No homework due.</li>';
  return `
      <section class="panel agenda homework">
        <div class="head"><h2>Homework</h2><button class="link" data-hw-add="${dk}">+ Add homework</button></div>
        <ul>${list}</ul>
      </section>`;
}

export function renderDay({ items, isToday, nowMin, dk, homework, focusMin }) {
  const HOUR = 56;
  const mins = items.reduce((a, x) => a + x.end - x.start, 0);
  const done = items.filter(x => x.done).length;
  const agenda = items.length ? items.map(it => `
    <li class="${it.done ? 'done' : ''}" style="--cat:${catColor(it)}">
      <input type="checkbox" data-toggle="${it.id}" data-occ="${it.occ}" ${it.done ? 'checked' : ''} aria-label="Mark ${esc(it.name)} done">
      <span class="dot"></span>
      <span class="item"><span class="time">${fmt(it.start)}–${fmt(it.end)}${roomLabel(it)}${it.repeat ? ' · ' + repeatLabel(it) : ''}</span>
        <span class="name">${esc(it.name)}</span>${it.ex ? '<span class="ex">example</span>' : ''}</span>
      <button class="link" data-edit="${it.id}" data-occ="${it.occ}">Edit</button>
    </li>`).join('')
    : '<li class="empty">Nothing planned yet. Tap + to add your first task.</li>';

  return `
    <div class="stats">
      <div><b>${hoursLabel(mins)}</b>planned</div>
      <div><b>${done} / ${items.length}</b>done</div>
      <div><b>${hoursLabel(focusMin)}</b>focused</div>
      <div class="grow"><b>${upNext(items, isToday, nowMin)}</b>up next</div>
    </div>
    <div class="grid">
      <div class="panel timeline" id="scroller">
        <div class="track" style="height:${(END_H - START_H) * HOUR}px">
          ${hourLines(HOUR)}${blocks(items, HOUR)}${isToday ? nowLine(nowMin, HOUR) : ''}
        </div>
      </div>
      <div class="side">
        <section class="panel agenda">
          <h2>Agenda</h2>
          <ul>${agenda}</ul>
        </section>
        ${homeworkPanel(homework, dk, isToday)}
      </div>
    </div>`;
}

// goal: { done, target, focus } in minutes — Study tasks done, the weekly goal, focus time
function goalPanel({ done, target, focus }) {
  if (!target) return '';
  const pct = Math.min(100, Math.round(done / target * 100));
  const msg = done >= target ? 'Goal reached. Well done!' : `${hoursLabel(target - done)} to go`;
  return `
    <section class="panel goal">
      <div class="head"><h2>Study goal</h2><span class="val">${hoursLabel(done)} / ${hoursLabel(target)} · ${msg}</span></div>
      <div class="bar" style="--cat:var(--c-study)" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Study goal">
        <div class="bar-planned" style="width:100%"><div class="bar-done" style="width:${pct}%"></div></div>
      </div>
      <p class="note">Counts Study tasks you tick off. You also focused for ${hoursLabel(focus)} this week. Change the goal in Settings.</p>
    </section>`;
}

export function renderWeek({ days, nowMin, goal }) {
  const HOUR = 40;
  const head = days.map(d => {
    const date = parseKey(d.dk);
    const due = d.homework.filter(h => !h.done && h.due === d.dk).length;
    return `<button class="wk-head${d.isToday ? ' today' : ''}" data-day="${d.dk}">
      <span>${date.toLocaleDateString('en-GB', { weekday: 'short' })}</span><b>${date.getDate()}</b>
      ${due ? `<span class="hw-due" title="${due} homework due">${due} due</span>` : ''}</button>`;
  }).join('');
  const cols = days.map(d => `
    <div class="wk-col${d.isToday ? ' today' : ''}">
      ${hourLines(HOUR, false)}${blocks(d.items, HOUR)}${d.isToday ? nowLine(nowMin, HOUR) : ''}
    </div>`).join('');
  return `${goalPanel(goal)}
    <div class="panel week" id="scroller">
      <div class="wk-grid">
        <div class="wk-corner"></div>${head}
        <div class="wk-times" style="height:${(END_H - START_H) * HOUR}px">${hourLines(HOUR)}</div>${cols}
      </div>
    </div>
    <p class="note">Tap a day's name to open it and see its homework.</p>`;
}

// days: lessons by weekday (0 = Sunday), courses: [{ ...course, lessons }]
export function renderClasses({ days, courses, todayK }) {
  const HOUR = 52;
  // Mon–Fri, plus the weekend only when something is on it
  const order = [1, 2, 3, 4, 5, ...[6, 0].filter(d => days[d].length)];
  const all = order.flatMap(d => days[d]);
  const startH = all.length ? Math.min(...all.map(x => Math.floor(x.start / 60))) : 8;
  const endH = all.length ? Math.max(...all.map(x => Math.ceil(x.end / 60))) : 17;
  const todayWd = parseKey(todayK).getDay();
  const head = order.map(d => `<div class="wk-head${d === todayWd ? ' today' : ''}"><span>${DAY_SHORT[d]}</span></div>`).join('');
  const cols = order.map(d => `
    <div class="wk-col${d === todayWd ? ' today' : ''}">${hourLines(HOUR, false, startH, endH)}${blocks(days[d], HOUR, startH)}</div>`).join('');
  const grid = all.length ? `
    <div class="panel week timetable">
      <div class="wk-grid" style="grid-template-columns:52px repeat(${order.length}, minmax(84px, 1fr));min-width:${52 + order.length * 84}px">
        <div class="wk-corner"></div>${head}
        <div class="wk-times" style="height:${(endH - startH) * HOUR}px">${hourLines(HOUR, true, startH, endH)}</div>${cols}
      </div>
    </div>` : '';

  const cards = courses.map(c => {
    const lessons = c.lessons.length ? c.lessons.map(t => {
      const ended = t.until && t.until < todayK;
      return `
        <li class="${ended ? 'ended' : ''}">
          <span class="item"><span class="name">${fmt(t.start)}–${fmt(t.end)}${roomLabel(t)}</span>
            <span class="time">${repeatLabel(t)}${ended ? ' · ended' : ''}</span></span>
          <button class="link" data-edit="${t.id}">Edit</button>
        </li>`;
    }).join('') : '<li class="empty">No lessons yet.</li>';
    return `
    <section class="panel agenda course" style="--cat:${c.color}">
      <div class="head"><h2><span class="dot"></span>${esc(c.name)}</h2><button class="link" data-course-edit="${c.id}">Edit course</button></div>
      ${c.teacher ? `<p class="note">${esc(c.teacher)}</p>` : ''}
      <ul>${lessons}</ul>
      <button class="link add-lesson" data-lesson-add="${c.id}">+ Add lesson</button>
    </section>`;
  }).join('');

  return `
    <div class="head">
      <div class="stats">
        <div><b>${courses.length}</b>courses</div>
        <div><b>${hoursLabel(all.reduce((a, x) => a + (x.end - x.start) / (x.every || 1), 0))}</b>of class a week</div>
      </div>
      <button class="primary" data-course-add>+ New course</button>
    </div>
    ${courses.length ? '' : '<p class="note">Start by adding your courses, for example Maths or Physics. Then add each course\'s lessons: the days, times and room.</p>'}
    ${grid}
    <div class="grid two">${cards}</div>`;
}

export function renderRepeats({ tasks, todayK }) {
  const mins = tasks.reduce((a, t) => a + weeklyMinutes(t), 0);
  const rows = tasks.length ? tasks.map(t => {
    const ended = t.until && t.until < todayK;
    return `
    <li class="${ended ? 'ended' : ''}" style="--cat:${catColor(t)}" data-rt="${t.id}">
      <span class="dot"></span>
      <span class="item"><span class="name">${esc(t.name)}</span>
        <span class="time">${repeatLabel(t)}${ended ? ' · ended' : ''}</span></span>
      <span class="rt-times">
        <input type="time" value="${fmt(t.start)}" data-rt-start aria-label="${esc(t.name)} start time">
        <span aria-hidden="true">–</span>
        <input type="time" value="${fmt(t.end)}" data-rt-end aria-label="${esc(t.name)} end time">
      </span>
      <button class="link" data-edit="${t.id}">Edit</button>
    </li>`;
  }).join('')
    : '<li class="empty">No repeating tasks yet. Add your classes, training or anything else that happens every week.</li>';
  return `
    <div class="stats">
      <div><b>${tasks.length}</b>repeating tasks</div>
      <div><b>${hoursLabel(Math.round(mins))}</b>a week</div>
    </div>
    <section class="panel agenda repeats">
      <div class="head"><h2>All repeating tasks</h2><button class="link" data-rt-add>+ New repeating task</button></div>
      <ul>${rows}</ul>
    </section>
    <p class="note">Change a time here and it changes on every day the task repeats. Use Edit for the name, days or end date.</p>`;
}

export function renderStats(ws) {
  const pct = ws.count ? Math.round(ws.doneCount / ws.count * 100) : 0;
  const maxCat = Math.max(1, ...CATS.map(c => ws.cats[c].planned));
  const maxDay = Math.max(1, ...ws.days.map(d => d.planned));
  const bar = (planned, done, max, cat) => `
    <div class="bar" style="--cat:var(--c-${cat})">
      <div class="bar-planned" style="width:${planned / max * 100}%">
        <div class="bar-done" style="width:${planned ? done / planned * 100 : 0}%"></div>
      </div>
    </div>`;
  const catRows = CATS.map(c => `
    <div class="row"><span class="lbl"><span class="dot" style="--cat:var(--c-${c})"></span>${CAT_LABEL[c]}</span>
      ${bar(ws.cats[c].planned, ws.cats[c].done, maxCat, c)}
      <span class="val">${hoursLabel(ws.cats[c].done)} / ${hoursLabel(ws.cats[c].planned)}</span></div>`).join('');
  const dayRows = ws.days.map(d => `
    <div class="row"><span class="lbl">${parseKey(d.dk).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span>
      ${bar(d.planned, d.done, maxDay, 'accent')}
      <span class="val">${hoursLabel(d.done)} / ${hoursLabel(d.planned)}</span></div>`).join('');
  return `
    <div class="stats">
      <div><b>${hoursLabel(ws.planned)}</b>planned this week</div>
      <div><b>${hoursLabel(ws.done)}</b>done</div>
      <div><b>${pct}%</b>tasks completed</div>
    </div>
    <div class="grid two">
      <section class="panel chart"><h2>By type</h2>${catRows}</section>
      <section class="panel chart"><h2>By day</h2>${dayRows}</section>
    </div>
    <p class="note">Dark bar = done, light bar = planned.</p>`;
}
