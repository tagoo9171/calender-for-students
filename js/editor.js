// The add / edit task dialog

import { fmt, toMin, dateKey } from './time.js';
import { validate } from './store.js';

const $ = id => document.getElementById(id);

export function createEditor({ onSave, onSaveOne, onDelete, onSkip }) {
  const dlg = $('editor');
  let editing = null; // { task, occ } when editing, null when adding
  let pending = null; // checked form data, waiting for "only this day" or "every repeat"

  const repeatBoxes = () => [...dlg.querySelectorAll('[name=repeat]')];
  const repeatOn = () => $('edRepeat').checked;

  function syncRepeat() {
    $('edDays').hidden = !repeatOn();
    $('edDateLbl').firstChild.textContent = repeatOn() ? 'Starts on' : 'Date';
  }
  $('edRepeat').addEventListener('change', () => {
    if (repeatOn() && !repeatBoxes().some(b => b.checked)) {
      const wd = new Date($('edDate').value + 'T00:00').getDay();
      repeatBoxes().forEach(b => { b.checked = Number(b.value) === wd; });
    }
    syncRepeat();
  });
  dlg.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const days = b.dataset.preset.split(',');
    repeatBoxes().forEach(x => { x.checked = days.includes(x.value); });
  }));
  // Any change after "Save" asks again, so the choice always matches the form
  $('editForm').addEventListener('input', () => { $('saveConfirm').hidden = true; pending = null; });

  function open({ task = null, occ = null, date, start = 540, repeat = false }) {
    editing = task ? { task, occ } : null;
    $('edTitle').textContent = task ? 'Edit task' : 'New task';
    $('edName').value = task?.name ?? '';
    $('edDate').value = task ? task.date : date;
    $('edStart').value = fmt(task?.start ?? start);
    $('edEnd').value = fmt((task?.end ?? Math.min(start + 60, 1440)) % 1440);
    $('edCat').value = task?.cat ?? 'work';
    $('edRepeat').checked = !!task?.repeat || repeat;
    const wd = new Date((task ? task.date : date) + 'T00:00').getDay();
    repeatBoxes().forEach(b => { b.checked = task ? !!task.repeat?.includes(Number(b.value)) : repeat && Number(b.value) === wd; });
    $('edEvery').value = String(task?.every || 1);
    $('edUntil').value = task?.until ?? '';
    $('edErr').hidden = true;
    $('edNote').hidden = !task?.repeat;
    $('edNote').textContent = 'This task repeats. When you save, you can change only this day or every repeat.';
    $('saveConfirm').hidden = true;
    pending = null;
    $('edDelete').hidden = !task;
    $('delConfirm').hidden = true;
    syncRepeat();
    dlg.showModal();
    if (!task) $('edName').focus();
  }

  $('editForm').addEventListener('submit', e => {
    e.preventDefault();
    let end = toMin($('edEnd').value);
    if (end === 0) end = 1440; // "00:00" as an end time means midnight
    const data = {
      name: $('edName').value.trim(),
      date: $('edDate').value || dateKey(new Date()),
      start: toMin($('edStart').value),
      end,
      cat: $('edCat').value,
      repeat: repeatOn() ? repeatBoxes().filter(b => b.checked).map(b => Number(b.value)) : null,
      every: repeatOn() ? Number($('edEvery').value) : 1,
      until: repeatOn() ? $('edUntil').value || null : null,
      ex: false,
    };
    const err = validate(data);
    if (err) { $('edErr').textContent = err; $('edErr').hidden = false; return; }
    $('edErr').hidden = true;
    if (editing?.task.repeat && editing.occ) {
      pending = data;
      $('delConfirm').hidden = true;
      $('saveConfirm').hidden = false;
      return;
    }
    onSave(editing?.task.id ?? null, data);
    dlg.close();
  });

  $('saveOne').addEventListener('click', () => { onSaveOne(editing.task.id, editing.occ, pending); dlg.close(); });
  $('saveAll').addEventListener('click', () => { onSave(editing.task.id, pending); dlg.close(); });

  $('edCancel').addEventListener('click', () => dlg.close());

  $('edDelete').addEventListener('click', () => {
    if (editing.task.repeat) { $('saveConfirm').hidden = true; $('delConfirm').hidden = false; return; }
    onDelete(editing.task.id);
    dlg.close();
  });
  $('delOne').addEventListener('click', () => { onSkip(editing.task.id, editing.occ); dlg.close(); });
  $('delAll').addEventListener('click', () => { onDelete(editing.task.id); dlg.close(); });

  return { open };
}
