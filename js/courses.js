// The add / edit course dialog

import { COURSE_COLORS } from './store.js';

const $ = id => document.getElementById(id);

export function createCourseEditor({ onSave, onDelete, lessonCount }) {
  const dlg = $('courseDlg');
  let editing = null; // the course being edited, null when adding

  $('coColors').innerHTML = COURSE_COLORS.map((c, i) => `
    <label><input type="radio" name="coColor" value="${c}" aria-label="Color ${i + 1}"><span style="--sw:${c}"></span></label>`).join('');

  function open(course = null, nextColor = COURSE_COLORS[0]) {
    editing = course;
    $('coTitle').textContent = course ? 'Edit course' : 'New course';
    $('coName').value = course?.name ?? '';
    $('coTeacher').value = course?.teacher ?? '';
    const color = course?.color ?? nextColor;
    dlg.querySelectorAll('[name=coColor]').forEach(r => { r.checked = r.value === color; });
    $('coErr').hidden = true;
    $('coDelete').hidden = !course;
    $('coDelConfirm').hidden = true;
    dlg.showModal();
    if (!course) $('coName').focus();
  }

  $('courseForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('coName').value.trim();
    if (!name) { $('coErr').textContent = 'Give the course a name.'; $('coErr').hidden = false; return; }
    const color = dlg.querySelector('[name=coColor]:checked')?.value ?? COURSE_COLORS[0];
    onSave(editing?.id ?? null, { name, teacher: $('coTeacher').value.trim(), color });
    dlg.close();
  });

  $('coCancel').addEventListener('click', () => dlg.close());
  $('coDelete').addEventListener('click', () => {
    const n = lessonCount(editing.id);
    if (!n) { onDelete(editing.id); dlg.close(); return; }
    $('coDelMsg').textContent = `This also deletes its ${n === 1 ? 'lesson' : n + ' lessons'}.`;
    $('coDelConfirm').hidden = false;
  });
  $('coDelYes').addEventListener('click', () => { onDelete(editing.id); dlg.close(); });

  return { open };
}
