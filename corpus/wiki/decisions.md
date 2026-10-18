---
summary: Locked calls for Shelfmark, each with date, rejected alternatives and reason. Physical books only (ebooks stay in Atrium); a web app with a PWA on React, Fastify and SQLite; one user, deployed on the VPS with its own login and Sign in with Ward; English interface; the familiar table app in the Covers variant, light; two places only (Library, Add a book); one row per physical copy; no loans; Google Books needs the owner's free API key; covers live in SQLite; Romanian books are looked up in three library catalogs and the CIP lists before Google, politely; the camera reads only on a press. Research recommendations live on the concept pages until the owner confirms them.
updated: 2026-10-18
---

# Decisions

Each entry passed three tests: hard to reverse, surprising without context, and
a real trade-off. Changing one needs an explicit revisit and a `log.md` entry.
Recommendations on other pages (scanner library, export library, client-side
filtering) are **not** decisions until the owner confirms
them; [open-questions.md](open-questions.md) tracks what still needs an answer.

## Physical books only; ebooks stay in Atrium
_2026-10-14_. Shelfmark catalogs printed books on the owner's shelves. It never
stores or reads a book file. The owner asked for "what physical books do I
own". Rejected: adding a physical-books section to Atrium (`../atrium`), which
is built around uploaded files, readers and per-profile reading progress; a
catalog of objects shares almost none of that, and would bend Atrium's single
media grid around items with no file. A later link from a book to its Atrium
copy is allowed ([features.md](features.md)).

## A web app with a PWA, on React + Fastify + SQLite
_2026-10-14_. The owner chose the stack: a React PWA for the phone and laptop,
a Fastify API, SQLite for storage. It matches the estate's house stack (Satchel,
`../satchel`), so the layout, auth library and deploy pattern are reused.
Rejected: a native app, which would scan more easily (no browser camera
quirks, see [scanning.md](scanning.md)) but means a second codebase and an
app-store or sideload step for one user. Rejected: an existing service
(Libib, CLZ Books), because the owner asked for their own application.

## One user, deployed on the VPS with its own login
_2026-10-14_. The owner answered: Shelfmark is for the owner alone, and it runs
on the shared VPS like Satchel (HTTPS through Caddy, deployed by
`../vps-deploy`), with Shelfmark's own login and "Sign in with Ward" as the
second way in (the estate rule in `../wzd_auth`, decisions-oidc). Rejected:
home network only, which still needs a local certificate for the phone camera
and loses the "do I own this?" check in a bookshop. Rejected: household
accounts and view-only guests, which would put an owner or role on every row
and screen for people who are not asking for it. Because there is one user,
the schema has no per-user data beyond the auth tables. Adding people later is
a revisit of this entry.

## English interface
_2026-10-14_. All interface copy is English; book data stays in the book's own
language. Rejected: Romanian, and both with a switch, which would route every
string in every brief through translations. Diacritics-insensitive search and
Romanian collation still apply to the data ([library-table.md](library-table.md)).

## The UI is the familiar table app, in the Covers variant
_2026-10-14_. The owner chose the category standard, a familiar table app
played straight, over three themed directions from impeccable's direction
round (seed `ac946dc9`): Dictionary (a DEX page), Ledger (an inventory
register) and Departures (a split-flap board). Then, from three light variants
of the standard calibrated on real products (Calm after Notion, Grid after
Airtable, Covers after Apple's own apps), the owner chose **Covers**: the cover
leads, the chrome recedes, one teal accent, light. Rejected: the themed
directions, which make the owner learn a metaphor before finding a book (the
same call the owner made for showcase); Calm, whose coloured tags get busy at
library scale; Grid, which hides covers. Mock-ups and tokens:
[design.md](design.md).

## Two places only: Library and Add a book
_2026-10-14_. The owner asked for no Loans tab and no Settings tab unless it
has content. The account items (password, Sign in with Ward, backup download,
sign out) live in a menu on the account button instead. The wishlist is a
second collection inside Library, not a third place. Rejected: a Settings page
holding four links, and a Loans tab. A new top-level place needs an
explicit revisit of this entry.

## One row per physical copy
_2026-10-14_. The owner confirmed the recommendation: a row in `books` is one
physical copy on a shelf, and its shelf, condition and acquisition belong to
it. Owning two copies of a book means two rows; ISBN is indexed but not unique.
Rejected: an `editions` table plus a `copies` table, which doubles the join and
the edit screens for a case that hardly happens. See
[data-model.md](data-model.md).

## No loans
_2026-10-14_. The owner dropped loans entirely: no Loans tab, no "Lend"
action, no `loans` table, no "on loan" column. Rejected: loans as a small
book-page action, recommended for "who has my book?", which the owner does not
need. Adding loans later is a revisit of this entry and of the two-places
entry above.

## Google Books needs the owner's free API key
_2026-10-14_. The owner accepts a Google Cloud API key only because no free
keyless service covers Romanian books. Measured on 2026-10-14 against 40
ISBNs from each of two national-library CIP lists: Open Library 4/40 and 1/40,
K10plus 1/40, BnF 1/40, DNB and the Library of Congress 0; Jisc refuses
scripts; the national library's own CIP catalog sits behind a CAPTCHA, which
the app must not work around. The key lives in `.env` as
`GOOGLE_BOOKS_API_KEY`. Details in [metadata-lookup.md](metadata-lookup.md).

## Covers live in SQLite
_2026-10-14, while writing the briefs_. Cover images are BLOBs in a `covers`
table with `ON DELETE CASCADE`, not files in `data/covers/`. Deleting a book
deletes its cover in the same transaction, and the backup is the database file
alone. Rejected: a covers folder (the first design), which needs its own
clean-up on delete and a zip to back up. At a few thousand covers of
30-100 KB the database stays well under a gigabyte.

## Romanian books: library catalogs and the CIP lists before Google
_2026-10-17_. A lookup asks Open Library, then three Romanian library catalogs
over Z39.50 (the Romanian Academy Library, BCU Cluj, BCU Timișoara), then a
local index of the national library's CIP lists, and Google Books last. Each
later source is asked only while no earlier one has found a title, so Google
is no longer asked just for a missing cover. The owner wants the Google key
used as little as possible, and on 2026-10-17 Google found none of 80 recent
Romanian trade books. The libraries found 33 of 40 books from 2012-2015, and
the CIP lists cover the newest books, which libraries catalogue a year or so
late. The libraries are asked politely: one request at a time per library,
a random 5-10 s pause between requests, every answer cached. The owner is
grateful for their work. There's no email for now, but the owner may contact
them later about working together. Rejected: scraping
bookshop sites or Goodreads (against their terms, fragile; the owner said no
again on 2026-10-17), ISBNdb (paid), the national library's catalog (CAPTCHA,
and its Z39.50 port did not answer). Measurements in
[metadata-lookup.md](metadata-lookup.md).

## The camera reads only on a press
_2026-10-18_. Scan mode shows the live camera and a *Scan the barcode*
button. The camera decodes nothing and sends no lookup until it is pressed.
A press reads until two reads agree, for at most 3 s
([scanning.md](scanning.md)). The owner asked for it after briefs 17 and 18
had made continuous reading safer. They want nothing read or sent without
a deliberate act, which also spares the libraries and the Google key the
calls of a misread or a book the camera only passed over.
Rejected: continuous reading (briefs 07-18: no tap per book, but every book
in view is read and looked up), with or without brief 17's replaceable
result and brief 18's 600 ms wait before a lookup. The cost is one tap per
book.
