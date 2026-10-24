// Small date and time helpers. Times of day are stored as minutes after midnight (0–1440).

export const pad = n => String(n).padStart(2, '0');

export const toMin = s => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export const fmt = m => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);

// "YYYY-MM-DD" in local time, used as the key for a calendar day
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = k => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Weeks start on Monday
export const startOfWeek = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return addDays(x, -((x.getDay() + 6) % 7));
};

export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

export const hoursLabel = m => {
  const h = m / 60;
  return (Number.isInteger(h) ? h : h.toFixed(1)) + 'h';
};

// Gives each item a column (_c) and a column count (_n) so overlapping
// items sit side by side. Items must be sorted by start time.
export function columns(items) {
  const out = [];
  let group = [], groupEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of group) {
      let c = cols.findIndex(end => end <= it.start);
      if (c < 0) { c = cols.length; cols.push(0); }
      cols[c] = it.end;
      it._c = c;
    }
    for (const it of group) it._n = cols.length;
    out.push(...group);
    group = [];
  };
  for (const it of items.map(x => ({ ...x }))) {
    if (group.length && it.start >= groupEnd) { flush(); groupEnd = -1; }
    group.push(it);
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length) flush();
  return out;
}
