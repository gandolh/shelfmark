# Task 16: The CIP index

## Context

The library catalogs (brief 15) catalogue new books a year or more late. The
national library's monthly CIP lists announce nearly every book from a
Romanian publisher before it is printed, about 2,800 a month, as free PDFs
from 2019 on. Read the CIP parts of
[metadata-lookup.md](../../wiki/metadata-lookup.md), the decision "Romanian
books: library catalogs and the CIP lists before Google" in
[decisions.md](../../wiki/decisions.md), and *CIP* and *CIP index* in
[glossary.md](../../wiki/glossary.md). Promoted from
[cip-bibliography-index](../../todos/cip-bibliography-index.md).

Depends on brief 15 (the `sources` contract and the order rule).

## Files you OWN

```
server/src/cip/*.ts  server/src/cip/fixtures/*
server/src/lookup/cip.ts  server/src/lookup/cip.test.ts
server/src/db/migrations.ts   (append one migration)
server/src/config.ts  server/src/app.ts  server/src/index.ts   (the refresh job and its switch)
server/src/routes/lookup.ts   (the source's place in the order)
shared/src/lookup.ts  shared/src/book.ts   (add `cip`)
web/src/add/words.ts  web/src/book/BookDetails.tsx  web/src/library/columns.ts   (the name)
infrastructure/Dockerfile   (poppler-utils)
docs/getting-started.md  docs/owner-setup.md   (pdftotext, the switch, the first run)
.env.example
```

## What to do

1. **Find the issues** (`server/src/cip/issues.ts`). The national library's site is
   WordPress. Page through
   `https://bibnat.ro/wp-json/wp/v2/media?search=CIP&per_page=100` and keep
   the PDFs whose file name is CIP plus a Romanian month name and a year
   (`CIP_februarie-2026.pdf`, `CIP-martie_2025.pdf`, `BIBLIOGR-CIP-SEP-2024.pdf`).
   Map each to `YYYY-MM`. On 2026-10-17 this was 2019-01 to 2026-08, with
   2025-04 to 2025-12 missing.
2. **Download politely** (`server/src/cip/refresh.ts`). One request at a time to
   bibnat.ro, with a random 5-10 s pause between requests. Send the app's
   `User-Agent`, cap a file at 20 MB, and give each download 120 s. Only
   download issues not already imported. Run `pdftotext -layout` through
   `execFile`, never a shell.
