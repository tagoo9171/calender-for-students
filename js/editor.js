// The add / edit task dialog

import { fmt, toMin, dateKey } from './time.js';
import { validate } from './store.js';

const $ = id => document.getElementById(id);

export function createEditor({ onSave, onDelete, onSkip }) {
  const dlg = $('editor');
  let editing = null; // { task, occ } when editing, null when adding

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

  function open({ task = null, occ = null, date, start = 540 }) {
    editing = task ? { task, occ } : null;
    $('edTitle').textContent = task ? 'Edit task' : 'New task';
    $('edName').value = task?.name ?? '';
    $('edDate').value = task ? task.date : date;
    $('edStart').value = fmt(task?.start ?? start);
    $('edEnd').value = fmt((task?.end ?? Math.min(start + 60, 1440)) % 1440);
    $('edCat').value = task?.cat ?? 'work';
    $('edRepeat').checked = !!task?.repeat;
    repeatBoxes().forEach(b => { b.checked = !!task?.repeat?.includes(Number(b.value)); });
    $('edErr').hidden = true;
    $('edNote').hidden = !task?.repeat;
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
      ex: false,
    };
    const err = validate(data);
    if (err) { $('edErr').textContent = err; $('edErr').hidden = false; return; }
    onSave(editing?.task.id ?? null, data);
    dlg.close();
  });

  $('edCancel').addEventListener('click', () => dlg.close());

  $('edDelete').addEventListener('click', () => {
    if (editing.task.repeat) { $('delConfirm').hidden = false; return; }
    onDelete(editing.task.id);
    dlg.close();
  });
  $('delOne').addEventListener('click', () => { onSkip(editing.task.id, editing.occ); dlg.close(); });
  $('delAll').addEventListener('click', () => { onDelete(editing.task.id); dlg.close(); });

  return { open };
}
