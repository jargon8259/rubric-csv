/**
 * constants.js
 * Fixed values shared across the app: the four rating levels, the Canvas CSV
 * column names, and a few small settings. Nothing in this file touches the page.
 */

/**
 * The four rating levels, from highest to lowest.
 * `key` is the property name used on each criterion object.
 * `label` is the exact Rating Name written to the Canvas CSV and used as the
 * table column heading.
 */
export const LEVELS = [
  { key: 'competent', label: 'Competent' },
  { key: 'approaching', label: 'Approaching Competency' },
  { key: 'notCompetent', label: 'Not Competent' },
  { key: 'notSubmitted', label: 'Not Submitted' }
];

/** Columns that start every Canvas rubric CSV row. */
export const CSV_FIXED_HEADERS = [
  'Rubric Name',
  'Criteria Name',
  'Criteria Description',
  'Criteria Enable Range'
];

/** Three columns that repeat once for each rating included in a row. */
export const CSV_RATING_HEADERS = ['Rating Name', 'Rating Description', 'Rating Points'];

/** A rubric name equal to this text (any capitalization) is a template placeholder, not a real name. */
export const PLACEHOLDER_RUBRIC_NAME = 'Rubric Name';

/** Key used to keep the work-in-progress rubric for the length of the browser tab session. */
export const STORAGE_KEY = 'rubricConverter.session';
