# Rubric Converter

A small web page that turns a four-level rubric table (for example, from a Word document) into a **Canvas rubric import CSV**. You can also build a rubric from scratch in the page.

Everything runs in your browser. Nothing is uploaded, and there is no sign-in, server, or database.

## Quick start

1. **Get your rubric in.** Choose one:
   - **Paste from Word**: copy the rubric table in Word or Word Online, then paste it into the box.
   - **Upload Word file**: choose a `.docx` file that contains the rubric table.
   - **Paste CSV** or **Upload CSV**: start from a rubric that is already converted.
   - **Start a blank rubric**: build a new rubric in the editor.
2. **Check and adjust.** Type the rubric name, then edit any cell. Add or delete rows as needed.
3. **Export.** Select **Download CSV** or **Copy CSV**. **Preview CSV** shows the file first.
4. In Canvas, import the CSV into the course's rubrics.

If a rubric is already in the editor when you import, the page asks whether to **replace** it or **add to the end**.

## Input format

The rubric table needs these column names in its first row (capitalization does not matter, and column order does not matter):

| Column | Meaning |
|---|---|
| Criterion Name | The name of the criterion |
| Points | Full points for the criterion (whole number) |
| Competent | Description for the top level |
| Approaching Competency | Description for the middle level (optional) |
| Not Competent | Description for the lower level |
| Not Submitted | Description when nothing was submitted |

- For a Word file, the rubric name is the paragraph directly above the table. A name of "Rubric Name" is treated as a blank placeholder.
- A pasted table does not include a name. Type it in Step 2.
- Blank rows and extra spaces are ignored.
- If no column names are found but the table has at least six columns, columns are read in the order shown above.

## Scoring rules

| Level | Points earned |
|---|---|
| Competent | Full points |
| Approaching Competency | Half the points, rounded up |
| Not Competent | 0 |
| Not Submitted | 0 |

Points must be whole numbers. Approaching Competency is `Math.ceil(points / 2)`:

| Full points | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Approaching | 1 | 1 | 2 | 2 | 3 | 3 | 4 |

Not Competent and Not Submitted are both worth 0 but stay separate levels, so they can be reported separately.

**Skipping a level:** leave its cell blank. A blank level is left out of the CSV completely, and the page shows no warning.

## CSV output

Each criterion becomes one row. The columns match Canvas's rubric import template:

`Rubric Name, Criteria Name, Criteria Description, Criteria Enable Range`, then `Rating Name, Rating Description, Rating Points` repeated once per included level.

- Criteria Description is left blank.
- Criteria Enable Range is `false`.
- Ratings are written in this order: Competent, Approaching Competency, Not Competent, Not Submitted.
- The file is saved as UTF-8.

**Importing a CSV back in:** each rating is matched to a level by its Rating Name. The criterion's Points come from its Competent rating, and the other levels are recalculated with the scoring rules above. Ratings whose names match none of the four levels are listed in a message and left out.

## Warnings

Warnings are shown in plain language and never block export:

- Rubric name is missing.
- A criterion has no name.
- A criterion's points are not a whole number.
- A criterion has no rating text.
- A criterion has a rating level filled in but no Competent text.

## Browser support

Current versions of Chrome, Edge, Firefox, and Safari (16.4 or later). Reading `.docx` files uses the browser's built-in `DecompressionStream`. **Paste from Word** does not need it.

## Run it

The page uses JavaScript modules, so open it from a web address, not by double-clicking `index.html`.

**On GitHub Pages**

1. Create a repository and upload these files, keeping the folder layout.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick your main branch and the `/ (root)` folder, then save.
4. After a minute, the page is available at the address GitHub shows.

**On your own computer**

From this folder, run one of these, then open the address it prints:

```
python3 -m http.server 8000      # then visit http://localhost:8000
npx serve .
```

## Tests

The logic that does not need a browser (scoring, validation, CSV export and import, round trip) is checked with:

```
node tests/run-tests.mjs
```

This needs Node 18 or newer. The page itself (pasting, uploading, buttons, layout) is tested by hand in a browser.

## Project structure

```
index.html            Page structure
css/styles.css        All styling; colors are CSS variables at the top
js/constants.js       Level names and CSV column names
js/model.js           Rubric shape, scoring rule, text cleanup, validation
js/parse-table.js     Header detection and table-to-criteria conversion
js/import-word.js     Paste from Word and .docx upload
js/import-csv.js      CSV paste and upload
js/export-csv.js      CSV creation, download, and copy
js/editor.js          The editable table
js/app.js             Connects the page to everything above
tests/run-tests.mjs   Browser-free checks
.nojekyll             Tells GitHub Pages to serve files as they are
```

## Known limits

- Vertically merged cells in a Word table are not handled. Cells that span several columns are.
- One rubric at a time.
- The working rubric is kept only while the browser tab stays open.

## License

MIT. See `LICENSE`.
