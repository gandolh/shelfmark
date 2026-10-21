---
summary: The researched feature set, in tiers (v1, v1.x, later, out; loans are out, the wishlist is v1.x), with what comparable home-library apps (Libib, BookBuddy, CLZ Books, LibraryThing) offer and why each feature sits in its tier. Read before writing or promoting any brief; the todo files carry these tiers as tags.
updated: 2026-10-21
---

# Features

Research done on 2026-10-14. The owner asked for: scanning an ISBN or other
barcode, saving the book to SQLite, a table of all books with sorting and a
filter on any column, export to Excel/CSV, a PWA, and "the normal features of
this kind of app". The tiers below are a **recommendation** until the owner
confirms them (see [open-questions.md](open-questions.md)).

## What comparable apps do

| App | Notable for |
|---|---|
| Libib | Web + mobile; camera scan; several "libraries" for different places; loans; CSV import that needs only an ISBN column and fills the rest |
| BookBuddy | iOS only; custom fields (owners use them for physical location); tags; loans; no web version |
| CLZ Books | Camera, OCR and USB-scanner input; curated core database; condition and location fields |
| LibraryThing | Tags; universal CSV import keyed on ISBN |
| iBookshelf | Borrowing status on every item |

The common core across all of them: barcode scanning, automatic metadata with
covers, location, tags, reading status, loans, notes, search, import/export.
Shelfmark keeps all of it except loans.

## v1 — the first usable app

| Feature | Notes |
|---|---|
| Camera scan | Reads only on a press of *Scan the barcode*, until it reads a code (*Stop reading* ends it; so does a minute with nothing read), beep/vibrate per read, an "already owned" warning. See [scanning.md](scanning.md). |
| ISBN typing and USB scanner | One input field; a keyboard-wedge scanner types digits plus Enter, so it works for free on a laptop. |
| Manual entry | For books with no barcode or no metadata. Must be fast: Romanian books will often land here. |
| Metadata lookup + covers | Open Library, then Google Books; covers stored on our disk. See [metadata-lookup.md](metadata-lookup.md). |
| Library table | Multi-column sort, a filter per column, diacritics-insensitive search, column show/hide/reorder/resize remembered, and a Covers view (the phone default). See [library-table.md](library-table.md) and [design.md](design.md). |
| Book page | View, edit every field, re-run the lookup, replace the cover (upload or photo), delete. The add flow also offers a cover photo when the lookup found none: covers lead the chosen design. |
| Personal fields | Shelf, reading status, rating, tags, notes, format, condition, acquired date/where/price. These are what "filter by any column" filters. See [data-model.md](data-model.md). |
| Export | CSV and XLSX of the current view or everything, plus a full backup. See [export.md](export.md). |
| PWA | Installable; app shell works offline. |
| Accounts | Own login with "Sign in with Ward" as the second way in (estate rule from `../wzd_auth`); its items live in the account menu, not a Settings page. |

## v1.x — right after

| Feature | Why not v1 |
|---|---|
| Bulk edit (move shelf, add tag, delete) | Row selection in the table first. |
| Offline "do I own this?" | Scan in a bookshop with no signal; checks an IndexedDB copy of the ISBN list. The most-cited use of these apps away from home. |
| Offline scan queue | Scanned ISBNs wait in IndexedDB and are looked up when back online. |
| CSV import | Goodreads/Libib/spreadsheet. Moves to v1 if the owner already has a list ([open-questions.md](open-questions.md)). |
| Wishlist | Books wanted, not owned: a second collection inside Library (Owned / Wishlist), and "Add to wishlist" when a scanned book is not owned. "I bought it" moves one onto a shelf. Wanted by the owner (2026-10-14). |
| Saved views | Named filter + sort + columns, e.g. "Unread", "Unread, living room". |

## Later

- **Stats page**: counts by author, language, shelf, decade; total spent.
- **CIP photo capture**: Romanian books print a "Descrierea CIP a Bibliotecii
  Naționale a României" block on the copyright page with title, author,
  publisher, year and ISBN. A photo of it, read by OCR or Claude, would fill
  most Romanian books that the databases miss.
- **Atrium link**: mark that an ebook copy exists in Atrium.

## Out

Loans (the owner dropped them, 2026-10-14). Social features, reviews, reading
challenges, ebook files, price tracking, and
shelf-photo spine recognition (impressive, unreliable, not worth the work at
one person's scale).
