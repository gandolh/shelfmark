# Task 02 — Ten a page, the page's tick box, the full width, a header card

## Context

The owner looked at the live Library on 2026-11-04: a 1920 px desktop
screenshot of 665 books sorted by price, and a phone screenshot of Covers
with the "Filter and sort" sheet open. Five changes were settled in a grill
the same day. They are small and touch the same files, so they ship as one
brief.

- The table at 1920 px scrolled sideways (Author cut off) while the page
  left empty space on both sides: every page is capped at
  `--page-width: 1180px` (`tokens.css` (removed 2026-11-12)).
- In the phone's "Filter and sort" sheet the sort field picker ("Price")
  floats over the Tags and Language rows instead of sitting under "Sort by".
  Cause: two rules share `.library-select` in
  `library.css` (removed 2026-11-12). The first (near line
  449) wraps the sort `<select>`; the second (near line 778) is the table
  row's tick-box label, `position: absolute; inset: 0; padding-left: 24px`,
  and it comes later, so it wins.
- [Brief 01](../done/01-library-pages.md) step 4 named the header's tick box
  as the one call to confirm. The owner chose the common alternative: the
  box ticks the page, and a line offers every page.

Read [library-table.md](../../wiki/library-table.md) ("Shape" and "Selection
and the bulk bar") and `DESIGN.md` ("Layout") before starting. Use the
glossary's words: book, collection, Owned, Wishlist.

## Files you OWN

- [pagination.ts](../../../web/src/library/pagination.ts),
  `pagination.test.ts`, [Pager.tsx](../../../web/src/library/Pager.tsx).
- `prefs.test.ts` (the page size cases only).
- [selection.ts](../../../web/src/library/selection.ts),
  `selection.test.ts`, and the selection part of
  [state.ts](../../../web/src/library/state.ts).
- [LibraryPage.tsx](../../../web/src/library/LibraryPage.tsx),
  [BookTable.tsx](../../../web/src/library/BookTable.tsx),
  [CoversGrid.tsx](../../../web/src/library/CoversGrid.tsx),
  [BulkBar.tsx](../../../web/src/library/BulkBar.tsx), the delete dialog in
  [BulkDialogs.tsx](../../../web/src/library/BulkDialogs.tsx),
  `library.css` (removed 2026-11-12).
- [Page.tsx](../../../web/src/layout/Page.tsx) and
  `shell.css` (removed 2026-11-12): two opt-in props, so no
  other page changes.
- `DESIGN.md`: the Layout section.

## Files you must NOT touch

- `server/`, [store.ts](../../../web/src/books/store.ts): the list stays whole.
- `savedViews.ts`, `savedViewsStore.ts`: a saved view stores no page, size
  or selection.
- `tokens.css` (removed 2026-11-12): `--page-width` stays
  1180 px for every other page. No new token or hue.
- [Toolbar.tsx](../../../web/src/library/Toolbar.tsx): how its buttons are
  grouped is [brief 03](03-library-toolbar-groups.md)'s.

## What to do

1. **Page sizes.** "Per page" offers 10, 25, 50 and 100, 10 by default on
   both layouts. 200 goes. A saved size no longer offered (200) reads as 10;
   `prefs.ts` already falls back through `isPageSize`. A saved 25, 50 or 100
   stays. `showsPager` keeps brief 01's reason in the new sizes: the pager
   shows when the list runs past one page, or when more books than the
   smallest size (10) sit on one page, so "Per page" stays in reach to go
   back down. Fix the comments that say 50 (`pagination.ts`, `Pager.tsx`,
   `view.ts`).
2. **The header's tick box ticks the page.** In the table header it ticks or
   unticks only the books on the page on show, with the dash when some of
   them are ticked.
   - When every book on the page is ticked and the list runs past the page,
     a line above the list says "All 10 books on this page are selected."
     and offers **Select all 665 books** (every book the search and filters
     let through, on every page). Once chosen it says "All 665 books are
     selected." with **Clear selection**. Gmail's pattern.
   - **The rule: a bulk action (delete, tags, shelf, status) never reaches a
     book off the page on show unless the owner chose "Select all".** Enforce
     it where the ids are sent: the books a change reaches are the ticked
     books on the page, or, after "Select all", the ticked books in the list.
     The bulk bar's count is the same set. A pure helper in `selection.ts`
     makes that set.
   - Calls made for the rule. The selection belongs to the list and the page
     it was made on, kept in `state.ts` beside them as the page is. A turn of
     the page, a new page size, a sort, a filter, the search, the tab or a
     saved view lets it go; after "Select all" a turn keeps it. Unticking one
     book after "Select all" goes back to the page's ticks less that book.
     The selection still survives a bulk change on the same page, so another
     can follow, and opening a book and coming Back. Since nothing out of
     sight can be reached any more, ", 1 not shown" in the bar and the delete
     dialog's "not on show" line go.
   - **Covers** has no header box. While covers are ticked the same line
     offers "Select all 10 on this page" first, then "Select all 665 books"
     as in the table. The same rule and the same clearing apply.
   - Bulk changes keep their one `POST /api/books/bulk` each.
3. **The Library fills the window.** On the desktop the Library page (Table
   and Covers) runs the window's width less the 40 px gutters, no cap. Every
   other page keeps the 1180 px column. Add a `wide` prop to `Page`; the
   table's book column and the covers grid already take the width they get.
4. **The header card.** The Library's title row (the title, the caption like
   "665 books, by price, dearest first", and the toolbar) sits on a card
   like the table's container: `--surface`, `--radius-container`, flat. The
   Owned / Wishlist tabs stay under it on the ground. On a phone the card
   holds the title with the account button, the search box and the toolbar
   row, inside the 16 px gutters. Add it as a `Page` prop (`card`), Library
   only.
