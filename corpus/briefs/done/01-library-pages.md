# Task 01 — Pages in the Library

## Context

The owner asked on 2026-11-02 for pagination on the books. Today the Library
shows the open collection as one long list: the table and the covers grid
each run the rows through a window virtualizer
([BookTable.tsx](../../../web/src/library/BookTable.tsx),
[CoversGrid.tsx](../../../web/src/library/CoversGrid.tsx)), so a library of a
few thousand books is one page that scrolls for a long time.

This brief adds pages in the browser, over the list the client already holds.
The server and the books store stay as they are. `GET /api/books` still
answers every book once per session ([store.ts](../../../web/src/books/store.ts)),
because search, filters, sort, the offline "do I own this?" check, stats,
import's duplicate check and export all run over the whole list.
Server-side paging was rejected in
[library-table.md](../../wiki/library-table.md) ("Shape"), and nothing here
reopens that.

Read [library-table.md](../../wiki/library-table.md) and the Library bullets
in `DESIGN.md` ("Layout") before starting. Use the glossary's words: book,
collection, Owned, Wishlist.

## Files you OWN

- `web/src/library/pagination.ts` (new): pure helpers for the page count,
  the slice, clamping, and the page numbers to show with gaps.
- `web/src/library/pagination.test.ts` (new).
- `web/src/library/Pager.tsx` (new): the page controls.
- [view.ts](../../../web/src/library/view.ts): the page's rows on the view.
- [state.ts](../../../web/src/library/state.ts): the current page, session
  state beside the filters.
- [prefs.ts](../../../web/src/library/prefs.ts) and `prefs.test.ts`: the page
  size, a pref per layout.
- [LibraryPage.tsx](../../../web/src/library/LibraryPage.tsx),
  [BookTable.tsx](../../../web/src/library/BookTable.tsx),
  [CoversGrid.tsx](../../../web/src/library/CoversGrid.tsx),
  [library.css](../../../web/src/library/library.css).
- `web/src/export/ExportMenu.tsx` (removed 2026-11-04): the label of the
  "What you see now" entry only.
- `DESIGN.md`: the Library bullets under "Layout".

## Files you must NOT touch

- `server/`: no paged API.
- [store.ts](../../../web/src/books/store.ts): the list stays whole.
- `savedViews.ts`, `savedViewsStore.ts`: a saved view stores neither a page
  nor a page size.
- `bulk.ts`, `selection.ts`: the selection's rules don't change (step 4).
- The export writers under `web/src/export/` other than the one label.

## What to do

1. **Layering.** `LibraryView.rows` keeps its meaning: every book the search
   and filters let through, sorted. Add the page as a slice above it (for
   example `view.page`, `view.pageCount`, `view.pageRows`), computed with
   the helpers in `pagination.ts`. The table and the covers grid render
   `pageRows`. Keep both virtualizers and give them the page's rows; don't
   remove them.
2. **Page size.** One pref per layout in `LibraryPrefs`, like the widths:
   25, 50, 100 or 200, default 50 on both layouts. Stored prefs without the
   field read as 50 (extend `prefs.test.ts`). The same size serves Table and
   Covers.
3. **Current page.** Session state in `state.ts`, next to the filters. That
   store already outlives the page, so Back from a book finds the same page,
   and `scroll.ts` restores the scroll within it as it does today. No history
   key is needed. The page goes back to 1 when the search text, a filter, the
   sort, the page size or the collection changes, and when a saved view is
   applied. When the list shrinks under it (a filter, a bulk delete, a book
   deleted on another device), the page clamps to the last one.
4. **Selection and the bulk bar keep today's meaning.** The header's box
   still selects every book the search and filters let through, on every
   page (`selectAllState(selection, view.rows)`). ", N not shown" still
   counts selected books the filters hide, not books on other pages. The
   selection survives a page change. This is the one product call to confirm
   when this brief is grilled: the common alternative is a header box that
   ticks only the page, plus a "Select all 1,234" offer. Don't switch to it
   unless the owner says so.
5. **Export.** "What you see now" still writes `view.rows`, every page.
   Relabel it so it doesn't read as the current page only, for example
   `This view · 1,234 books`. "Every book, every field" is unchanged.
6. **The pager.** Hide it when everything fits on one page.
   - Desktop: under the table or the covers, the column's width. On the
     left, the range as `51–100 of 1,234` (tabular figures). On the right,
     Previous, the page numbers with gaps (`1 … 4 5 6 … 25`) and Next, then
     a "Per page" menu. Use `DESIGN.md`'s secondary buttons and an existing
     menu; add no new hue or token.
   - Phone: at the end of the list, above the 76 px tab bar. Previous,
     `Page 3 of 25`, Next, with 44 px targets, and "Per page" as accent text.
     The phone's toolbar has no room for another control (DESIGN.md), so
     nothing goes there.
   - The caption under the title ("1,234 books, newest first") keeps the
     total; the range lives in the pager.
