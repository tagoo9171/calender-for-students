// Renders the Day, Week and Stats screens as HTML strings.
// Clicks are handled in app.js through data-* attributes.

import { fmt, hoursLabel, columns, parseKey } from './time.js';
import { CATS } from './store.js';

export const START_H = 6, END_H = 24;
export const CAT_LABEL = { work: 'Work', study: 'Study', personal: 'Personal', break: 'Break' };

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hourLines(hourPx, labels = true) {
  let html = '';
  for (let h = START_H; h < END_H; h++) {
    html += `<div class="hr" style="top:${(h - START_H) * hourPx}px">${labels ? `<span>${String(h).padStart(2, '0')}:00</span>` : ''}</div>`;
  }
  return html;
}

function blocks(items, hourPx) {
  const visible = items.filter(it => it.end > START_H * 60);
  return columns(visible).map(it => {
    const from = Math.max(it.start, START_H * 60);
    const top = (from - START_H * 60) * hourPx / 60;
    const h = Math.max(20, (it.end - from) * hourPx / 60 - 2);
    const time = `${fmt(it.start)}–${fmt(it.end)}`;
    return `<button class="block${it.done ? ' done' : ''}" data-edit="${it.id}" data-occ="${it.occ}"
      style="--cat:var(--c-${it.cat});top:${top}px;height:${h}px;left:calc(${it._c / it._n * 100}% + 2px);width:calc(${100 / it._n}% - 4px)"
      title="${esc(it.name)} · ${time}"><span class="n">${esc(it.name)}</span>${h > 34 ? `<span class="t">${time}${it.repeat ? ' ↻' : ''}</span>` : ''}</button>`;
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
    <li class="${it.done ? 'done' : ''}" style="--cat:var(--c-${it.cat})">
      <input type="checkbox" data-toggle="${it.id}" data-occ="${it.occ}" ${it.done ? 'checked' : ''} aria-label="Mark ${esc(it.name)} done">
      <span class="dot"></span>
      <span class="item"><span class="time">${fmt(it.start)}–${fmt(it.end)}${it.repeat ? ' · repeats' : ''}</span>
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
