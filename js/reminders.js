// Reminders fire while the app is open (in a tab or installed).
// Browsers don't let a web app wake itself up later without a push server.

import { dateKey, nowMinutes, fmt } from './time.js';
import { dayItems } from './store.js';

const SENT_KEY = 'daybook:sent';

// Tasks that start within `lead` minutes and haven't been announced yet
export function dueReminders(items, nowMin, lead, sent) {
  if (!lead) return [];
  return items.filter(it =>
    !it.done && nowMin >= it.start - lead && nowMin < it.start && !sent.has(it.id + '|' + it.occ));
}

function loadSent(today) {
  try {
    const s = JSON.parse(localStorage.getItem(SENT_KEY));
    if (s && s.date === today) return new Set(s.keys);
  } catch { /* start fresh */ }
  return new Set();
}

function saveSent(today, sent) {
  try { localStorage.setItem(SENT_KEY, JSON.stringify({ date: today, keys: [...sent] })); } catch { /* ignore */ }
}

export const notificationsSupported = () => 'Notification' in window;

export async function askPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export async function notify(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: title });
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch { /* the in-app toast still shows */ }
}

export function startReminders(getState, showToast) {
  const check = () => {
    const state = getState();
    const today = dateKey(new Date());
    const sent = loadSent(today);
    const due = dueReminders(dayItems(state, today), nowMinutes(), state.settings.remind, sent);
    for (const it of due) {
      sent.add(it.id + '|' + it.occ);
      const mins = it.start - nowMinutes();
      const when = mins <= 1 ? 'starts now' : `starts in ${mins} min`;
      notify(it.name, `${when} · ${fmt(it.start)}–${fmt(it.end)}`);
      showToast(`⏰ ${it.name} ${when}`);
    }
    if (due.length) saveSent(today, sent);
  };
  check();
  setInterval(check, 20000);
}
