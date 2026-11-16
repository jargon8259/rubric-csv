/**
 * model.js
 * The rubric data shape, the scoring rule, text cleanup, and validation.
 * Contains no page code, so it can be tested in Node.
 *
 * Rubric shape:
 *   { name: string, criteria: Criterion[] }
 * Criterion shape (all values are strings so the editor can hold partial input):
 *   { name, points, competent, approaching, notCompetent, notSubmitted }
 */

import { LEVELS } from './constants.js';

/** @returns {object} A new, empty criterion. */
export function blankCriterion() {
  return { name: '', points: '', competent: '', approaching: '', notCompetent: '', notSubmitted: '' };
}

/** @returns {{name: string, criteria: object[]}} A new rubric with one empty row. */
export function blankRubric() {
  return { name: '', criteria: [blankCriterion()] };
}

/**
 * True when every field of the criterion is empty or only whitespace.
 * @param {object} c A criterion.
 * @returns {boolean}
 */
export function isBlankCriterion(c) {
  const fields = ['name', 'points'].concat(LEVELS.map((l) => l.key));
  return fields.every((f) => String(c[f] == null ? '' : c[f]).trim() === '');
}

/**
 * True when the rubric has a name or at least one filled-in criterion.
 * @param {{name: string, criteria: object[]}} rubric
 * @returns {boolean}
 */
export function hasContent(rubric) {
  return rubric.name.trim() !== '' || rubric.criteria.some((c) => !isBlankCriterion(c));
}

/**
 * True when the value is a whole number made only of digits (0, 1, 25...).
 * Negative numbers and decimals are not accepted.
 * @param {string|number} v
 * @returns {boolean}
 */
export function isWholeNumber(v) {
  return /^\d+$/.test(String(v).trim());
}

/**
 * Points for the Approaching Competency level: half of the full points, rounded up.
 * @param {number} points Full points for the criterion (a whole number).
 * @returns {number}
 */
export function approachingPoints(points) {
  return Math.ceil(points / 2);
}

/**
 * Points earned at each level for a criterion worth `points`.
 * Competent earns full points, Approaching earns half rounded up, and
 * Not Competent and Not Submitted each earn zero.
 * @param {number} points
 * @returns {{competent: number, approaching: number, notCompetent: number, notSubmitted: number}}
 */
export function scoresFor(points) {
  return {
    competent: points,
    approaching: approachingPoints(points),
    notCompetent: 0,
    notSubmitted: 0
  };
}

/**
 * Tidies text coming from Word or a CSV: turns non-breaking spaces into normal
 * spaces, collapses repeated spaces, trims each line, and keeps line breaks.
 * @param {*} s
 * @returns {string}
 */
export function cleanText(s) {
  return String(s == null ? '' : s)
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Checks the rubric and returns plain-language warnings plus the total points.
 * Warnings never block export. A blank rating level is never a warning,
 * because skipping a level is allowed.
 * @param {{name: string, criteria: object[]}} rubric
 * @returns {{warnings: string[], totalPoints: number}}
 */
export function validate(rubric) {
  const warnings = [];
  let totalPoints = 0;
  let counted = 0;

  if (rubric.name.trim() === '') warnings.push('Rubric name is missing.');

  rubric.criteria.forEach((c, i) => {
    if (isBlankCriterion(c)) return;
    counted++;
    const n = i + 1;
    if (String(c.name).trim() === '') warnings.push(`Criterion ${n} has no name.`);
    if (!isWholeNumber(c.points)) warnings.push(`Criterion ${n} points must be a whole number.`);
    else totalPoints += parseInt(c.points, 10);
    const anyLevel = LEVELS.some((l) => String(c[l.key]).trim() !== '');
    if (!anyLevel) warnings.push(`Criterion ${n} has no rating text.`);
    else if (String(c.competent).trim() === '') {
      warnings.push(`Criterion ${n} has a rating level filled in but no Competent text.`);
    }
  });

  if (counted === 0) warnings.push('There are no criteria yet.');
  return { warnings, totalPoints };
}
