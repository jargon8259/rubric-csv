/**
 * import-word.js
 * Reads a rubric table from Word, either pasted from the clipboard or uploaded
 * as a .docx file. Browser only (uses DOMParser and DecompressionStream),
 * except `unzipEntry`, which also runs in Node for testing.
 *
 * Both functions return { name, criteria, usedHeader } or throw an Error whose
 * message is written for the person using the app.
 */

import { PLACEHOLDER_RUBRIC_NAME } from './constants.js';
import { cleanText } from './model.js';
import { pickTable } from './parse-table.js';

const HEADER_HELP =
  'Check that the first row has the column names: Criterion Name, Points, Competent, Approaching Competency, Not Competent, Not Submitted.';

/* ------------------------------------------------------------------ */
/* Paste from Word                                                     */
/* ------------------------------------------------------------------ */

/**
 * Gets the text of one HTML table cell, keeping paragraph and list-item breaks
 * as line breaks. Word cells with bullets break plain-text parsing, which is
 * why pasted HTML is read first.
 * @param {Element} el A <td> or <th>.
 * @returns {string}
 */
function htmlCellText(el) {
  let out = '';
  (function walk(node) {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        out += n.nodeValue.replace(/\s+/g, ' ');
      } else if (n.nodeType === 1) {
        const tag = n.tagName;
        if (tag === 'BR') {
          out += '\n';
          return;
        }
        const block = tag === 'P' || tag === 'DIV' || tag === 'LI';
        if (block && out && !out.endsWith('\n')) out += '\n';
        walk(n);
        if (block && out && !out.endsWith('\n')) out += '\n';
      }
    });
  })(el);
  return out;
}

/**
 * Finds every table in pasted HTML and returns each as a grid of text.
 * @param {string} html
 * @returns {string[][][]}
 */
function htmlToGrids(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const grids = [];
  doc.querySelectorAll('table').forEach((table) => {
    if (table.parentElement && table.parentElement.closest('table')) return; // skip nested tables
    const grid = [];
    table.querySelectorAll('tr').forEach((tr) => {
      if (tr.closest('table') !== table) return;
      const cells = [];
      Array.prototype.forEach.call(tr.children, (cell) => {
        if (cell.tagName === 'TD' || cell.tagName === 'TH') cells.push(htmlCellText(cell));
      });
      grid.push(cells);
    });
    grids.push(grid);
  });
  return grids;
}

/**
 * Imports a table pasted from Word (or Word Online).
 * Uses the HTML on the clipboard when there is a table in it, and tab-separated
 * text otherwise. A pasted table has no rubric name, so `name` is empty.
 * @param {string} html Clipboard "text/html".
 * @param {string} text Clipboard "text/plain".
 * @returns {{name: string, criteria: object[], usedHeader: boolean}}
 * @throws {Error}
 */
export function importFromPaste(html, text) {
  let grids = html ? htmlToGrids(html) : [];
  if (!grids.length && text) {
    grids = [text.split(/\r?\n/).map((line) => line.split('\t'))];
  }
  if (!grids.length) {
    throw new Error('No table was found in what you pasted. In Word, click inside the rubric table, select the whole table, copy it, and paste again.');
  }
  const picked = pickTable(grids);
  if (!picked || !picked.criteria.length) {
    throw new Error('A table was found, but no rubric rows could be read. ' + HEADER_HELP);
  }
  return { name: '', criteria: picked.criteria, usedHeader: picked.usedHeader };
}

/* ------------------------------------------------------------------ */
/* Upload .docx                                                        */
/* ------------------------------------------------------------------ */

/**
 * Reads one file out of a .docx (a zip archive) without any library.
 * Uses the central directory so it also works when sizes are stored after the data.
 * @param {ArrayBuffer} buf The whole .docx file.
 * @param {string} wanted Path inside the archive, e.g. "word/document.xml".
 * @returns {Promise<string>} The file's text.
 * @throws {Error} When the file is not a zip or the entry is missing.
 */
export async function unzipEntry(buf, wanted) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file.');

  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));

    if (name === wanted) {
      const localNameLen = dv.getUint16(localOffset + 26, true);
      const localExtraLen = dv.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const data = new Uint8Array(buf, start, compressedSize);
      if (method === 0) return decoder.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return decoder.decode(await new Response(stream).arrayBuffer());
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('Entry not found: ' + wanted);
}

/** @returns {Element[]} Direct children of `el` with the given local name. */
function childrenNamed(el, name) {
  return Array.prototype.filter.call(el.children, (c) => c.localName === name);
}

/** @returns {string} Text of one Word paragraph (w:p). */
function paragraphText(p) {
  let out = '';
  const all = p.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const name = all[i].localName;
    if (name === 't') out += all[i].textContent;
    else if (name === 'tab') out += ' ';
    else if (name === 'br') out += '\n';
  }
  return out;
}

/**
 * Walks the document body. Returns every top-level table as a grid, plus the
 * last non-empty paragraph that appeared just before each table.
 * A cell that spans several columns is padded with empty cells so columns line up.
 * Vertically merged cells are not handled.
 * @param {string} xml Contents of word/document.xml.
 * @returns {{grids: string[][][], precedingText: string[]}}
 */
function docxXmlToGrids(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = Array.prototype.find.call(doc.getElementsByTagName('*'), (e) => e.localName === 'body');
  if (!body) throw new Error('No body found.');

  const grids = [];
  const precedingText = [];
  let lastParagraph = '';

  Array.prototype.forEach.call(body.children, (node) => {
    if (node.localName === 'p') {
      const t = cleanText(paragraphText(node));
      if (t) lastParagraph = t;
    } else if (node.localName === 'tbl') {
      const grid = childrenNamed(node, 'tr').map((tr) => {
        const cells = [];
        childrenNamed(tr, 'tc').forEach((tc) => {
          cells.push(childrenNamed(tc, 'p').map(paragraphText).join('\n'));
          const props = childrenNamed(tc, 'tcPr')[0];
          const span = props ? childrenNamed(props, 'gridSpan')[0] : null;
          const count = span ? parseInt(span.getAttribute('w:val') || span.getAttribute('val') || '1', 10) || 1 : 1;
          for (let s = 1; s < count; s++) cells.push('');
        });
        return cells;
      });
      grids.push(grid);
      precedingText.push(lastParagraph);
      lastParagraph = '';
    }
  });
  return { grids, precedingText };
}

/**
 * Imports the rubric table from an uploaded .docx file. The rubric name is the
 * paragraph just above the rubric table. The placeholder text "Rubric Name" is
 * treated as no name. Other content in the document is ignored.
 * @param {File} file
 * @returns {Promise<{name: string, criteria: object[], usedHeader: boolean}>}
 * @throws {Error}
 */
export async function importFromDocx(file) {
  let grids;
  let precedingText;
  try {
    const xml = await unzipEntry(await file.arrayBuffer(), 'word/document.xml');
    ({ grids, precedingText } = docxXmlToGrids(xml));
  } catch (e) {
    throw new Error('That file could not be read as a Word document. Make sure it is a .docx file (not .doc). If it still fails, use Paste from Word instead.');
  }
  if (!grids.length) throw new Error('No table was found in that Word file.');

  const picked = pickTable(grids);
  if (!picked || !picked.criteria.length) {
    throw new Error('A table was found, but it has no filled-in rubric rows. ' + HEADER_HELP);
  }
  let name = cleanText(precedingText[picked.index] || '');
  if (name.toLowerCase() === PLACEHOLDER_RUBRIC_NAME.toLowerCase()) name = '';
  return { name, criteria: picked.criteria, usedHeader: picked.usedHeader };
}
