# Task 15: Romanian library catalogs over Z39.50

## Context

Romanian books, older ones especially, are missing from Open Library and
Google Books. Three Romanian library catalogs answer ISBN searches over
Z39.50 and found 33 of 40 trade books from 2012-2015. Read the 2026-10-17
sections of [metadata-lookup.md](../../wiki/metadata-lookup.md) (targets, hit
rates, caveats), the decision "Romanian books: library catalogs and the CIP
lists before Google" in [decisions.md](../../wiki/decisions.md), and *Library
catalog* in [glossary.md](../../wiki/glossary.md). Promoted from
[z3950-library-source](../../todos/z3950-library-source.md).

Depends on brief 05. Brief 16 builds on this one's contract changes.

## Files you OWN

```
shared/src/lookup.ts  shared/src/lookup.test.ts  shared/src/book.ts (METADATA_SOURCES only)
server/src/lookup/z3950/*.ts  server/src/lookup/z3950/fixtures/*
server/src/lookup/libraries.ts  server/src/lookup/libraries.test.ts
server/src/lookup/merge.ts  server/src/lookup/queue.ts  (and their tests)
server/src/routes/lookup.ts  server/src/routes/lookup.test.ts
server/src/app.ts  server/src/testing/*   (the new `connect` on FeatureContext)
server/scripts/measure-lookup.ts
web/src/add/words.ts  web/src/add/ResultSheet.tsx  web/src/book/BookDetails.tsx
web/src/library/columns.ts   (source names and the found line only)
```

## Files you must NOT touch

The book store, auth, covers, the cache's table (brief 05's migration).

## What to do

1. **Contract.** `LOOKUP_SOURCES` gains `biblacad`, `bcucluj` and
   `bcutimisoara`; `METADATA_SOURCES` gains the same three. There is no
   migration, because `metadata_source` and `lookup_cache.source` have no
   CHECK. `Draft.source` (`openlibrary | googlebooks | both`) becomes
   `sources: LookupSource[]`, the contributors in the order asked, never
   empty. `draftMetadataSource` takes the first.
2. **Order and rule** (`server/src/lookup/merge.ts`, `server/src/routes/lookup.ts`): Open Library,
   `biblacad`, `bcucluj`, `bcutimisoara`, Google Books. Ask the next source
   only while the merged draft has no title. A missing cover no longer sends
   the lookup to Google. `isThin` goes.
3. **Z39.50 client** (`server/src/lookup/z3950/`, no dependency): BER encoding and decoding for
   what's needed: InitializeRequest/Response, SearchRequest/Response (Bib-1
   attribute set, type-1 RPN query, use attribute 7), PresentRequest/Response,
   and diagnostics. Each lookup opens one TCP connection and sends init, then
   search, then present (at most 5 records) if there are hits, then closes.
   No server piggybacks records on the search, so present is always needed.
   10 s for the whole exchange. A 978 ISBN is asked as `@or <isbn13>
   <isbn10>`, since books from before 2007 are catalogued under the ISBN-10;
   a 979 ISBN as itself. The record syntax is set per target: UNIMARC for the
   Academy and BCU Timișoara, USMARC for BCU Cluj, which offers nothing else
   but sends UNIMARC content anyway. `implementationName` is `Shelfmark`.
4. **UNIMARC reader** (`server/src/lookup/z3950/unimarc.ts`): ISO 2709 records, UTF-8 (field 100
   positions 26-27 `50`). Use the record whose 010 matches the ISBN, else the
   first. The mapping:
   - **Title:** 200 $i (part title) if present, else $a.
   - **Subtitle:** 200 $e.
   - **Authors:** 700/701 as "$b $a", then 710/711 $a. Never 702, which holds
     translators. Fall back on 200 $f.
   - **Publisher:** 210 $c, else 214 $c.
   - **Year:** 210/214 $d, else 100 positions 9-12.
   - **Pages:** the number before "p" in 215 $a.
   - **Language:** 101 $a, through the existing MARC map.
   - **Description:** 330 $a.
   - **Subjects:** 606 $a.

   Strip the non-sorting marks (`<<Un>>`, and the NSB/NSE bytes) and
   trailing ISBD punctuation. In Romanian records, turn cedilla ş/ţ into
   comma-below ș/ț. A record has no cover. The cached raw answer is
   `{ hits, records: [base64 ISO 2709] }`.
5. **Politeness** (`queue.ts`): one queue per library and one request at a
   time. After a request ends, wait a random 5-10 s before the next starts.
   `createQueue` gains a spacing function and a measure-from-the-end mode;
   Open Library and Google keep theirs. The cache works as for the other
   sources: found forever, not found 7 days, errors never.
6. **Tests without the network.** `FeatureContext` gains `connect` (TCP)
   beside `fetch`. `startTestApp` refuses connections by default. A fake
   Z39.50 server on localhost replays PDUs recorded from the real servers:
   init, a found search and present, a not-found search, an ISBN-10 record, a
   diagnostic.
7. **Web.** The names are "the Romanian Academy Library", "BCU Cluj" and
   "BCU Timișoara". The found line credits the library: "Found in the catalog
   of BCU Cluj". The not-found wording stays truthful from `tried`, as now.
   Metadata-source labels in the table and on the book page.
8. **Measurement.** `measure-lookup.ts` asks the libraries too, at the same
   pace, and asks Google only when passed `--google`.

## Acceptance

- Tests use recorded fixtures only; nothing reaches the network.
- Tests cover BER round trips, the PDUs against the recorded bytes, the
  UNIMARC mapping on every fixture, the OR query for 978 ISBNs, the queue's
  random pause measured from the end, the order rule (Google not asked when a
  library found a title), and diagnostics and timeouts as `error`, never
  cached.
- Against the dev server, with the real libraries (a handful of requests):
  - `9786068044873` returns *Piramida roșie* from a library, with pages.
  - `9789735761868` (catalogued under 973-576-186-6) is found.
  - `9786064031365` is found at BCU Timișoara.
  - None of the three asks Google.
- `npm run typecheck && npm run lint && npm test` pass.

## Owner step

After the next deploy, check from the VPS that outbound TCP to port 9991
works (a lookup of `9786068044873` that names a library).

## Outcome

_2026-10-17_. Done. The Z39.50 client has no dependency
([z3950/](../../../server/src/lookup/z3950/client.ts): BER, the PDUs, one
exchange per lookup) and reads UNIMARC. Six exchanges recorded from the real
servers are the fixtures (`server/scripts/record-z3950.ts` re-records them),
replayed in memory by `server/src/testing/fakeLibraries.ts`; `startTestApp`
refuses TCP by default. Against the real sources with no Google key:
*Piramida roșie* came from the Academy (542 p.), *Un an în Provence* by its
ISBN-10 from the Academy, and *Ce ne facem cu atîția proști?* from BCU
Timișoara after the other two missed. Google wasn't asked for any of them.
Found while building: BCU Timișoara sometimes doesn't answer the Init within
10 s, though the same bytes get an answer a minute later, so that is an
`error` the owner can retry, never cached. In Romanian records the
character-set code in field 100 is unreliable (the Academy writes 01 and
sends UTF-8), so the reader always decodes UTF-8. The year can sit in 210 $e
(BCU Timișoara). Two lookups in a row that both reach the Academy take about
10 s for the second, which is the pause doing its job. The web app names the
libraries ("Found in the catalog of BCU Cluj"), and the README and docs show
the new order. 48 new tests, 563 in all.
