# Task 20: The first read wins

## Context

On 2026-10-18, after brief 19, the owner said a press doesn't need two
agreeing reads. If the ISBN doesn't look right, they press again. Brief 17
added the agreement against misreads when the camera read by itself. Now that
every read follows a press and the owner sees the ISBN, the second read only
costs time.

## Files you OWN

```
web/src/scanner/confirm.ts  web/src/scanner/confirm.test.ts   (removed)
web/src/scanner/detector.ts  web/src/scanner/detector.test.ts
docs/architecture.md
corpus/wiki/scanning.md  corpus/wiki/features.md  corpus/wiki/decisions.md
```

## What to do

1. **A press ends on the first read that decodes a code.** It still reads
   every 150 ms for at most 3 s, and the ISBN still wins over a sticker in
   the same read.
2. **A sticker read first** still waits two more reads (450 ms) for an ISBN
   beside it. That isn't agreement. It keeps a shop sticker from landing
   first when both are in view.
3. Remove `confirm.ts` and the confirmer from `codesFrom`.
4. Update the decision "The camera reads only on a press" (its "until two
   reads agree"), with a log entry.

## Acceptance

- Unit tests: one read with an ISBN ends a press; a misread is taken as
  read; the sticker waits; nothing read by 3 s; cancel.
- `npm run typecheck && npm run lint && npm test` pass.

## Outcome

_2026-10-18_. Built inline. 618 tests: the confirmer's tests went with it,
and `readCode` gained one for an ISBN beside a sticker in the same read.
`confirm.ts` is removed; `codesFrom` takes only the detections. No browser
rerun: the change is inside `readCode`, whose tests drive the read timing.
In brief 19's browser check, two reads per press now become one.

**Owner check** (phone, Scan): a tap over a book reads on the first frame
it decodes. If the ISBN on the sheet looks wrong, tap *Not this book*, then
*Scan the barcode* again.