3. **Parse** (`server/src/cip/parse.ts`). An entry starts with an indented number
   (`        267. PALEOLOGU, THEODOR. Ce ne facem ...`). Take the text up to
   `ISBN` and every ISBN in the entry. Join ISBNs broken across lines
   (`978-\n973-50-9138-5`), and don't let the regex run into the next line:
   that bug lost 96% of the records in the first try. Fields:
   - **Title:** up to ` / `, or up to `. - ` when there is no statement of
     responsibility.
   - **Subtitle:** after ` : ` in the title.
   - **Authors:** the first `;` segment after ` / `, split on `, `, ` & `,
     ` şi ` and ` cu `. Skip role phrases (`trad.`, `il.`, `coord.`,
     `ed.`). Fall back on the upper-case heading, cased from the statement
     where it appears there.
   - **City, publisher, year:** the area after ` - ` that reads
     `City : Publisher, Year`, which may follow an edition statement. Take
     the first publisher.
   - **Volumes:** a `Vol. N : ...` line with its own ISBN gives that ISBN the
     entry's title, with the volume line as its subtitle.

   Turn cedilla ş/ţ into comma-below ș/ț, then NFC. No language (the lists
   don't say), no pages, no cover. If an issue parses to fewer than 1,000
   records, log it and don't mark it imported, so a changed layout can't
   quietly leave the index empty. January to March 2026 gave 8,442 records
   with a quick parser of this shape.
4. **Store** (migration): `cip_issues (month TEXT PRIMARY KEY, url,
   imported_at, records)` and `cip_records (isbn13 TEXT PRIMARY KEY, month,
   entry, title, subtitle, authors JSON, publisher, city, year)`. A later
   issue's record replaces an earlier one. Each issue imports in one
   transaction.
5. **When it runs.** The job starts a minute after the server starts, then
   runs every 7 days. `node server/dist/cip/cli.js refresh` runs it by hand,
   and `CIP_REFRESH=off` turns the job off (tests and the seed run with it
   off). The first run fetches about 80 issues, roughly 200 MB, in about
   15 minutes at that pace.
6. **The source** (`server/src/lookup/cip.ts`). Add `cip` to `LOOKUP_SOURCES` and
   `METADATA_SOURCES`. It is local: no queue, and nothing in `lookup_cache`,
   so a refreshed record is seen at once. It comes after the libraries and
   before Google. Its draft fields are title, subtitle, authors, publisher
   and year.
7. **Web.** The name is "the CIP lists", and the found line reads "Found in
   the national library's CIP lists". The draft can say the details are
   pre-publication and may differ from the printed book; keep that to the
   found line or one quiet note.
8. **Container.** Install `poppler-utils` in the prod stage. Local
   development needs `pdftotext` on the PATH; without it the refresh logs
   one error and the lookup goes on without the source.

## Acceptance

- Parse tests on text excerpts cover an entry with an author heading, an
  anonymous work, an edition statement before the imprint, two publishers,
  a broken ISBN, a multi-volume entry and cedilla diacritics.
- Issue discovery tests use a recorded media-API page. No test touches the
  network, and none needs `pdftotext`.
- Run by hand against the real site for two issues (2026-01 and 2026-02):
  more than 2,800 records each, and `9786064031365` reads *Ce ne facem cu
  atîția proști?*, Theodor Paleologu, Editura Trei, 2026.
- Against the dev server, an ISBN from the 2026 lists that none of the
  libraries holds returns a draft from `cip`, and Google isn't asked.
- `npm run typecheck && npm run lint && npm test` pass, and the image builds
  with `pdftotext` in it.

## Owner step

Deploy, then watch the first refresh in the logs, which takes about 15
minutes.

## Outcome

_2026-10-17_. Done, with one departure. The index lives in its own database,
`<dataDir>/cip.db` ([store.ts](../../../server/src/cip/store.ts)), not in a
migration of shelfmark.db: it is about 55 MB of public data the refresh
fetches again by itself, and the owner's backup is shelfmark.db alone. The
parser ([parse.ts](../../../server/src/cip/parse.ts)) read 3,000 of 3,006
ISBNs in 2026-02, 2,810 of 2,817 in 2019-03 and 2,015 of 2,023 in 2022-06,
every record with a publisher. Layout facts it had to learn:

- Some pages sit six columns to the right, so indentation is measured
  against the entry's first line.
- Imprints can have no year or no place.
- The lists drop the full stop before " - " after a number.
- An imprint can have a second place after " ; ".
- A volume can carry its own imprint.
- Statements of responsibility can start with titles ("conf. univ. dr.") or a
  phrase ("prezentate de").

Run by hand against the real site, with `cli.ts refresh 2026-01 2026-02`:
82 issues listed, 2,951 and 3,000 records imported. `9786064031365` reads
*Ce ne facem cu atîția proști?*, Theodor Paleologu, Editura Trei, 2026.
Through the real route, `9786303672830` (*Martin spune mulțumesc*, Litera mică,
2026), which none of the libraries holds, came from `cip`, and Google wasn't
asked.

Added beyond the brief: `refresh [YYYY-MM ...]` to fetch only some months.
The job is started by index.ts, not buildApp, so no test or seed run starts
it.

The image was built once the owner started Docker. Its pdftotext (poppler
25.12.0) gave the same 3,000 records for 2026-02 as the dev machine's, and
the container came up healthy and created `cip.db`. 47 new
tests, 610 in all.
