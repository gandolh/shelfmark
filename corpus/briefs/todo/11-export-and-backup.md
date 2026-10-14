# Task 11: Export to CSV and Excel, and the backup

## Context

The owner asked for export to Excel and CSV. Read
[export.md](../../wiki/export.md): the two scopes, the CSV rules (UTF-8 BOM,
formula-injection guard), why `write-excel-file` and not SheetJS, and the
backup. The export runs in the browser from the rows the Library already
holds (brief 08's `view.ts`); the backup is a server route.

Depends on briefs 08 and 04 (account menu), 02 (database).

## Files you OWN

```
web/src/export/csv.ts  web/src/export/csv.test.ts
web/src/export/xlsx.ts  web/src/export/xlsx.test.ts
web/src/export/fields.ts  web/src/export/ExportMenu.tsx
web/src/library/Toolbar.tsx     (one line: place ExportMenu in its slot)
web/src/account/actions.ts      (the backup action)
web/package.json                (write-excel-file)
server/src/routes/backup.ts  server/src/routes/backup.test.ts
server/src/app.ts               (one registration line)
```

## Files you must NOT touch

The rest of the library page, the server store.

## What to do

1. **Menu** (`ExportMenu`), as in the `Covers-Desktop` mock-up: "What you see
   now · N books" (the filtered, sorted rows with the visible columns in
   order) and "Every book, every field", each as Excel workbook (.xlsx) or CSV.
2. **Fields** (`fields.ts`): header names in English and how each field
   becomes a cell (authors and tags joined with "; ", dates as dates, price as
   a number in lei, ISBN as text so Excel doesn't turn it into 9.78E+12).
3. **CSV** (`csv.ts`): RFC 4180 quoting, `\r\n`, starts with `﻿`; a cell
   starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading `'`.
   File `shelfmark-<YYYY-MM-DD>.csv`.
4. **XLSX** (`xlsx.ts`): `write-excel-file/browser` (pinned, at least two weeks
   old), typed cells, bold frozen header row, column widths from content.
   File `shelfmark-<YYYY-MM-DD>.xlsx`.
5. **Backup** (`GET /api/backup`): a consistent copy of the database through
   better-sqlite3's `backup()` into a temporary file, streamed as
   `shelfmark-<YYYY-MM-DD>.db` (`Content-Disposition: attachment`), the temp
   file removed afterwards. Covers are inside it (they live in the database).
   The account menu's "Download a backup" calls it.

## Acceptance

- Tests: BOM present, quoting of commas, quotes and newlines, the formula
  guard on each trigger character, ISBN kept as text, the XLSX file parses back
  (read it in the test with a reader that is a dev dependency only), the
  backup route returns a file that opens with better-sqlite3 and holds the same
  books and covers.
- Manual: the CSV opens in Excel (or LibreOffice) with ă, â, î, ș, ț intact;
  the XLSX opens with dates and numbers typed.
- `npm run typecheck && npm run lint && npm test` pass.
