---
summary: How the main table of books works. TanStack Table running in the browser over every book, the filter type each column gets, diacritics-insensitive search (Cartarescu finds Cărtărescu, ş and ș match), the layout remembered per device and saved views on the server (where the Views menu sits), virtual scrolling, row selection and the bulk bar (brief 26), and why filtering does not need the server.
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

The open tab, Table / Covers, column order, widths, visibility and sort are
saved per layout (`shelfmark.library.desktop`, `shelfmark.library.phone`) in
`localStorage` by [prefs.ts](../../web/src/library/prefs.ts): a convenience;
losing it costs nothing. The filters live in page state for the session
([state.ts](../../web/src/library/state.ts)).

**Saved views** (brief 27, 2026-10-23) are stored on the server, so they
follow the owner from the laptop to the phone: a name over the tab, the
filters, the sort and the shown columns in order, behind `/api/views`
(the `saved_views` table in [data-model.md](data-model.md)). The search
text, the Table / Covers switch and the widths stay the device's, and
`localStorage` still keeps the unsaved state. The **Views** menu lists them by
position, with "Save current view…" and, for the view the page is on or was
last on, "Update to current", "Rename…" and "Delete…". While the page matches
a view the button shows its name. In the covers view a view's columns don't
count towards matching it, and applying one there still sets the table's
columns for when the owner switches back. On the
desktop Views sits in the toolbar right after the Table / Covers control; on
a phone it ends the Owned / Wishlist row, because the phone's toolbar row has
no room for a fourth control.

## Rows

The first column is the book: its cover, then title over author. Then the
visible columns. Clicking a row opens the book page. On a phone the Covers view leads, with the same search, sort and filters behind a sheet; a 12-column
table does not fit a phone, and pretending otherwise is worse.

## Selection and the bulk bar

Brief 26 (2026-10-23). A box before the columns selects a row; the header's
box selects every row the search and filters let through (not every book),
shows a dash when only some are, and unselects them once all are. The boxes
are drawn by [BookTable.tsx](../../web/src/library/BookTable.tsx) outside
TanStack's columns and are not in `LIBRARY_COLUMN_IDS`, so the column picker,
layout memory and saved views never list or store them. In a row, Tab goes
from the box to the title and the arrows move between rows from either.

In the covers, a long press (half a second, a finger or a pen, or the mouse
on the phone's layout) selects a cover. While anything is selected each cover
is a toggle with a mark in its corner, and a tap ticks it instead of opening
the book.

The selection ([selection.ts](../../web/src/library/selection.ts), kept in
`state.ts` for the session) survives sorting, filtering, searching and
switching tab until Clear, so the bar counts the selected books out of sight
("3 selected, 1 not shown"). It keeps each id with the book's `createdAt`,
so a new book that takes a deleted one's id is not selected.

While books are selected the **bulk bar** takes the toolbar's place: the
count, then Move to shelf, Set status, Add tags, Remove tags, Delete and Clear
on the desktop; the count, an Actions menu and Clear on a phone, where six
buttons don't fit (Views stays at the end of the tabs row). Clear puts the
toolbar back as it was. Each action is one `POST /api/books/bulk` with
`{ ids, change }`, one SQLite transaction, answering the changed books, the
deleted ids and the skipped ids ([data-model.md](data-model.md)). A shelf
change applies to owned books only; the dialog and the line after it say how
many wishlist books it left out. Tags match case-insensitively. Delete asks
first, names the count and says there is no undo. The selection stays after a
change, so another can follow; deleted books drop out of it. A line under the
tabs says what the last change did. An id the server no longer has (deleted
on another device) is a `400` with nothing changed; the page then fetches the
list again and asks the owner to retry.
