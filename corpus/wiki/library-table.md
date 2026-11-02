---
summary: How the main table of books works. TanStack Table running in the browser over every book, shown a page at a time in the browser (50 by default, the pager, since 2026-11-02), the filter type each column gets, diacritics-insensitive search (Cartarescu finds Cărtărescu, ş and ș match), the layout remembered per device and saved views on the server (where the Views menu sits), virtual scrolling, row selection and the bulk bar (2026-10-23), and why filtering does not need the server.
updated: 2026-11-02
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
round trips for no gain at this size.

**Pages** (2026-11-02, the owner's ask). The table and the covers show one
page of the list the client holds; the server still answers every book once
per session, because search, filters, sort, the offline "do I own this?"
check, stats, import's duplicate check and export all run over the whole
list. `LibraryView.rows` keeps its meaning (every book the search and filters
let through, sorted); `pageRows` is the page's slice of it, from the pure
helpers in [pagination.ts](../../web/src/library/pagination.ts). Both
virtualizers stay and get the page's rows. The page size is a pref per layout
(25, 50, 100 or 200, default 50, the same for Table and Covers). The page is
session state in [state.ts](../../web/src/library/state.ts), kept with what
it was turned on: the tab, the search text, the filters, the sort and the
size. When any of those changes, or a saved view is applied, the Library is on
page 1 and the old page is forgotten; Back from a book finds the page and
`scroll.ts` the scroll within it. A list that shrinks (a filter, a bulk
delete, a book deleted on another device) shows its new last page. The pager
sits under the list; it is gone when everything fits on one page, unless a
size over 50 put more than 50 books there, so "Per page" stays in reach to go
back down. Turning the page brings the list's top under the top bar, keeps
focus on the control pressed and reads the new range in a polite live region.
The arrows in the table and the grid stop at the page's first and last row.
The caption under the title keeps the total. Rejected: AG Grid and MUI Data Grid,
whose Excel export is behind a paid tier and whose look fights a custom design.

## Views

Library holds two collections, **Owned** and **Wishlist**, switched at the top
of the page; everything below applies to whichever is open. Two views of the
same rows, switched by a Table / Covers control ([design.md](design.md)): **Table**, the default on a laptop, and **Covers**,
a cover grid that is the default on a phone. Search, filters and sort apply to
both; export ("This view") takes the rows either view holds, every page of them.

The open collection is `LibraryPrefs.collection` (`"owned"` or `"wishlist"`, in
[prefs.ts](../../web/src/library/prefs.ts)), saved per layout beside the view and
the column layout; it opens on Owned. The tabs sit under the title with a count
each. Everything is derived for the open collection (`LibraryView.collection`,
`counts`, `books`). The wishlist leaves out the columns its books never fill
(shelf, condition, acquired on, acquired from) even if the column picker has them
on, and the saved choice is untouched. Switching tab clears the filters (they are
session-only), so a shelf filter can't hide the other tab's books. Export on the
Wishlist tab writes the wishlist's rows and the columns it fills. The Filter panel,
its sort list and the column picker leave the four out on the wishlist too
(`columnsIn` / `columnApplies` in [view.ts](../../web/src/library/view.ts), since the
2026-10-23 review); a sort carried over from Owned stays listed until changed.

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

Click a header to sort; shift-click adds a second key. A sort is over the
whole list, not the page, and lands on page 1. Text sorts with
`Intl.Collator('ro', { sensitivity: 'base', numeric: true })`, so "ă" sorts
after "a" and "Vol. 10" after "Vol. 2". Authors sort by the `author_sort` field
("Cărtărescu, Mircea"), not by the displayed name.

## Layout memory

The open tab, Table / Covers, column order, widths, visibility, sort and page
size are saved per layout (`shelfmark.library.desktop`, `shelfmark.library.phone`) in
`localStorage` by [prefs.ts](../../web/src/library/prefs.ts): a convenience;
losing it costs nothing. The filters live in page state for the session
([state.ts](../../web/src/library/state.ts)).

**Saved views** (2026-10-23) are stored on the server, so they
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

Since 2026-10-23, a box before the columns selects a row; the header's
box selects every row the search and filters let through (not every book),
on every page and not only the one on show (2026-11-02), shows a dash when
only some are, and unselects them once all are. The common alternative, a
box that ticks only the page plus a "Select all 1,234" offer, was not taken;
it is the one call the owner may want to revisit. The boxes
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
switching tab until Clear, and survives a turn of the page, so the bar counts
the selected books out of sight ("3 selected, 1 not shown"). "Not shown"
counts books the search, a filter or the other tab hides, not books on other
pages. It keeps each id with the book's `createdAt`,
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
