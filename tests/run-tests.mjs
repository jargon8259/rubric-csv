/**
 * run-tests.mjs
 * Checks the parts of the app that do not need a browser: scoring, validation,
 * header detection, CSV export, CSV import, and an export-then-import round trip.
 * Run with:  node tests/run-tests.mjs   (Node 18 or newer)
 */

import assert from 'node:assert/strict';
import { approachingPoints, scoresFor, validate, blankRubric, isWholeNumber, cleanText } from '../js/model.js';
import { mapHeader, gridToCriteria, pickTable } from '../js/parse-table.js';
import { buildCsv, fileNameFor } from '../js/export-csv.js';
import { csvToRubric, parseCsv } from '../js/import-csv.js';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

const crit = (o) => Object.assign({ name: '', points: '', competent: '', approaching: '', notCompetent: '', notSubmitted: '' }, o);

test('approaching points are half rounded up for 1 to 7', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(approachingPoints), [1, 1, 2, 2, 3, 3, 4]);
});

test('scoresFor gives full, half up, 0, 0', () => {
  assert.deepEqual(scoresFor(5), { competent: 5, approaching: 3, notCompetent: 0, notSubmitted: 0 });
});

test('whole-number check rejects decimals, negatives, and text', () => {
  assert.equal(isWholeNumber('4'), true);
  assert.equal(isWholeNumber(' 12 '), true);
  assert.equal(isWholeNumber('2.5'), false);
  assert.equal(isWholeNumber('-1'), false);
  assert.equal(isWholeNumber(''), false);
  assert.equal(isWholeNumber('four'), false);
});

test('cleanText fixes spaces and keeps line breaks', () => {
  assert.equal(cleanText('  a\u00a0 b  \n\n\n\n c '), 'a b\n\nc');
});

test('header detection finds columns by name, not position', () => {
  const map = mapHeader(['Not Submitted', 'Criterion Name', 'Not Competent', 'Competent', 'Points', 'Approaching Competency']);
  assert.deepEqual(map, { notSubmitted: 0, name: 1, notCompetent: 2, competent: 3, points: 4, approaching: 5 });
  assert.equal(mapHeader(['A', 'B', 'C']), null);
});

test('grid parsing drops blank rows and keeps empty levels', () => {
  const grid = [
    ['Criterion Name', 'Points', 'Competent', 'Approaching Competency', 'Not Competent', 'Not Submitted'],
    ['Safety', '4', 'Meets', '', 'Does not meet', 'None'],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', '']
  ];
  const { criteria, usedHeader } = gridToCriteria(grid);
  assert.equal(usedHeader, true);
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0].approaching, '');
});

test('grid without header is read in column order', () => {
  const { criteria, usedHeader } = gridToCriteria([['A', '3', 'c', 'a', 'nc', 'ns']]);
  assert.equal(usedHeader, false);
  assert.equal(criteria[0].notCompetent, 'nc');
});

test('pickTable skips a non-rubric table', () => {
  const other = [['Rating', 'Meaning'], ['1', 'x']];
  const rubric = [['Criterion Name', 'Points', 'Competent'], ['A', '2', 'ok']];
  assert.equal(pickTable([other, rubric]).index, 1);
});

test('export omits a blank level and writes the right points', () => {
  const csv = buildCsv({ name: 'Test', criteria: [crit({ name: 'Safety', points: '4', competent: 'Yes', notCompetent: 'No', notSubmitted: 'None' })] });
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines[0], 'Rubric Name,Criteria Name,Criteria Description,Criteria Enable Range,Rating Name,Rating Description,Rating Points,Rating Name,Rating Description,Rating Points,Rating Name,Rating Description,Rating Points');
  assert.equal(lines[1], 'Test,Safety,,false,Competent,Yes,4,Not Competent,No,0,Not Submitted,None,0');
  assert.ok(!csv.includes('Approaching'));
});

test('export with all four levels uses ceil(points/2) for Approaching', () => {
  const csv = buildCsv({ name: 'T', criteria: [crit({ name: 'X', points: '5', competent: 'a', approaching: 'b', notCompetent: 'c', notSubmitted: 'd' })] });
  assert.equal(csv.trimEnd().split('\r\n')[1], 'T,X,,false,Competent,a,5,Approaching Competency,b,3,Not Competent,c,0,Not Submitted,d,0');
});

