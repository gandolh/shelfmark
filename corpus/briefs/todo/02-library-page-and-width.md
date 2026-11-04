# Task 02 — Ten a page, the page's tick box, the full width, a header card

## Context

The owner looked at the live Library on 2026-11-04: a 1920 px desktop
screenshot of 665 books sorted by price, and a phone screenshot of Covers
with the "Filter and sort" sheet open. Five changes were settled in a grill
the same day. They are small and touch the same files, so they ship as one
brief.

- The table at 1920 px scrolled sideways (Author cut off) while the page
  left empty space on both sides: every page is capped at
  `--page-width: 1180px` ([tokens.css](../../../web/src/styles/tokens.css)).
- In the phone's "Filter and sort" sheet the sort field picker ("Price")
  floats over the Tags and Language rows instead of sitting under "Sort by".
  Cause: two rules share `.library-select` in
  [library.css](../../../web/src/library/library.css). The first (near line
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
  [library.css](../../../web/src/library/library.css).
- [Page.tsx](../../../web/src/layout/Page.tsx) and
  [shell.css](../../../web/src/styles/shell.css): two opt-in props, so no
  other page changes.
- `DESIGN.md`: the Layout section.

## Files you must NOT touch

- `server/`, [store.ts](../../../web/src/books/store.ts): the list stays whole.
- `savedViews.ts`, `savedViewsStore.ts`: a saved view stores no page, size
  or selection.
- [tokens.css](../../../web/src/styles/tokens.css): `--page-width` stays
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
