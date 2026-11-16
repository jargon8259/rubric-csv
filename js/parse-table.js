/**
 * parse-table.js
 * Turns a grid of cell text (an array of rows, each an array of strings) into
 * criteria. Used for tables pasted from Word and for tables read from .docx files.
 * Contains no page code.
 */

import { LEVELS } from './constants.js';
import { blankCriterion, isBlankCriterion, cleanText } from './model.js';

/**
 * Reads a header row and says which column holds which field.
 * Returns null unless both a criterion-name column and a Competent column are found.
 * @param {string[]} cells Text of one row.
 * @returns {object|null} Map such as { name: 0, points: 1, competent: 2, ... }
 */
export function mapHeader(cells) {
  const map = {};
  cells.forEach((cell, j) => {
    const n = cleanText(cell).toLowerCase();
    if (!n) return;
    // Order matters: "not submitted" and "not competent" must be tested before "competent".
    if (n.includes('criterion') || n.includes('criteria')) map.name = j;
    else if (n === 'pts' || n.startsWith('point')) map.points = j;
    else if (n.includes('not submitted')) map.notSubmitted = j;
    else if (n.includes('not competent')) map.notCompetent = j;
    else if (n.includes('approaching')) map.approaching = j;
    else if (n.includes('competent')) map.competent = j;
  });
  return map.name !== undefined && map.competent !== undefined ? map : null;
}

/**
 * Converts one grid to criteria. Finds the header row by column names (not by
 * position), reads the rows below it, and drops rows with nothing in them.
 * If no header row exists, columns are read in this order: name, points,
 * Competent, Approaching, Not Competent, Not Submitted.
 * @param {string[][]} grid
 * @returns {{criteria: object[], usedHeader: boolean}}
 */
export function gridToCriteria(grid) {
  let headerIndex = -1;
  let map = null;
  for (let i = 0; i < grid.length; i++) {
    map = mapHeader(grid[i]);
    if (map) {
      headerIndex = i;
      break;
    }
  }
  const usedHeader = headerIndex !== -1;
  if (!usedHeader) {
    map = { name: 0, points: 1, competent: 2, approaching: 3, notCompetent: 4, notSubmitted: 5 };
  }

  const criteria = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i];
    const c = blankCriterion();
    c.name = cleanText(row[map.name]);
    c.points = map.points === undefined ? '' : cleanText(row[map.points]);
    LEVELS.forEach((l) => {
      c[l.key] = map[l.key] === undefined ? '' : cleanText(row[map[l.key]]);
    });
    if (!isBlankCriterion(c)) criteria.push(c);
  }
  return { criteria, usedHeader };
}

/**
 * Chooses which table in a document is the rubric. Prefers a table with a
 * recognizable header row. Otherwise accepts a table whose first row has at
 * least six columns.
 * @param {string[][][]} grids Every table found, each as a grid.
 * @returns {{index: number, criteria: object[], usedHeader: boolean}|null}
 */
export function pickTable(grids) {
  for (let i = 0; i < grids.length; i++) {
    if (grids[i].some((row) => mapHeader(row))) return { index: i, ...gridToCriteria(grids[i]) };
  }
  for (let i = 0; i < grids.length; i++) {
    if (grids[i].length && grids[i][0].length >= 6) return { index: i, ...gridToCriteria(grids[i]) };
  }
  return null;
}
