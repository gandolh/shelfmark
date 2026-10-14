# Log

## [2026-10-14] ingest | Corpus bootstrapped with the feature research

The owner asked for an app that catalogs their physical books: scan an ISBN or
barcode, save to SQLite, a sortable table with a filter on any column, export
to Excel/CSV, a PWA on React + Fastify + SQLite. Research covered comparable
apps (Libib, BookBuddy, CLZ Books, LibraryThing), live tests of Open Library,
Google Books and the BNR catalog, browser barcode support and the iOS PWA
camera bugs, and current npm versions. Filed as
[wiki/features.md](wiki/features.md), [wiki/metadata-lookup.md](wiki/metadata-lookup.md),
[wiki/scanning.md](wiki/scanning.md), [wiki/library-table.md](wiki/library-table.md),
[wiki/export.md](wiki/export.md), [wiki/data-model.md](wiki/data-model.md) and
[wiki/architecture.md](wiki/architecture.md); two decisions locked from the
owner's own framing; 21 todos captured by tier. Main finding: Open Library
found 23/25 English ISBNs but only 5/25 and 3/25 Romanian ones, and keyless
Google Books calls fail with 429.

## [2026-10-14] decision | One user, on the VPS, English interface; PRODUCT.md written

The owner answered the impeccable init interview: Shelfmark is for the owner
alone, deployed on the VPS like Satchel with its own login and Sign in with
Ward, with an English interface. Recorded in
[wiki/decisions.md](wiki/decisions.md); the two questions left
[wiki/open-questions.md](wiki/open-questions.md). `PRODUCT.md` at the repo root
is impeccable's product record for the design work. Direction round seeded
(`ac946dc9`); mock-ups go to the owner on the design canvas.

## [2026-10-14] decision | UI chosen: the familiar table app, Covers variant

Impeccable direction round (seed `ac946dc9`) on the design canvas: Dictionary,
Ledger, Departures and the standard; the owner chose the standard. Then three
light variants calibrated with design-md-library (Calm after Notion, Grid after
Airtable, Covers after Apple's own apps); the owner chose Covers. The owner
also cut navigation to Library and Add a book (no Loans tab, account items in
a menu instead of Settings) and asked for a light theme. New page
[wiki/design.md](wiki/design.md); two entries in
[wiki/decisions.md](wiki/decisions.md); loans moved to an open question;
`PRODUCT.md` brand commitments updated.

## [2026-10-14] decision | One row per copy, no loans, a wishlist, the Google key; name kept

The owner answered the open questions: one row per physical copy; loans
dropped entirely (the loans todo is deleted); the wishlist is wanted (moved to
v1.x as a second collection inside Library); the name stays Shelfmark (over
Armarium, Alcove and Keep). The Google Books key was accepted on condition
that no free service covers Romanian books, so that was measured first: 40
ISBNs from each of the March 2019 and April 2026 CIP bibliographies against
Open Library, K10plus, BnF, DNB and the Library of Congress found 5/40 and
1/40 at best, and the national library's CIP catalog sits behind a CAPTCHA.
Recorded in [wiki/decisions.md](wiki/decisions.md) and
[wiki/metadata-lookup.md](wiki/metadata-lookup.md); new
[wiki/glossary.md](wiki/glossary.md) (book, collection, shelf, status, lookup,
draft, CIP; the `location` column is now `shelf`); new later todo
cip-bibliography-index.

## [2026-10-14] ingest | No existing list to import

The owner has no spreadsheet, Goodreads or Libib list, so CSV import stays in
v1.x and every book enters by scan, ISBN or hand. No open questions remain.