7. **Changing page.** Scroll so the top of the list sits just under the
   sticky top bar on the desktop, or at the top of the window on a phone.
   Focus stays on the control that was pressed. A polite live region reads
   the new range.
8. **Keyboard.** The arrows in the table and the grid move within the page
   and stop at its first and last row. They don't turn the page.
9. **DESIGN.md.** Add a Library bullet for the pager in the voice of the
   others. Where "the header's box selecting the rows on show" now means
   every page, say so.
10. **Tests.** Pure helpers only, per the "only lightweight tests" decision
    in [decisions.md](../../wiki/decisions.md): page count (including an empty
    list), the slice, clamping, and the numbers with gaps at the ends and in
    the middle. Nothing boots the app.

## Acceptance

- `npm test` and the typecheck pass.
- A browser walk on a scratch `DATA_DIR` seeded with a few hundred books,
  never the owner's `data/shelfmark.db`:
  - The table and the covers show 50 books per page, and the pager moves
    between pages on the desktop and on a phone-sized window.
  - Search, a filter, a sort change and a tab switch each land on page 1.
  - Open a book from page 3, then press Back: page 3 at the same scroll.
  - Tick the header's box on page 2: the bulk bar counts every book the
    filters let through. A bulk delete that empties the last page lands on
    the new last page.
  - "This view" export writes every page's rows.
  - With 50 books or fewer the pager is gone.
- At done time, [library-table.md](../../wiki/library-table.md) states the
  pages (its "Shape" and "Selection and the bulk bar" sections and the
  summary), and `DESIGN.md` matches what was built.

## Outcome (2026-11-02)

Built on local `main` in `1a9f484`, not pushed, not deployed.

- `pagination.ts` holds the helpers (page count, slice, clamp, range, the
  page numbers with gaps, and `showsPager`); `LibraryView` gained `page`,
  `pageCount`, `pageSize`, `pageRows` and `pageBasis`; `rows` keeps its
  meaning. Both virtualizers stay and render `pageRows`. The page size is
  `LibraryPrefs.pageSize`, 50 when missing or unknown.
- The current page lives in `state.ts` with what it was turned on (tab,
  search text, filters, sort, size). When any of them changes the view is on
  page 1 and forgets the old page, so a round trip (Wishlist and back, a
  search typed and cleared) doesn't bring it back. Back from a book keeps it.
- The header's box, ", N not shown" and the "This view · N books" export
  cover every page, as the brief said; that call was not grilled with the
  owner and stays open ([status.md](../../wiki/status.md)).
- Fixed on the way: an arrow pressed at the page's first or last row or
  cover left a pending focus target that the next render acted on, so a
  page turn moved focus from Previous onto a cover and Enter opened a book.
  The arrow now does nothing there, and a pending target is dropped when
  the page's rows change.

Calls made beyond the brief:

- The pager also stays when a size over 50 puts more than 50 books on one
  page, showing only the range and "Per page". Otherwise choosing 200 with
  150 books would hide the only way back to 50.
- A turn only scrolls up to the list's top, never down, so a short last
  page whose top is already in sight doesn't jump.
- Table / Covers keeps the page (the brief's reset list doesn't name it). A
  switch between the desktop and phone layouts lands on page 1, since each
  layout has its own sort and size.

Checks: `npm run typecheck`, `npm run lint`, and the unit tests for the
files touched (`pagination`, `prefs`, `view`, `savedViews`, `selection`,
`bulk`: 6 files, 70 tests, 19 of them new in `pagination.test.ts` and 4 in
`prefs.test.ts`). The full `npm test` was not run; this run keeps to the
lightweight tests in [decisions.md](../../wiki/decisions.md). Nothing called
Google Books or any catalog.

Browser walk on a scratch `DATA_DIR` with 320 owned and 12 wishlist books
added through `POST /api/books`, desktop 1280 px and a Pixel 7 profile
(412 px): 50 a page in the table and the covers; Next puts the list's top
at 63 px on the desktop and 0 on the phone with focus kept and the range
announced; search, a status filter, a sort, the tab, and "25 per page"
each land on page 1; a book opened from page 3 comes Back to page 3 at the
same scroll; the header's box on page 2 says "80 selected" for an
80-book filter and the selection survives a turn; deleting the 5 books of
page 4 lands on page 3; the CSV of "This view · 75 books" had 75 rows while
page 3 showed; the 12-book Wishlist has no pager; the phone's targets are
44 px with no sideways scroll.

Left as they were: the comments in `columns.ts` and `export/fields.ts` that
still say "What you see now" (outside this brief's files).

Owner: deploy the web app from `vps-deploy` with
`node cli.ts shelfmark deploy`, then check the pager on the Android phone.
