---
summary: How CSV and Excel export work and the traps they avoid. What gets exported (the current view or everything), the UTF-8 BOM that makes Excel show ș and ț, spreadsheet formula injection, why write-excel-file and not SheetJS, and the full backup (one `.db` file).
updated: 2026-10-14
---

# Export

## What gets exported

The export menu on the table offers two scopes:

- **This view**: the rows left after filters and search, in the current sort,
  with the visible columns in their current order. What you see is what you get.
- **Everything**: every book, every column.

Both run in the browser from the rows the table already holds
([library-table.md](library-table.md)); no export endpoint is needed. Cover
images are not exported in CSV/XLSX; the backup has them.

## CSV

- Comma separated, RFC 4180 quoting, `\r\n` line ends.
- **Starts with a UTF-8 BOM** (`﻿`). Without it, Excel on Windows reads
  the file as the local code page and ș, ț, ă turn into garbage.
- **Formula injection guard**: a cell starting with `=`, `+`, `-`, `@`, tab or
  carriage return gets a leading `'`. A note or title like `=HYPERLINK(...)`
  would otherwise run as a formula when opened (OWASP "CSV Injection").
- Multi-value fields (authors, tags) are joined with `; `.
- File name: `shelfmark-<YYYY-MM-DD>.csv`.

## XLSX

Recommended: **`write-excel-file`** (4.1.1), imported from
`write-excel-file/browser`; it writes in a Web Worker. Typed cells: numbers
stay numbers, dates are real dates, the header row is bold and frozen, and
column widths follow the content.

Rejected: SheetJS (`xlsx`): the npm package is stuck at 0.18.5 with two
known vulnerabilities (CVE-2023-30533 prototype pollution, CVE-2024-22363
ReDoS); fixed builds ship only as a tarball from the vendor's CDN, which
`npm audit` can't check. Rejected: ExcelJS 4.4.0, which is far heavier for a
write-only job and has not had a release since 2024.

## Backup

`GET /api/backup` returns a consistent copy of the SQLite database
(better-sqlite3's `backup()`, safe while the server runs) as
`shelfmark-<YYYY-MM-DD>.db`. Covers live in the database, so this one file is
everything: books, covers, the wishlist and the lookup cache. It is offered
from the account menu, not the export menu ([design.md](design.md)). Restore is
an owner step: stop the container, replace the file, start it.
