# Task 18: One lookup per ISBN

## Context

On 2026-10-17, after brief 17, the owner asked for two things: no calls to
outside services when an ISBN is the same as before, and the ISBNs tried kept,
with a debounce.

Most of this already exists. The browser never calls an outside service. The
server keeps every source's answer per ISBN in `lookup_cache`
([cache.ts](../../../server/src/lookup/cache.ts)): a found answer forever, a
not-found one for 7 days. Errors are never kept, so a library that timed out
is asked again. That is deliberate and stays.

Since brief 17 there are three gaps:

1. **Two lookups of one ISBN at the same time both miss the cache**, and both
   ask every source. The camera can now swap results (A, then B, then A
   again) while A's lookup is still running on the server, which goes on
   after the browser has moved away.
2. **A camera lookup goes out the moment its ISBN is confirmed.** A misread
   corrected a few reads later, or a book the camera only passed over, still
   costs that ISBN's outside calls. For an ISBN no source knows, that
   includes Google.
3. **The same ISBN again still makes a request to our own server**, even when
   the page has just shown its answer.

## Files you OWN

```
server/src/lookup/merge.ts  server/src/lookup/merge.test.ts
web/src/add/memo.ts  web/src/add/memo.test.ts   (new)
web/src/add/flow.ts  web/src/add/flow.test.ts
web/src/add/AddBookPage.tsx
corpus/wiki/metadata-lookup.md  corpus/wiki/scanning.md
```

## What to do

1. **One lookup per ISBN at a time** (`createLookup`). A request for an ISBN
   whose lookup is already running waits for that lookup and gets its result.
   No source is asked twice. The next request after it finishes is answered
   from the cache, as now.
2. **The page keeps the answers it got** (`memo.ts`, for one visit to Add a
   book). An ISBN scanned or typed again shows its answer at once, with no
   request.
   - Not kept: an answer in which a source failed, so that trying again
     still retries that source. A lookup that failed outright isn't kept
     either.
   - Saving a book forgets its ISBN, so the "already in your library" part
     is fresh.
   - The page's own state holds the memo, so leaving the page drops it.
3. **A camera lookup settles for 600 ms before it is sent.** The sheet shows
   the ISBN at once.
   - Meanwhile the scanner reads at the looking pace (250 ms), not the
     watching pace. A misread corrected in that time, or a book only passed
     over, is replaced before anything is sent.
   - A typed ISBN, *Try again* and *Look it up again* send at once.
   - 600 ms covers two read cycles even when one frame is blurred. Most
     lookups take longer than that anyway.

## Acceptance

- Unit tests:
  - Two concurrent lookups of one ISBN make one fetch per source. A lookup
    after it ends uses the cache.
  - The memo keeps clean answers, skips answers with a source error, and
    forgets an ISBN.
  - The flow: a camera step settles, a typed one doesn't, an answer the page
    already has lands at once, the watch pace waits until a step settles,
    and a different ISBN replaces a settling step.
- Manual: in headless Chrome with a fake camera, a lookup goes out about
  600 ms after the scan, and a book seen again makes no second request.
- `npm run typecheck && npm run lint && npm test` pass.

## Outcome

_2026-10-17_. Built inline, 639 tests (10 new).

- **Server.** `createLookup` keeps a map of the lookups running, by ISBN.
- **Page.** `memo.ts` is new. The `looking` step gained `settling`, the
  flow a `settled` event, and the `scanned` and `submit-isbn` events an
  optional `known` answer, which the page fills from its memo.
- **Checked** in headless Chrome 149 with a fake camera looping three
  EAN-13s (8 s each) twice, the lookups answered in the browser:
  - Three lookups in all, sent 605 and 578 ms after the second and third
    sheets appeared. The first pass started before logging.
  - On the second pass, each book showed its answer straight away with no
    request.
- **Departure.** The first run showed no reads during the settle: the read
  that fires a code scheduled the next one at the old step's 1 s pace,
  because the page hadn't drawn the new step yet. `readInterval` now takes
  `fired`, and the read after a code changes the sheet comes at the looking
  pace. Rerun: reads every 250 ms through the settle, then 1 s.

**Owner check** (phone, Scan): scan a book, scan another, then the first
again. It shows at once, and the server log has no second `lookup` line
for it.
