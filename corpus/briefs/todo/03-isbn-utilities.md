# Task 03: ISBN utilities

## Context

One small shared module that every way of adding a book relies on: the camera
scanner (brief 07), the ISBN field and USB scanners (brief 09), and the lookup
route (brief 05). The rules are in [scanning.md](../../wiki/scanning.md)
("What a code means"). Pure functions, no dependencies, exhaustive tests.

Depends on brief 01. Runs alongside brief 02.

## Files you OWN

```
shared/src/isbn.ts  shared/src/isbn.test.ts   (and one export line in shared/src/index.ts)
```

## Files you must NOT touch

Everything else.

## What to do

1. `clean(input)`: strip spaces, hyphens and dots; uppercase a trailing `x`.
2. `isValid13(digits)`, `isValid10(chars)`: check-digit validation (ISBN-10
   allows `X` as the last character only).
3. `to13(isbn10)`: prefix `978`, recompute the check digit.
   `to10(isbn13)`: only for `978`; returns `null` for `979`.
4. `parseIsbn(input)`: `clean`, then accept a valid ISBN-13 (`978`/`979`) or a
   valid ISBN-10 (converted to 13); returns `{ ok: true, isbn13 }` or
   `{ ok: false, reason: "length" | "checksum" | "not_isbn" }`. A valid EAN-13
   that does not start `978`/`979` is `not_isbn`.
5. `classifyBarcode(raw, format?)` for scanner output:
   - EAN-13 starting `978`/`979` with a valid check digit → `{ kind: "isbn", isbn13 }`;
   - a 2- or 5-digit code (price add-on) → `{ kind: "addon" }` (callers ignore it);
   - anything else (store stickers starting `2`, UPC-A, EAN-8, Code-128) →
     `{ kind: "other", code }`.
6. No hyphenation for display: correct hyphens need the ISBN range tables, and
   wrong hyphens are worse than none. Show bare digits.

## Acceptance

- Tests cover: valid and invalid ISBN-13s (including the Romanian samples in
  [metadata-lookup.md](../../wiki/metadata-lookup.md) and `9786063205583`),
  ISBN-10s with `X`, round trips 10 → 13 → 10, `979` → `to10` is `null`,
  hyphenated and spaced input, a 5-digit add-on, a store sticker `2…` code,
  and a UPC-A.
- `npm run typecheck && npm run lint && npm test` pass.
