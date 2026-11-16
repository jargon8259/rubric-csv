/**
 * app.js
 * Entry point. Connects the page's buttons to the import, editor, validation,
 * and export modules. Holds the one rubric the user is working on.
 *
 * Flow: an import produces { name, criteria, note }. If the editor already has
 * content, the user chooses "Replace" or "Add to the end" on the page (no popups).
 */

import { STORAGE_KEY } from './constants.js';
import { blankRubric, blankCriterion, isBlankCriterion, hasContent, validate } from './model.js';
import { renderEditor } from './editor.js';
import { importFromPaste, importFromDocx } from './import-word.js';
import { csvToRubric } from './import-csv.js';
import { buildCsv, downloadCsv, copyCsv } from './export-csv.js';

const $ = (id) => document.getElementById(id);

/** The rubric being edited. Replaced or changed by imports and typing. */
let rubric = loadSession() || blankRubric();
/** An import waiting for the user to choose Replace or Add. */
let pendingImport = null;

/* ------------------------------------------------------------------ */
/* Session storage (kept only while this browser tab is open)          */
/* ------------------------------------------------------------------ */

function loadSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved.name === 'string' && Array.isArray(saved.criteria)) {
      return { name: saved.name, criteria: saved.criteria.map((c) => Object.assign(blankCriterion(), c)) };
    }
  } catch (e) {
    /* ignore: storage can be blocked */
  }
  return null;
}

function saveSession() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rubric));
  } catch (e) {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Messages and status                                                 */
/* ------------------------------------------------------------------ */

function showMessage(text, kind = 'info') {
  const box = $('message');
  box.textContent = text;
  box.className = 'message message-' + kind;
  box.hidden = false;
}

function clearMessage() {
  $('message').hidden = true;
}

/** Re-checks the rubric and refreshes the status box, total, and CSV preview. */
function refresh() {
  const { warnings, totalPoints } = validate(rubric);
  $('total').textContent = 'Total rubric points: ' + totalPoints;

  const status = $('status');
  status.textContent = '';
  const box = document.createElement('div');
  if (warnings.length) {
    box.className = 'status-warn';
    const title = document.createElement('strong');
    title.textContent = 'Things to look at (you can still export):';
    const list = document.createElement('ul');
    warnings.forEach((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      list.appendChild(li);
    });
    box.append(title, list);
  } else {
    box.className = 'status-ok';
    box.textContent = '\u2713 Ready to export.';
  }
  status.appendChild(box);

  $('csv-preview').textContent = buildCsv(rubric);
  saveSession();
}

/** Redraws the table from the current rubric. */
function redrawEditor() {
  $('rubric-name').value = rubric.name;
  renderEditor($('criteria-body'), rubric, refresh);
  refresh();
}

/* ------------------------------------------------------------------ */
/* Import flow                                                         */
/* ------------------------------------------------------------------ */

function closePanels() {
  $('panel-paste-word').hidden = true;
  $('panel-paste-csv').hidden = true;
}

/**
 * Starts an import. Applies it straight away when the editor is empty;
 * otherwise asks whether to replace or add.
 */
function queueImport(imported, note) {
  if (!hasContent(rubric)) {
    applyImport(imported, 'replace', note);
    return;
  }
  pendingImport = { imported, note };
  const count = imported.criteria.filter((c) => !isBlankCriterion(c)).length;
  $('import-choice-text').textContent = count
    ? `Ready to bring in ${count} criteria. You already have a rubric in the editor. What should happen?`
    : 'You already have a rubric in the editor. What should happen?';
  $('import-choice').hidden = false;
  closePanels();
  $('btn-replace').focus();
}

function applyImport(imported, mode, note) {
  if (mode === 'replace') {
    rubric = { name: imported.name, criteria: imported.criteria.slice() };
  } else {
    const kept = rubric.criteria.filter((c) => !isBlankCriterion(c));
    rubric = {
      name: rubric.name.trim() ? rubric.name : imported.name,
      criteria: kept.concat(imported.criteria)
    };
  }
  if (!rubric.criteria.length) rubric.criteria.push(blankCriterion());

  pendingImport = null;
  $('import-choice').hidden = true;
  closePanels();
  $('word-paste-box').textContent = '';
  $('csv-paste-box').value = '';
  redrawEditor();
  showMessage(note, 'info');
}

/** Builds the "what was read" note shown after an import. */
function importNote(source, imported, extra = '') {
  const n = imported.criteria.length;
  let note = `Read ${n} ${n === 1 ? 'criterion' : 'criteria'} from ${source}.`;
  if (imported.usedHeader === false) note += ' No column names were found, so columns were read in order.';
  if (!imported.name && source !== 'the CSV') note += ' No rubric name was found, so type it in Step 2 if you need one.';
  return (note + extra + ' Check the table below, then export.').replace(/\s+/g, ' ');
}

async function handleDocxFile(file) {
  try {
    const imported = await importFromDocx(file);
    queueImport(imported, importNote('the Word file', imported));
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function handleCsvText(text) {
  try {
    const imported = csvToRubric(text);
    let extra = ' Points were taken from the Competent rating, and the other levels were recalculated.';
    if (imported.unmatched.length) {
      extra += ' These rating names did not match one of the four levels and were left out: ' + imported.unmatched.join(', ') + '.';
    }
    queueImport(imported, importNote('the CSV', imported, extra));
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

$('btn-paste-word').addEventListener('click', () => {
  $('panel-paste-csv').hidden = true;
  $('panel-paste-word').hidden = !$('panel-paste-word').hidden;
  clearMessage();
  $('word-paste-box').focus();
});

$('btn-paste-csv').addEventListener('click', () => {
  $('panel-paste-word').hidden = true;
  $('panel-paste-csv').hidden = !$('panel-paste-csv').hidden;
  clearMessage();
  $('csv-paste-box').focus();
});

$('btn-upload-word').addEventListener('click', () => $('file-word').click());
$('btn-upload-csv').addEventListener('click', () => $('file-csv').click());

$('btn-blank').addEventListener('click', () => {
  clearMessage();
  const blank = { name: '', criteria: [blankCriterion()], usedHeader: true };
  queueImport(blank, 'Blank rubric ready. Type the rubric name, then fill in the first row.');
  if (!pendingImport) $('rubric-name').focus();
});

// The paste box reads the clipboard's HTML table. Typing is blocked so only pasting works.
$('word-paste-box').addEventListener('paste', (e) => {
  e.preventDefault();
  const data = e.clipboardData || window.clipboardData;
  try {
    const imported = importFromPaste(data.getData('text/html'), data.getData('text/plain') || data.getData('Text'));
    queueImport(imported, importNote('the pasted table', imported));
  } catch (err) {
    showMessage(err.message, 'error');
  }
});
$('word-paste-box').addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey || e.key === 'Tab')) e.preventDefault();
});

$('btn-load-csv').addEventListener('click', () => {
  const text = $('csv-paste-box').value;
  if (!text.trim()) {
    showMessage('Paste the CSV text into the box first.', 'error');
    return;
  }
  handleCsvText(text);
});

$('file-word').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handleDocxFile(file);
});