test('export pads the header to the widest row and skips blank rows', () => {
  const csv = buildCsv({
    name: 'T',
    criteria: [crit({ name: 'A', points: '2', competent: 'a', notCompetent: 'b' }), crit({}), crit({ name: 'B', points: '2', competent: 'a', approaching: 'x', notCompetent: 'b', notSubmitted: 'c' })]
  });
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0].split(',').length, 4 + 12);
});

test('export quotes commas, quotes, and line breaks', () => {
  const csv = buildCsv({ name: 'T', criteria: [crit({ name: 'A, B', points: '1', competent: 'He said "ok"\nsecond line' })] });
  assert.ok(csv.includes('"A, B"'));
  assert.ok(csv.includes('"He said ""ok""\nsecond line"'));
});

test('round trip: export then import returns the same rubric', () => {
  const original = {
    name: 'My Rubric',
    criteria: [
      crit({ name: 'One, with comma', points: '5', competent: 'full', approaching: 'half', notCompetent: 'none', notSubmitted: 'missing' }),
      crit({ name: 'Two', points: '4', competent: 'yes\nsecond line', notCompetent: 'no', notSubmitted: 'none' })
    ]
  };
  const back = csvToRubric(buildCsv(original));
  assert.equal(back.name, 'My Rubric');
  assert.deepEqual(back.criteria, original.criteria);
  assert.deepEqual(back.unmatched, []);
  assert.equal(buildCsv({ name: back.name, criteria: back.criteria }), buildCsv(original));
});

test('CSV import takes points from Competent and recalculates the rest', () => {
  const text = 'Rubric Name,Criteria Name,Criteria Description,Criteria Enable Range,Rating Name,Rating Description,Rating Points,Rating Name,Rating Description,Rating Points\r\nR,C1,,false,Competent,yes,6,Not Competent,no,0\r\n';
  const r = csvToRubric(text);
  assert.equal(r.criteria[0].points, '6');
  assert.match(buildCsv(r), /Competent,yes,6,Not Competent,no,0/);
});

test('CSV import reports rating names it cannot match', () => {
  const text = 'Rubric Name,Criteria Name,Criteria Description,Criteria Enable Range,Rating Name,Rating Description,Rating Points,Rating Name,Rating Description,Rating Points\r\nR,C1,,false,Competent,yes,2,Excellent,great,3\r\n';
  const r = csvToRubric(text);
  assert.deepEqual(r.unmatched, ['Excellent']);
});

test('CSV import handles a BOM and rejects non-rubric CSV', () => {
  const ok = '\uFEFFRubric Name,Criteria Name\r\nR,C,,false,Competent,x,1\r\n';
  assert.equal(csvToRubric(ok).criteria.length, 1);
  assert.throws(() => csvToRubric('a,b\r\n1,2\r\n'), /does not look like/);
});

test('parseCsv handles quoted line breaks and escaped quotes', () => {
  assert.deepEqual(parseCsv('a,"b\nc","d ""e"""\n'), [['a', 'b\nc', 'd "e"']]);
});

test('validation: warnings, totals, and no warning for a blank level', () => {
  const ok = validate({ name: 'R', criteria: [crit({ name: 'A', points: '4', competent: 'x', notCompetent: 'y' })] });
  assert.deepEqual(ok.warnings, []);
  assert.equal(ok.totalPoints, 4);

  const bad = validate({ name: '', criteria: [crit({ name: '', points: '2.5', competent: 'x' }), crit({ name: 'B', points: '3' }), crit({ name: 'C', points: '1', approaching: 'z' })] });
  assert.deepEqual(bad.warnings, [
    'Rubric name is missing.',
    'Criterion 1 has no name.',
    'Criterion 1 points must be a whole number.',
    'Criterion 2 has no rating text.',
    'Criterion 3 has a rating level filled in but no Competent text.'
  ]);
  assert.deepEqual(validate(blankRubric()).warnings, ['Rubric name is missing.', 'There are no criteria yet.']);
});

test('file names drop characters that are not allowed', () => {
  assert.equal(fileNameFor(' My: Rubric/1? '), 'My Rubric1.csv');
  assert.equal(fileNameFor('   '), 'rubric.csv');
});

console.log(`\n${passed} checks passed.`);
