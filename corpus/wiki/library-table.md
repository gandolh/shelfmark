---
summary: How the main table of books works. TanStack Table running in the browser over every book, the filter type each column gets, diacritics-insensitive search (Cartarescu finds Cărtărescu, ş and ș match), remembered column layout, virtual scrolling, row selection, and why filtering does not need the server.
updated: 2026-10-23
---

# Library table

## Shape

Recommended: **TanStack Table** (headless, v9 current on 2026-10-14) with
`@tanstack/react-virtual` for long lists. The page loads **every book** once
(`GET /api/books`) and sorts, filters and searches in the browser. A home
library is hundreds to a few thousand rows; 5,000 books is a couple of
megabytes of JSON and filters instantly. This also makes export trivial: the
exported rows are exactly the rows the table holds after filtering.

Rejected: server-side paging and filtering, which needs a query language and
round trips for no gain at this size. Rejected: AG Grid and MUI Data Grid,
whose Excel export is behind a paid tier and whose look fights a custom design.

## Views

Library holds two collections, **Owned** and **Wishlist**, switched at the top
of the page; everything below applies to whichever is open. Two views of the
same rows, switched by a Table / Covers control ([design.md](design.md)): **Table**, the default on a laptop, and **Covers**,
a cover grid that is the default on a phone. Search, filters and sort apply to
both; export takes the rows either view holds.

The open collection is `LibraryPrefs.collection` (`"owned"` or `"wishlist"`, in
[prefs.ts](../../web/src/library/prefs.ts)), saved per layout beside the view and
the column layout; it opens on Owned. The tabs sit under the title with a count
each. Everything is derived for the open collection (`LibraryView.collection`,
`counts`, `books`). The wishlist leaves out the columns its books never fill
(shelf, condition, acquired on, acquired from) even if the column picker has them
on, and the saved choice is untouched. Switching tab clears the filters (they are
session-only), so a shelf filter can't hide the other tab's books. Export on the
Wishlist tab writes the wishlist's rows and the columns it fills. The Filter panel
and column picker still list the four columns on the wishlist; they just find
nothing there.

## Filters per column

| Column kind | Filter | Examples |
|---|---|---|
| Text | contains, is empty / not empty | title, authors, publisher, series, notes |
| Pick-list | multi-select of values present | shelf, status, format, language, condition, tags |
| Number | min–max range | year, pages, rating, price |
| Date | from–to | acquired on, added on |
| Yes/no | yes / no / any | signed |

The pick-list options come from the data (faceted values with counts), so a new
shelf name appears in the filter as soon as one book uses it. Active filters
show as removable chips above the table, with "Clear all".

## Search

One box searches title, subtitle, authors, publisher, series, ISBN, tags and
notes. Matching is case- and **diacritics-insensitive**: normalise both sides
with NFD and drop combining marks. That folds ș (comma below) and ş (cedilla)
to `s`, ț and ţ to `t`, so old and new Romanian spellings match. ISBN search
ignores hyphens.

## Sorting

Click a header to sort; shift-click adds a second key. Text sorts with
`Intl.Collator('ro', { sensitivity: 'base', numeric: true })`, so "ă" sorts
after "a" and "Vol. 10" after "Vol. 2". Authors sort by the `author_sort` field
("Cărtărescu, Mircea"), not by the displayed name.

## Layout memory

Column order, widths, visibility, sort and density are saved per device in
`localStorage` (a convenience; losing it costs nothing). Saved views
(v1.x, [features.md](features.md)) move this to the server under a name.

## Rows

The first column is the book: its cover, then title over author. Then the
visible columns. Clicking a row opens the book page. A checkbox column enables
bulk actions (v1.x). On a phone the Covers view leads, with the same search, sort and filters behind a sheet; a 12-column
table does not fit a phone, and pretending otherwise is worse.