$('file-csv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) handleCsvText(await file.text());
});

$('btn-replace').addEventListener('click', () => {
  if (pendingImport) applyImport(pendingImport.imported, 'replace', pendingImport.note);
});
$('btn-append').addEventListener('click', () => {
  if (pendingImport) applyImport(pendingImport.imported, 'append', pendingImport.note);
});
$('btn-cancel-import').addEventListener('click', () => {
  pendingImport = null;
  $('import-choice').hidden = true;
  showMessage('Import canceled. Your rubric was not changed.', 'info');
});

$('rubric-name').addEventListener('input', (e) => {
  rubric.name = e.target.value;
  refresh();
});

$('btn-add-row').addEventListener('click', () => {
  rubric.criteria.push(blankCriterion());
  redrawEditor();
  const rows = $('criteria-body').querySelectorAll('tr');
  const first = rows[rows.length - 1].querySelector('textarea');
  if (first) first.focus();
});

$('btn-clear').addEventListener('click', () => {
  $('clear-confirm').hidden = false;
  $('btn-clear-yes').focus();
});
$('btn-clear-no').addEventListener('click', () => {
  $('clear-confirm').hidden = true;
});
$('btn-clear-yes').addEventListener('click', () => {
  rubric = blankRubric();
  $('clear-confirm').hidden = true;
  redrawEditor();
  showMessage('The rubric was cleared.', 'info');
});

$('btn-download').addEventListener('click', () => downloadCsv(rubric));

$('btn-copy').addEventListener('click', async () => {
  const ok = await copyCsv(rubric);
  const note = $('copy-note');
  note.textContent = ok ? 'Copied.' : 'Copy did not work. Open Preview CSV, select the text, and copy it.';
  note.className = ok ? 'copy-ok' : 'copy-fail';
  setTimeout(() => {
    note.textContent = '';
  }, 3500);
});

$('btn-preview').addEventListener('click', () => {
  const wrap = $('preview-wrap');
  wrap.hidden = !wrap.hidden;
  $('btn-preview').setAttribute('aria-expanded', String(!wrap.hidden));
});

redrawEditor();
