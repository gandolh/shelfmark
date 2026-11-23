---
summary: Shelfmark's vocabulary, one word per concept with the synonyms it replaces. Book, collection (owned, wishlist), shelf and room, status (each person's own) and reader, lookup and draft, CIP and the CIP block, library catalog and CIP index, similar book and From Claude. Use these words in code, UI copy and briefs.
updated: 2026-11-23
---

# Glossary

**Book**:
One physical copy the owner has (or wants), stored as one row in `books`. Two
copies of the same title are two books.
_Avoid_: item, copy (as a noun for the row), volume, record, entry

**Collection**:
Which list a book is on: **owned** (on a shelf at home) or **wishlist** (wanted,
not owned). The Library shows the owned books; the Wishlist page shows the
wishlist.
_Avoid_: library (for the owned list), wanted list, to-buy list

**Wishlist**:
A place in the app (since 2026-11-10), after Library and Add a book: the books
wished for, then the recommendations. Also the `wishlist` collection. No longer
a tab of the Library.

**Recommendation**:
A book in no collection, suggested from what the library holds, or named by
Claude and checked in Open Library. Never a book that is owned, wished for or
dismissed ([recommendations.md](recommendations.md)).
_Avoid_: suggestion, pick, discovery

**Similar book**:
A recommendation Shelfmark's own model found close to books in the library
(source `similar`); the Similar books tab lists them, *Find similar books*
finds them.
_Avoid_: AI pick, model pick, match, related book

**From Claude**:
A recommendation Claude named from the library file the owner handed it,
imported and checked in Open Library (source `claude`); the From Claude tab.
_Avoid_: AI pick, Claude's suggestion

**Dismissed**:
A recommendation the owner said "Not interested" to; never shown again, by work
key or title key.

**Shelf**:
Where an owned book sits, written as "Room · shelf" ("Living room · A2"), or
just the room when a room has one shelf ("Bedroom"). Column `shelf`.
_Avoid_: location, place, position

**Room**:
The part of a shelf before the dot. Grouping and filtering by room is built on
it; it is not stored separately.
_Avoid_: area, zone

**Status**:
A person's own reading state of a book: unread, reading, read or abandoned.
Since 2026-11-17 each person signed in has their own on every book, with their
own rating beside it.
_Avoid_: progress, state

**Reader**:
Someone other than you with a status other than unread, or a rating, on a
book; the API lists them in `Book.readers`.
_Avoid_: member, user (for this sense), viewer

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

**CIP block**:
The CIP as a book prints it on its copyright page, under "Descrierea CIP a
Bibliotecii Naţionale a României"; what "Read the CIP block" reads from a photo.
_Avoid_: CIP photo, CIP box, copyright block

**Library catalog**:
One of the three Romanian library catalogs a lookup asks over Z39.50: the
Romanian Academy Library, BCU Cluj and BCU Timișoara.
_Avoid_: OPAC, Z39.50 source, library database

**CIP index**:
Shelfmark's local table of the national library's CIP lists, one record per
ISBN, refreshed from the published PDFs; a lookup source.
_Avoid_: CIP catalog (that is the national library's own, behind a CAPTCHA), CIP cache
