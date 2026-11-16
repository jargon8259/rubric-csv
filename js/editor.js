/**
 * editor.js
 * Draws the editable rubric table and keeps the rubric object in step with
 * what the user types. Browser only.
 *
 * Each cell is a real form control with an accessible label. On narrow screens
 * the CSS turns each row into a card and shows `data-label` above each field.
 */

import { LEVELS } from './constants.js';
import { blankCriterion, isWholeNumber, approachingPoints } from './model.js';

/** Grows a textarea to fit its text. */
function autosize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

/**
 * Updates the small "Approaching = N" note under each Points box.
 * @param {HTMLElement} tbody
 * @param {{criteria: object[]}} rubric
 */
export function refreshNotes(tbody, rubric) {
  tbody.querySelectorAll('tr').forEach((tr, i) => {
    const note = tr.querySelector('.points-note');
    const c = rubric.criteria[i];
    if (!note || !c) return;
    note.textContent = isWholeNumber(c.points) ? 'Approaching = ' + approachingPoints(parseInt(c.points, 10)) : '';
  });
}

/**
 * Builds the table rows from the rubric. Call again after rows are added,
 * deleted, or replaced by an import.
 * @param {HTMLElement} tbody The <tbody> to fill.
 * @param {{criteria: object[]}} rubric Edited in place as the user types.
 * @param {function(): void} onChange Called after any edit or row change.
 */
export function renderEditor(tbody, rubric, onChange) {
  tbody.textContent = '';
  if (!rubric.criteria.length) rubric.criteria.push(blankCriterion());

  rubric.criteria.forEach((criterion, index) => {
    const tr = document.createElement('tr');
    const rowNumber = index + 1;

    /** Adds one cell holding a text control bound to `field`. */
    function addCell(field, label, { multiline = true, className = '' } = {}) {
      const td = document.createElement('td');
      td.dataset.label = label;
      if (className) td.className = className;

      const control = document.createElement(multiline ? 'textarea' : 'input');
      if (multiline) control.rows = 1;
      else {
        control.type = 'text';
        control.inputMode = 'numeric';
      }
      control.value = criterion[field];
      control.setAttribute('aria-label', `${label}, criterion ${rowNumber}`);
      control.addEventListener('input', () => {
        criterion[field] = control.value;
        if (multiline) autosize(control);
        refreshNotes(tbody, rubric);
        onChange();
      });
      td.appendChild(control);
      tr.appendChild(td);
      return td;
    }

    addCell('name', 'Criterion Name');
    const pointsCell = addCell('points', 'Points', { multiline: false, className: 'points-cell' });
    const note = document.createElement('div');
    note.className = 'points-note';
    pointsCell.appendChild(note);
    LEVELS.forEach((l) => addCell(l.key, l.label));

    const actionCell = document.createElement('td');
    actionCell.className = 'action-cell';
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'button button-small';
    del.textContent = 'Delete row';
    del.setAttribute('aria-label', `Delete criterion ${rowNumber}`);
    del.addEventListener('click', () => {
      rubric.criteria.splice(index, 1);
      renderEditor(tbody, rubric, onChange);
      onChange();
    });
    actionCell.appendChild(del);
    tr.appendChild(actionCell);

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('textarea').forEach(autosize);
  refreshNotes(tbody, rubric);
}
