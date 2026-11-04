---
summary: How CSV and Excel export work and the traps they avoid. What gets exported (since 2026-11-04 always the whole library, from "Export library" in the account menu), the UTF-8 BOM that makes Excel show ș and ț, spreadsheet formula injection, why write-excel-file and not SheetJS, and the full backup (one `.db` file).
updated: 2026-11-04
---

# Export

## What gets exported

**Export library**, in the account menu (since 2026-11-04, the owner's call),
as an Excel workbook or a CSV file: every book, owned and wishlist alike,
whatever the Library shows. A **Collection** column comes first ("Owned" or
"Wishlist"), then every column in the table's default order, one row per
book in the server's order (oldest first). It runs in the browser from the
list the client already holds ([library-table.md](library-table.md)); no
export endpoint is needed, and the account menu loads the export code only
when it is chosen. Cover images are not exported in CSV/XLSX; the backup
has them.

Until 2026-11-04 an Export menu in the Library's toolbar offered two scopes:
"This view" (the rows the search and filters let through, with the visible
columns) and "Every book, every field" (the open tab's books). The owner
moved Export to the account menu and chose the whole library every time, so
the filtered export and the code only it used are gone. CSV import reads a
Shelfmark export back ([import.md](import.md)); it doesn't read the
Collection column, so every row goes into the collection the import is run
for.

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
everything: books, covers, the wishlist and the lookup cache. Saved views
(2026-10-23) are in it too, as their `saved_views` table: the backup copies the
whole database, so it needed no change for them. It is offered
from the account menu, beside "Export library" ([design.md](design.md)). Restore is
an owner step: stop the container, replace the file, start it.
