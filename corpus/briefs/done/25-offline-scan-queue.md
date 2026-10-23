# Task 25: Offline scan queue

## Context

Promoted 2026-10-23 from the todo
[offline-scan-queue](../../todos/offline-scan-queue.md) (v1.x in
[features.md](../../wiki/features.md)). **Run it after brief 24**, which adds the
IndexedDB layer this one writes to.

Scans made offline wait on the device and are looked up and offered for
confirmation once the network is back. The lookups go through the server's own
per-source queues ([`server/src/lookup/queue.ts`](../../../server/src/lookup/queue.ts)):
one request at a time per source, with the polite spacing
[metadata-lookup.md](../../wiki/metadata-lookup.md) describes. A batch does not get
a faster path; it waits its turn like any other lookup.

## Files you OWN

- `web/src/offline/` (the queue: ISBN, when it was scanned, the shelf chosen at
  the time if any)
- `web/src/add/` (queueing an offline scan; the "Waiting to look up" list on
  Add a book)
- `web/src/pwa/OfflineNotice.tsx`

## Files you must NOT touch

- `server/src/lookup/`: no batch endpoint. The client sends the queued ISBNs one
  `POST /api/lookup` at a time, so the server's queues stay in charge of pacing.
- `web/src/sw.ts`: no background sync. The queue drains while the app is open.

## What to do

1. Offline, after brief 24's answer, a scan of a book not in the copy offers "Look
   it up later". It joins the queue with its ISBN and the shelf picked, if any. A
   second scan of a queued ISBN says it is already waiting.
2. Add a book shows "Waiting to look up (3)" when the queue is not empty.
3. When the browser is back online (the `online` event, and on app start), look the
   queued ISBNs up one after another. Each result lands in the list as a proposal
   to confirm, with the same sheet as a live scan, then save or discard. Nothing is
   saved without a confirm.
4. A lookup that finds nothing keeps the ISBN in the list for the manual form.
5. Sign out clears the queue.

## Acceptance

- Offline, scan three books not owned and queue them; reload the app: still three.
- Back online: the three are looked up in turn, and each can be saved to a shelf or
  discarded; the list empties as you go.
- A queued ISBN no source knows opens the manual form with the ISBN filled.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-23)

Built as specified, with these choices:

- `offline/db.ts` is at version 2: store `queue` (key `id`, auto-increment), and the write
  chain (`inOrder`) moved there so the library copy and the queue share one. `offline/queue.ts`
  holds a record per scan (`isbn13`, `scannedAt`, `shelf`) and the pure parts (`isQueued`,
  `inScanOrder`, `nextWaiting`); `offline/queueStore.ts` holds the in-memory side (answers,
  the scan in flight) and `useScanQueue`.
- Looking up is one `POST /api/lookup` at a time (`startScanQueue(lookupIsbn)`), started from
  `OfflineNotice` (app start, whichever page is open), from Add a book, and on every `online`
  event. A network error stops the loop until the next `online`; a server error marks that
  scan "didn't work" (retried on the next `online`). Answers live in memory: a reload asks again.
- "Look it up later" (with a shelf picker) is on the offline answer when the book is absent
  and on the failed step when the failure is a network one. A second scan of a queued ISBN
  says it is already waiting. Flow: `queued` event back to `ready` with a `queued` notice,
  `show-queue` opens the new `queue` step (the list), `open-queued` turns an answer into the
  usual `found` / `owned` / `wishlisted` / not-found form step, on the queued shelf. A refused
  lookup opens the by-hand form with the ISBN filled.
- Opening a scan does not remove it. `FlowState.queued` holds the scan's id while the sheet
  is still that scan's (its answer, "Edit details", "Add another copy"). The page takes the scan
  out of the queue only when its book is saved (shelf, wishlist, "I bought it", or the form) or
  the owner discards (the sheet's discard/next, or "Remove" in the list). Leaving any other way
  (mode switch, another ISBN, retry, reload) keeps it queued and listed. After saving or
  discarding, the scanner is back and "Waiting to look up (N)" shows the rest. Not run in a browser.
- Sign out awaits `clearScanQueue()` in `account/actions.ts`. `web/src/sw.ts`, the server and
  `books/store.ts` are untouched. No `fake-indexeddb`: the IndexedDB calls are thin and untested.