5. **The sort picker.** Rename the table's tick-box label (`.library-select`
   near line 778, its `input` rule and the phone overrides) to its own
   class, and the selector `BookTable` uses to focus it. Grep the repo for
   the old name afterwards: only the sort select's wrapper keeps it.
6. **Tests.** Pure helpers only, per the "only lightweight tests" decision
   in [decisions.md](../../wiki/decisions.md): the sizes and the default, a
   saved 200 reading as 10, `showsPager` at the new sizes; the header box
   over a page (a `deriveView` with a small page size), the set a bulk
   change reaches before and after "Select all", the line's states, and the
   selection let go when the list or the page changes.

## Acceptance

- `npm run typecheck`, `npm run lint` and the unit tests near the change
  pass (`pagination`, `prefs`, `selection`, `view`, `bulk`).
- A short browser look on a scratch `DATA_DIR` (never the owner's
  `data/shelfmark.db`, no lookups):
  - 10 books a page; "Per page" lists 10, 25, 50, 100.
  - Ticking the header box ticks 10; the line offers every book; after it,
    the bar counts them all and a turn keeps them; Clear selection empties it.
  - Ticking a few books on page 1 and turning to page 2 leaves nothing ticked.
  - At 1920 px the table and the covers fill the window less the gutters and
    the table doesn't scroll sideways with the default columns; another page
    (a book) keeps the 1180 px column.
  - The header card on the desktop and on a phone width; the tabs on the
    ground under it.
  - On a phone width, "Filter and sort" in Covers: the sort picker sits
    under "Sort by".
- At done time, [library-table.md](../../wiki/library-table.md),
  [design.md](../../wiki/design.md) and `DESIGN.md` say what was built.

## Outcome (2026-11-04)

Built on local `main`, not pushed, not deployed.

- `PAGE_SIZES` is `[10, 25, 50, 100]`, `DEFAULT_PAGE_SIZE` 10. A saved 200
  reads as 10; a saved 25, 50 or 100 stays. `showsPager` keeps the pager
  when more than 10 books (the smallest size) sit on one page.
- The selection in `state.ts` is a `SelectionChoice`: the ticked books,
  their scope (`page` or `all`), and the page basis and page number they
  were ticked on. `selectionFor` answers the choice while they still hold
  (a turn is allowed after "Select all"); LibraryPage clears a choice that
  no longer applies, as view.ts forgets an old page. `reachedBooks` in
  `selection.ts` is the set a bulk change sends and the bar counts: ticked
  books on the page, or in the list after "Select all". Every tick starts
  from the page's own ticks (`pageTicks`), so nothing off the page comes
  along.
- The band above the list (`SelectionBand`, `selectionLine`): "All 10 books
  on this page are selected. Select all 126 books", then "All 126 books are
  selected. Clear selection". The same button node carries each step, so
  focus stays on it. In Covers it also offers "Select all 10 on this page"
  while some covers are ticked. In the table it stays hidden while the page
  is the whole list, as the header box already says it.
- The bar's ", N not shown" is gone. The delete dialog says "That is every
  book in this list, on every page, not only the page on show" after
  "Select all".
- `Page` has `wide` (desktop, no 1180 px cap) and `card` (the header on
  `--surface` with `--radius-container`); only the Library uses them.
- The tick-box label is `.library-tick`; `.library-select` is the sort
  select's wrapper only.

Calls made beyond the brief:

- On a phone the card runs edge to edge with its lower corners rounded and
  the header's old padding. Inset in the 16 px gutters it took 28 px from
  the toolbar row, which then wrapped at 390 px (Covers / Table, "Filter and
  sort" and "Export" need 334 px).
- The "what the last change did" line stays when the change took the ticked
  books off the page (a status filter, say), so the owner sees why they
  went; before, it showed only while the bar was up.
- Unticking one book after "Select all", or a long press on one, goes back
  to the page's ticks; a long press on a book already ticked changes nothing.
- Clearing the selection on a sort, filter, search, tab or saved view goes a
  step past what the owner said; it is in
  [open-questions.md](../../wiki/open-questions.md).

Checks: `npm run typecheck`, `npm run lint`, and the unit tests in
`web/src/library/` (10 files, 129 tests; `selection.test.ts` rewritten for
the page, `pagination` and `prefs` for the sizes). The full `npm test` was
not run, per the lightweight tests decision. Nothing called Google Books or
any catalog.

Browser look on a scratch `DATA_DIR` (126 owned and 6 wishlist made-up
books added through `POST /api/books`, no ISBNs, `CIP_REFRESH=off`, no
Google key): at 1920 px the table and the covers run the window less the
gutters, the table has no sideways scroll, and a book page is still
1180 px; the header box ticks 10 and the band offers 126; after it the bar
says 126, a turn to page 13 keeps them, the delete dialog says every page;
unticking one leaves the page's 5; Previous then leaves nothing ticked.
"Per page" lists 10, 25, 50, 100. At 1280 px the table fits. On a Pixel 7
(412 px), 390 px and 360 px: the card, the toolbar row as before (it wraps
at 360 px, as it did), a long press then the band's "Select all 10 on this
page" then "Select all 126 books", and the sort picker under "Sort by" in
"Filter and sort".

Seen, not changed: at 1920 px the covers grid fits 11 across, so a page of
10 leaves its one row short.

Owner: deploy the web app from `vps-deploy` with
`node cli.ts shelfmark deploy`, then on the Android phone check the header
card, a long press and the band in Covers, and "Filter and sort".
