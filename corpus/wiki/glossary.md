---
summary: Shelfmark's vocabulary, one word per concept with the synonyms it replaces. Book, collection (owned, wishlist), shelf and room, status, lookup and draft, CIP, library catalog and CIP index. Use these words in code, UI copy and briefs.
updated: 2026-10-18
---

# Glossary

**Book**:
One physical copy the owner has (or wants), stored as one row in `books`. Two
copies of the same title are two books.
_Avoid_: item, copy (as a noun for the row), volume, record, entry

**Collection**:
Which list a book is on: **owned** (on a shelf at home) or **wishlist** (wanted,
not owned). The Library shows one collection at a time.
_Avoid_: library (for the owned list), wanted list, to-buy list

**Shelf**:
Where an owned book sits, written as "Room · shelf" ("Living room · A2"), or
just the room when a room has one shelf ("Bedroom"). Column `shelf`.
_Avoid_: location, place, position

**Room**:
The part of a shelf before the dot. Grouping and filtering by room is built on
it; it is not stored separately.
_Avoid_: area, zone

**Status**:
The owner's reading state of a book: unread, reading, read or abandoned.
_Avoid_: progress, state

**Lookup**:
Fetching a book's details for an ISBN from the metadata sources, through the
server and its cache ([metadata-lookup.md](metadata-lookup.md)).
_Avoid_: search (that is the Library's search box), fetch, sync

**Draft**:
What a lookup returns: details the owner confirms or edits before the book is
saved. Nothing from a lookup is saved without the owner.
_Avoid_: suggestion, result, match

**CIP**:
The cataloguing description the Romanian national library writes for a book
before it is printed, printed on the copyright page and listed in its monthly
CIP bibliography.
_Avoid_: colophon, imprint page

**Library catalog**:
One of the three Romanian library catalogs a lookup asks over Z39.50: the
Romanian Academy Library, BCU Cluj and BCU Timișoara.
_Avoid_: OPAC, Z39.50 source, library database

**CIP index**:
Shelfmark's local table of the national library's CIP lists, one record per
ISBN, refreshed from the published PDFs; a lookup source.
_Avoid_: CIP catalog (that is the national library's own, behind a CAPTCHA), CIP cache
