# Task 29: Stats, from the account menu

## Context

Promoted 2026-10-23 from the todo [stats-page](../../todos/stats-page.md) ("later"
in [features.md](../../wiki/features.md)). The owner chose on 2026-10-23: a
**Stats** item in the account menu opens a stats screen. It is not a third place
in the tab bar, so "Two places only" in [decisions.md](../../wiki/decisions.md)
stands. Rejected: a Stats button over the Library table, and a third tab.

Counts by author, language, shelf, status and decade; total spent per year.

What exists (checked 2026-10-23):

- The account menu's items are in
  [`web/src/layout/AccountMenu.tsx`](../../../web/src/layout/AccountMenu.tsx)
  (Change password, Sign in with Ward, Download a backup, then Sign out).
- Routes are a table in [`web/src/router.ts`](../../../web/src/router.ts) (`library`,
  `add`, `book`); the tab bar
  ([`TabBar.tsx`](../../../web/src/layout/TabBar.tsx)) links only Library and Add a
  book.
- Every book is already in the browser (`web/src/books/store.ts`), so the counts
  need no server route. A `Book` has `authors`, `language`, `shelf`, `status`,
  `publishedYear`, `collection`, `acquiredOn`, `priceMinor` and `currency`
  ([`shared/src/book.ts`](../../../shared/src/book.ts)).

**Run it after brief 28**, which also adds a route and an account menu item.

## Files you OWN

- `web/src/stats/` (new): the counting functions and their tests, the screen
- `web/src/router.ts` (a `stats` route, outside the tab bar's places)
- `web/src/layout/AccountMenu.tsx` (the Stats item, above Download a backup)
- `corpus/.planned-roots` (add `web/src/stats`)

## Files you must NOT touch

- `web/src/layout/TabBar.tsx`: no new tab.
- The server: no stats endpoint.

## What to do

1. Count owned books only (the wishlist is not your library); say so under the
   heading, and add "Wishlist: N" as one line.
2. Sections, each a short ranked list with counts, longest first, top 10 plus "and N
   more": authors (each author of a multi-author book counts once), languages,
   shelves (the room before " · " grouped, then shelves inside it), status, and
   decades of `publishedYear` (books with none counted as "Unknown year").
3. Money spent per year of `acquiredOn`, per currency (RON and EUR are not added
   together), with the number of books that had a price. Books with no price or no
   date are counted in a footnote, not guessed.
4. Each count links to Library with that filter applied (author, language, shelf,
   status), so a number is one press from its books.
5. Totals at the top: books owned, distinct authors, shelves in use.
6. Plain lists and numbers in the design's table style; no charts.

## Acceptance

- The counting functions are pure and tested on `web/src/library/test-books.ts` or
  a fixture like it: multi-author books, missing year, two currencies, wishlist rows
  excluded.
- From the account menu, Stats opens the screen; Back returns where you were.
- Pressing a shelf's count opens Library filtered to that shelf.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-23)

Built as specified, in `web/src/stats/`: `count.ts` (pure `computeStats`, `top`), `links.ts`,
`StatsPage.tsx`, `stats.css`, and `count.test.ts` (10 tests: multi-author, missing year, two
currencies, wishlist excluded). Route `stats`, an account menu item after Import a CSV, and the
one `PAGES` line.

- Counts link to Library. No hook in `web/src/library/` was needed: `links.ts` clears the search
  text and filters, sets one filter with the existing `setFilter`, sets the Owned tab with
  `updatePrefs` for both layouts, then navigates. Author links use a text "contains" filter
  (so a name that is part of another name also matches); a room links to all its shelves; a
  decade links to a year range. "Unknown year" has no link (a number filter cannot select
  books with none).
- Not run in a browser; covered by typecheck, lint, build and the counting tests.
