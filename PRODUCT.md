# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The owner's choice (2026-10-14): a React PWA (Vite), a Fastify API, SQLite
through better-sqlite3, in the npm-workspaces layout of the owner's Satchel
project. Deployed to the owner's shared VPS behind Caddy (HTTPS), with the
app's own login and "Sign in with Ward" as the second way in.

## Users

One person: the owner, cataloging their own home library. No other accounts,
roles, or shared views. Many of the books are Romanian editions; some are
English.

## Product Purpose

Answer "which physical books do I own, and where are they?" The owner scans a
book's barcode with the phone (or types the ISBN, or uses a USB scanner on the
laptop), the app looks the book up, and after a confirm step it is saved.
Everything lands in one table that sorts, filters on any column, searches, and
exports to CSV and Excel. Success: the whole home library cataloged without
tedium, and any book findable (or its absence provable) in seconds.

## Positioning

The owner's own data in the owner's own SQLite file, exportable whole at any
time, with no account at a third-party service. Built for a mostly Romanian
library: search ignores diacritics, the add flow assumes many books will need
manual entry because free ISBN databases miss most Romanian ISBNs, and
Romanian books' printed CIP block is a planned data source.

## Operating Context

- At home, standing at a bookcase with the phone, scanning book after book;
  often one hand holds the book.
- In a bookshop or at a friend's, checking "do I already own this?", possibly
  with poor signal.
- At a laptop, browsing, filtering, editing, and exporting; a USB barcode
  scanner may type ISBNs straight into the add field.
- Installed to the phone's home screen as a PWA. On iOS the camera can
  re-prompt on navigation, so the scanner is one screen with internal states.

## Capabilities and Constraints

- v1: camera scan (EAN-13/8, UPC, Code-128) with continuous mode and an
  "already owned" warning; add by ISBN, USB scanner, or by hand; metadata from
  Open Library then Google Books, confirmed before saving; covers stored on the
  server; the library table (multi-sort, a filter per column, diacritics-
  insensitive search, remembered columns); a book page; personal fields
  (shelf, reading status, rating, tags, notes, format, condition,
  acquired); CSV/XLSX export of the current view or everything; full backup.
- Later tiers (wishlist, bulk edit, offline owned-check, offline scan queue, CSV
  import, saved views, stats, CIP photo capture) are listed in
  `corpus/wiki/features.md`.
- One row per physical copy; a wishlist lives in the same table as a second
  collection. No loans.
- Metadata: Open Library, then Google Books with the owner's free API key
  (no free keyless service covers Romanian books; measured 2026-10-14).
- Library size: hundreds to a few thousand books.

## Brand Commitments

- Working name "Shelfmark" (may change before deploy).
- Interface copy in English; book data stays in the book's own language.
- Conventional navigation, no governing metaphor: the owner rejected a
  metaphor-driven interface in another project as hard to navigate, and on
  2026-10-14 chose the category standard (a familiar table app, played
  straight) over three themed directions for this one.
- Visual direction: the standard in its "Covers" variant, calibrated on
  Apple's own apps (the cover leads, chrome recedes, one interactive colour),
  light. Tokens and layout in `corpus/wiki/design.md`.
- Two places only: Library and Add a book. Account items live in a menu,
  not a Settings page. There are no loans. The wishlist is a second
  collection inside Library, not a third place.

## Evidence on Hand

No logo, imagery, or real library data yet. Mock-ups use real book metadata
fetched from Open Library (titles, authors, publishers, years); covers are
drawn placeholders, not real cover art.

## Product Principles

- Finding a book beats admiring the collection: the table is the product.
- Adding a book takes seconds when the data exists and stays painless when it
  doesn't.
- Nothing is saved silently; a lookup is a draft the owner confirms.
- The data is the owner's: every field exports, and a backup restores it all.

## Accessibility & Inclusion

No specific needs stated; WCAG AA contrast and full keyboard use of the table.
