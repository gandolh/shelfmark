# Task 23: Wishlist

## Context

Promoted 2026-10-23 from the todo [wishlist](../../todos/wishlist.md). The owner
asked for it on 2026-10-14 ([features.md](../../wiki/features.md), v1.x).

Books the owner wants but doesn't own. The storage is already there: `books` has
`collection` (`owned` or `wishlist`, default `owned`), and a wishlist row has no
shelf, condition or acquisition ([data-model.md](../../wiki/data-model.md)). What
is missing is everything you see (checked 2026-10-23):

- [`web/src/library/view.ts:45-47`](../../../web/src/library/view.ts) filters the
  library to `collection === "owned"` ("the wishlist brief adds the other
  collection"), and [`columns.ts:9`](../../../web/src/library/columns.ts) leaves
  `collection` out of the columns on purpose.
- `POST /api/lookup` already answers `owned` and `wishlisted` copies for an ISBN
  ([`shared/src/lookup.ts`](../../../shared/src/lookup.ts)).
- The scan result sheet is [`web/src/add/ResultSheet.tsx`](../../../web/src/add/ResultSheet.tsx);
  the add flow's reducer is [`web/src/add/flow.ts`](../../../web/src/add/flow.ts).
- [`BookDetails.tsx:96`](../../../web/src/book/BookDetails.tsx) already shows
  "Collection: Wishlist" on a wishlist row.

The wishlist is a second collection inside Library, never a third place in the
navigation ([decisions.md](../../wiki/decisions.md), "Two places only").

## Files you OWN

- `web/src/library/view.ts`, `LibraryPage.tsx`, `Toolbar.tsx`, `library.css` and
  their tests
- `web/src/library/prefs.ts` (remembering the last tab, per layout)
- `web/src/add/ResultSheet.tsx`, `flow.ts`, `flow.test.ts`, `add.css`
- `web/src/book/` (an "I bought it" action on a wishlist book)
- `web/src/export/` (only if export needs to know which collection it is on)
- `shared/src/book.ts` only if a schema needs a fix for the move to owned

## Files you must NOT touch

- `server/src/db/migrations.ts`: no schema change is needed.
- The navigation: no new route at the top level.

## What to do

1. **Tabs under the page title**: Owned and Wishlist, with a count each. The same
   table, covers view, search, filters, column picker and export work on both. The
   wishlist hides the columns that are always empty there (shelf, condition,
   acquired). The last tab is remembered per layout, like the column layout.
2. **Scanning a book you don't own** (no `owned` copies): the sheet offers "Add to
   wishlist" beside "Save to a shelf". Adding to the wishlist saves with
   `collection: "wishlist"` and no shelf.
3. **Scanning a wishlisted book**: the sheet says "On your wishlist" and offers
   "I bought it", which asks for a shelf (the existing shelf picker) and moves the
   row to Owned (`collection: "owned"` plus the shelf, `acquired_on` today). It
   does not create a second row.
4. **On a wishlist book's page**: the same "I bought it".
5. A book both owned and wishlisted (two rows with one ISBN) is allowed; the sheet
   leads with the owned copy, as it does for duplicates now.

## Acceptance

- Scan an ISBN you don't own, "Add to wishlist": it shows under Wishlist only.
- Scan it again: the sheet offers "I bought it"; pick a shelf; the same row is now
  under Owned with that shelf and today's date, and the Wishlist count dropped by one.
- Export from the Wishlist tab exports the wishlist rows only.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-23)

Built as specified, no migration. Library has Owned / Wishlist tabs with counts
(`LibraryPrefs.collection`, saved per layout); the wishlist hides shelf, condition
and both acquired columns; export follows the open tab. The scan sheet offers
"Add to wishlist" on a found book (`collection: "wishlist"`, no shelf) and a new
`wishlisted` step ("On your wishlist", shelf picker, "I bought it"); an owned copy
still leads when both exist. "I bought it" is one `PATCH` with
`{ collection: "owned", shelf, acquiredOn: today }`, also on a wishlist book's page
(`web/src/book/BuyIt.tsx`). Switching tab clears the filters.

Deviation from the file list: `web/src/add/AddBookPage.tsx` (the sheet actions are
wired there) and `web/src/add/words.ts` (the live-region wording) also changed;
no other brief owns either. `columns.ts`'s header comment still says the
wishlist is future work. Not checked in a browser; gates and unit tests only.
