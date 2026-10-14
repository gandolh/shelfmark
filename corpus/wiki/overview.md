---
summary: What Shelfmark is in a paragraph. A catalog of the owner's physical books, filled by scanning barcodes with a phone, shown as a sortable, filterable table that exports to CSV and Excel. Who uses it, what it deliberately leaves out, and how it relates to Atrium and Satchel.
updated: 2026-10-14
---

# Overview

Shelfmark answers one question: **which physical books do I own, and where are
they?** The owner points the phone at a book's barcode, the app looks the ISBN
up and saves the book into SQLite, and a table page lists every book with
sorting, a filter on any column, and export to CSV or Excel. It is a website
that installs as a PWA, so the same app works on the phone (scanning, checking
whether a book is already owned) and on a laptop (browsing, editing, exporting).

The name is the library term for the mark that tells you where a book sits on
the shelf. The owner kept it on 2026-10-14 over Armarium, Alcove and Keep.

## Who uses it

The owner alone, for their home library; no other accounts (see
[decisions.md](decisions.md)). The interface is in English. Many of the books are
Romanian editions, which shapes the metadata strategy: free ISBN databases cover
them poorly (see [metadata-lookup.md](metadata-lookup.md)).

## What it leaves out

- **Ebook files.** Reading and storing PDF/EPUB files is Atrium's job
  (`../atrium`). Shelfmark catalogs objects on shelves; it never holds a file
  of the book. A later link from a book to its Atrium copy is in the backlog.
- **Social features.** No reviews feed, friends, reading challenges or public
  profiles. Goodreads does that.
- **Prices and shopping.** No price tracking or store links.

## Lineage

It follows the house stack and layout that Satchel (`../satchel`) uses: npm
workspaces with a Fastify + better-sqlite3 API, a Vite + React PWA, and a
shared package of zod schemas. The research behind the feature set is in
[features.md](features.md); the structure is in [architecture.md](architecture.md).
