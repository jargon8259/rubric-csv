/**
 * export-csv.js
 * Builds the Canvas rubric CSV and provides download and copy helpers.
 * `buildCsv` and `fileNameFor` contain no page code and can be tested in Node.
 */

import { LEVELS, CSV_FIXED_HEADERS, CSV_RATING_HEADERS } from './constants.js';
import { isBlankCriterion, isWholeNumber, scoresFor } from './model.js';

/**
 * Wraps a value in quotes when it contains a comma, quote, or line break.
 * @param {*} v
 * @returns {string}
 */
export function csvField(v) {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Builds the CSV text. Each filled-in criterion becomes one row. Only levels
 * with text are written, in this order: Competent, Approaching Competency,
 * Not Competent, Not Submitted. A blank level creates no rating at all.
 * A points value that is not a whole number is written as 0 (the editor warns about it).
 * @param {{name: string, criteria: object[]}} rubric
 * @returns {string} CSV text with CRLF line endings.
 */
export function buildCsv(rubric) {
  let maxGroups = 0;
  const rows = rubric.criteria
    .filter((c) => !isBlankCriterion(c))
    .map((c) => {
      const points = isWholeNumber(c.points) ? parseInt(c.points, 10) : 0;
      const scores = scoresFor(points);
      const fields = [rubric.name.trim(), c.name, '', 'false'];
      let groups = 0;
      LEVELS.forEach((l) => {
        if (String(c[l.key]).trim() !== '') {
          fields.push(l.label, c[l.key], String(scores[l.key]));
          groups++;
        }
      });
      maxGroups = Math.max(maxGroups, groups);
      return fields;
    });

  const header = CSV_FIXED_HEADERS.slice();
  for (let g = 0; g < maxGroups; g++) header.push(...CSV_RATING_HEADERS);

  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/**
 * Makes a safe file name from the rubric name.
 * @param {string} rubricName
 * @returns {string} For example "My Rubric.csv". Falls back to "rubric.csv".
 */
export function fileNameFor(rubricName) {
  // eslint-disable-next-line no-control-regex
  const safe = rubricName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim();
  return (safe || 'rubric') + '.csv';
}

/**
 * Downloads the CSV through the browser.
 * @param {{name: string, criteria: object[]}} rubric
 */
export function downloadCsv(rubric) {
  const blob = new Blob([buildCsv(rubric)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNameFor(rubric.name);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copies the CSV text to the clipboard. Falls back to an older method when the
 * modern clipboard is not available.
 * @param {{name: string, criteria: object[]}} rubric
 * @returns {Promise<boolean>} True if the copy worked.
 */
export async function copyCsv(rubric) {
  const text = buildCsv(rubric);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      /* fall through to the older method */
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
