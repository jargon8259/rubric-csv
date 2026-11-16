/**
 * import-csv.js
 * Reads a Canvas rubric CSV (pasted or uploaded) and rebuilds the rubric.
 * Contains no page code.
 *
 * Points rule: a criterion's Points value is taken from its Competent rating.
 * If there is no Competent rating, the highest rating points are used.
 * Every other level is recalculated at export time using the scoring rule.
 */

import { blankCriterion, isBlankCriterion, cleanText } from './model.js';

/**
 * Parses CSV text, including quoted fields with commas, quotes, and line breaks.
 * Rows with no content are dropped.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const t = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Matches a Rating Name to one of the four level keys.
 * @param {string} name
 * @returns {string|null} A level key, or null when nothing matches.
 */
export function matchLevel(name) {
  const n = name.toLowerCase();
  if (n.includes('not submitted')) return 'notSubmitted';
  if (n.includes('not competent')) return 'notCompetent';
  if (n.includes('approaching')) return 'approaching';
  if (n.includes('competent')) return 'competent';
  return null;
}

/**
 * Converts Canvas rubric CSV text into a rubric.
 * @param {string} text
 * @returns {{name: string, criteria: object[], unmatched: string[]}}
 * @throws {Error} With a plain-language message when the text is not a usable rubric CSV.
 */
export function csvToRubric(text) {
  const data = parseCsv(text);
  if (data.length < 2 || !(data[0][0] || '').toLowerCase().includes('rubric name')) {
    throw new Error('This does not look like a Canvas rubric CSV. The first row should start with "Rubric Name, Criteria Name, ...".');
  }

  let name = '';
  const criteria = [];
  const unmatched = [];

  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    if (!name && (d[0] || '').trim()) name = cleanText(d[0]);

    const c = blankCriterion();
    c.name = cleanText(d[1]);
    const seen = {};
    let competentPts = null;
    let highestPts = null;

    // Ratings start at column 5 (index 4) and repeat in groups of three.
    for (let k = 4; k < d.length; k += 3) {
      const ratingName = (d[k] || '').trim();
      const ratingDesc = d[k + 1] || '';
      const ratingPts = (d[k + 2] || '').trim();
      if (!ratingName && !ratingDesc.trim()) continue;
      const level = matchLevel(ratingName);
      if (!level || seen[level]) {
        unmatched.push(ratingName || '(no name)');
        continue;
      }
      seen[level] = true;
      c[level] = cleanText(ratingDesc);
      if (/^\d+$/.test(ratingPts)) {
        const n = parseInt(ratingPts, 10);
        if (level === 'competent') competentPts = n;
        if (highestPts === null || n > highestPts) highestPts = n;
      }
    }
    const pts = competentPts !== null ? competentPts : highestPts;
    c.points = pts === null ? '' : String(pts);
    if (!isBlankCriterion(c)) criteria.push(c);
  }

  if (!criteria.length) throw new Error('No criteria rows were found in that CSV.');
  return { name, criteria, unmatched };
}
