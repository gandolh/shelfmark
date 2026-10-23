# Task 24: Offline "do I own this?"

## Context

Promoted 2026-10-23 from the todo
[offline-owned-check](../../todos/offline-owned-check.md) (v1.x in
[features.md](../../wiki/features.md)): the most-cited away-from-home use of these
apps is scanning in a bookshop with no signal.

Today the answer needs the network (checked 2026-10-23): the scanner's read goes to
`POST /api/lookup`, which answers the `owned` and `wishlisted` copies for the ISBN.
The service worker ([`web/src/sw.ts`](../../../web/src/sw.ts)) precaches the app
shell and covers, and nothing else under the API ("every other API call goes to the
network"). There is no IndexedDB use in `web/src` yet.

## Files you OWN

- `web/src/offline/` (new): an IndexedDB copy of the owned and wishlisted ISBNs
  and its tests
- `web/src/books/store.ts` (refreshing the copy whenever the book list loads or
  changes)
- `web/src/add/flow.ts`, `flow.test.ts`, `ResultSheet.tsx` (the offline answer)
- `web/src/pwa/OfflineNotice.tsx` (if the offline wording needs to mention it)
- `corpus/.planned-roots` (add `web/src/offline`)

## Files you must NOT touch

- `web/src/sw.ts`: the API stays network-only. The copy lives in IndexedDB, written
  by the page, not cached by the worker.
- The server.

## What to do

1. Keep `{ isbn13, title, shelf, collection }` for every book in IndexedDB, replaced
   whole each time the library list arrives (it is one user's books; a full rewrite
   is simple and small). Store when it was written.
2. When a lookup fails because the device is offline (a network error, not a `4xx`),
   answer from the copy: "Already on Living room · A2" (title and shelf), "On your
   wishlist", or "Not in your library (as of <date>)". Say plainly it is the offline
   answer.
3. No copy yet (a fresh install that never loaded the library): say the offline
   check needs one visit online first.
4. Sign out clears the copy.

## Acceptance

- Load the library once, go offline (DevTools offline, or airplane mode on a
  phone), scan an owned book: the sheet says it is already on its shelf.
- Offline, scan a book you don't own: "Not in your library" with the copy's date.
- After sign out, the copy is gone.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.
