---
title: Index the national library's CIP bibliographies
created: 2026-10-14
status: promoted
tags: [v1.x, server]
---

# Index the national library's CIP bibliographies

Download the monthly "Bibliografia cărților în curs de apariție - CIP" PDFs
from the national library's site, parse each entry (author, title, city,
publisher, year, ISBN) and keep them as a local lookup source for Romanian
books, queried after Open Library and the library catalogs, before Google
Books.

## Context

Free public data with near-complete coverage of books from Romanian publishers,
but only from 2019 on (the older archive did not answer on 2026-10-14), and
pre-publication data, so titles can differ from the printed book. On
2026-10-17 Google Books found none of 80 recent Romanian trade books, and the
owner said yes to this index. Books older than about a year are better served
by the [library catalogs](z3950-library-source.md). Measurements and parsing
notes in [metadata-lookup.md](../wiki/metadata-lookup.md). A parser that
handles ISBNs broken across lines read 8,442 records from January to March
2026, and it works on the national bibliography PDFs too.

Promoted to [16-cip-index](../briefs/done/16-cip-index.md) on 2026-10-17.
