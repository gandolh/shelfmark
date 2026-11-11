---
summary: The researched feature set, in tiers (v1, v1.x, later, out; loans are out; the wishlist, the offline ownership check, saved views and bulk edit have shipped), with what comparable home-library apps (Libib, BookBuddy, CLZ Books, LibraryThing) offer and why each feature sits in its tier. Read before writing or promoting any brief; the todo files carry these tiers as tags.
updated: 2026-11-11
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
| Export | CSV and XLSX of the whole library ("Export library" in the account menu since 2026-11-04), plus a full backup. See [export.md](export.md). |
| PWA | Installable; app shell works offline. |
| Accounts | Own login with "Sign in with Ward" as the second way in (estate rule from `wzd_auth`); its items live in the account menu, not a Settings page. Change username shipped 2026-10-24 (2026-10-24; on ward-auth 0.4.0's rename). |

## v1.x — right after

Bulk edit and saved views were the tier. Both shipped on 2026-10-23 (below);
bulk edit had waited for row selection in the table.

## Shipped after v1

| Feature | Notes |
|---|---|
| Offline "do I own this?" | Shipped 2026-10-23 (2026-10-23). A scan with no signal is answered from a copy of the library kept in IndexedDB (ISBN, title, shelf, collection): on a shelf, on the wishlist, or not in the library, "as of" the copy's date. Needs one visit online first; sign out clears it. See [scanning.md](scanning.md). |
| CIP photo | Shipped 2026-10-23 (2026-10-23). "Read the CIP block" on the by-hand form: a photo of a Romanian book's copyright page, read by Tesseract in the browser (no CDN, cached on first use, then offline), fills the empty fields (title, subtitle, author, publisher, year, ISBN) and marks them to check. See [cip-photo.md](cip-photo.md). |
| Offline scan queue | Shipped 2026-10-23 (2026-10-23). Offline, a scan of a book not in the copy can be queued ("Look it up later", with a shelf); the queue survives a reload and shows as "Waiting to look up (N)" on Add a book. Back online the ISBNs are looked up one at a time and each opens as the usual sheet to confirm. Sign out clears it. See [scanning.md](scanning.md). |
| Recommendations | Built 2026-11-11 (brief 04), not deployed: the Wishlist page's list of books in no collection; today from Claude by hand (download the library, copy the prompt, import the JSON, each pick checked in Open Library). The spike of TasteDive and an embedding ranker is the owner's to judge. See [recommendations.md](recommendations.md). |
| Wishlist | Shipped 2026-10-23 (2026-10-23). Books wanted, not owned: a collection shown, since 2026-11-11, on the Wishlist page, a third place (it was the Library's second tab), "Add to wishlist" when a scanned book is not owned, and "I bought it" (on the scan sheet and the book's page) moving the row onto a shelf. Wanted by the owner (2026-10-14). |
| CSV import | Shipped 2026-10-23 (2026-10-23). \"Import a CSV\" in the account menu: Goodreads, Libib, LibraryThing, a Shelfmark export or any spreadsheet, with the encoding detected, a preview with duplicates flagged, optional one-at-a-time lookups, and saving into Owned or Wishlist. See [import.md](import.md). |
| Saved views | Shipped 2026-10-23 (2026-10-23). Named views of the Library ("Unread", "Unread, living room"): the tab, filters, sort and shown columns, stored on the server so they follow the owner across devices, from a Views menu. See [library-table.md](library-table.md). |
| Bulk edit | Shipped 2026-10-23 (2026-10-23). Select rows (a box per row in the table, a long press in the covers), then move them to a shelf, set their status, add or remove tags, or delete them, each as one transaction. A shelf move leaves wishlist books out and says so. See [library-table.md](library-table.md). |
| Stats | Shipped 2026-10-23 (2026-10-23). \"Stats\" in the account menu (not a third place): owned books by author, language, shelf (grouped by room), status and decade, money spent per year per currency, and a Wishlist count. Counted in the browser; each count opens Library filtered to those books. |

## Later

None. The last one, CIP photo capture, shipped on 2026-10-23 (2026-10-23).

## Out

Loans (the owner dropped them, 2026-10-14). A link to a book's Atrium copy (dropped
2026-10-23: the two apps stay independent until the owner decides to merge them). Social features, reviews, reading
challenges, ebook files, price tracking, and
shelf-photo spine recognition (impressive, unreliable, not worth the work at
one person's scale).
