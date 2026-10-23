---
summary: Where a scanned book's title, authors, cover and other details come from. Open Library and Google Books (with the owner's free key) compared, their limits, the hit rates measured on 2026-10-14 (Romanian ISBNs found 12-20% of the time vs 92% for English; every free keyless catalog worse still), why the national library's CIP catalog can't be used, three Romanian library catalogs over Z39.50 measured on 2026-10-17 (33/40 for 2012-2015 books, a year's lag for new ones), the national bibliography PDFs, the lookup flow and cache as shipped by brief 05 (two Open Library calls per found ISBN), how covers are downloaded (the host allowlist, Open Library's archive.org redirects) and stored, the measurement script, and the fallbacks for Romanian books.
updated: 2026-10-23
---

# Metadata lookup

## Sources

| Source | Key | Limits | Notes |
|---|---|---|---|
| Open Library | none | 1 req/s anonymous, 3 req/s with a `User-Agent` naming the app and a contact address | Crowd-sourced. `/api/books?bibkeys=ISBN:<isbn>&jscmd=data&format=json` returns resolved authors, publishers, subjects and cover URLs, but no language and no description; `jscmd=details` (the edition record) has those, as MARC codes (`/languages/rum`), and no resolved authors. So a found ISBN costs two calls. Cover URLs by cover ID are not rate limited; by ISBN they were limited (100 per 5 min per IP, as of 2011). |
| Google Books | **required in practice** | ~1,000 req/day per project by default | `GET /books/v1/volumes?q=isbn:<isbn>&key=...`. Without a key every call returned 429 "Queries per day" on 2026-10-14 and again on 2026-10-15 (`quota_limit_value` 0): keyless calls share one public quota that is always spent. |
| ISBNdb | paid | per plan | Not evaluated further; only if the free sources prove too thin. |
| Romanian National Library (BNR) | n/a | n/a | The CIP catalog (`aleph.bibnat.ro`, base `CIP`) covers nearly every book from a Romanian publisher since 1996, but every request redirects to a CAPTCHA. Not usable, and not to be worked around. Its site says its records can be taken in UNIMARC over Z39.50, but no Z39.50 port answered on 2026-10-17 (only 443). |
| BCU Cluj, BCU Timișoara, Romanian Academy Library | none (Z39.50) | none published; be polite | Public Aleph Z39.50 servers that answer an ISBN search with a full UNIMARC record. The best source found for Romanian books older than about a year. See the 2026-10-17 measurement below. |
| K10plus, BnF, DNB, Library of Congress | none (SRU) | polite | Free library catalogs with a search URL. Hold a few Romanian books (K10plus and BnF both have *Inocenții*), but see the second measurement below. Jisc refuses scripted requests. |

## Measured hit rates (2026-10-14)

ISBNs taken from Wikidata (independent of Open Library), looked up one by one
on `openlibrary.org/isbn/<isbn>.json`:

| Sample, 25 ISBNs each | Found | With cover | With page count |
|---|---|---|---|
| English, `978-0` | 23 | 18 | 18 |
| Romanian, `978-973` | 5 | 2 | 2 |
| Romanian, `978-606` | 3 | 0 | 1 |

Open Library holds about 61,500 Romanian-language works, a few hundred to about
1,000 per big publisher (Humanitas 855, Polirom 1,056, Litera 401, Nemira 175).
Titles sometimes lose their diacritics ("Inocentii").

A second measurement used ISBNs from the national library's own lists of
forthcoming books (the monthly CIP bibliography, 40 random ISBNs from March
2019 and 40 from April 2026), a sample independent of every source tested:

| Source (keyless) | 2019 | 2026 |
|---|---|---|
| Open Library | 4/40 | 1/40 |
| K10plus (GVK) | 1/40 | 0/40 |
| BnF | 1/40 | 0/40 |
| DNB | 0/40 | 0/40 |
| Library of Congress | 0/40 (22 timeouts) | 0/40 |
| Any of them | 5/40 | 1/40 |

The CIP lists include small and academic presses, so a home library of
mainstream publishers should do better, but no free keyless service is good
enough to be the Romanian fallback. Hence the owner's call
([decisions.md](decisions.md)): Google Books with a free key. Its Romanian
coverage is **still untested**: brief 05 shipped on 2026-10-15 without the key,
so the measurement waits for it.

To measure, put ISBNs one per line in a file per sample (a fresh 40 from a CIP
bibliography PDF, never from the CAPTCHA'd catalog) and run
`npx tsx server/scripts/measure-lookup.ts <file> ...`
([measure-lookup.ts](../../server/scripts/measure-lookup.ts)). It asks every
source about every ISBN through the app's own clients and queues, with no
cache, and prints a table per file: found, with cover, with page count,
errors, and "any of them". Without `GOOGLE_BOOKS_API_KEY` in `.env` the
Google row says skipped.

## Romanian library catalogs (measured 2026-10-17)

Three Romanian libraries run public Z39.50 servers (Aleph, no login). An ISBN
search (Bib-1 use attribute 7) returns a UNIMARC record with title, authors,
translator, publisher, city, year, page count, series, subjects and language,
but no cover:

| Library | Target |
|---|---|
| BCU Cluj | `aleph.bcucluj.ro:9991/CUC01` |
| BCU Timișoara | `193.230.238.122:9991/CUT01` |
| Romanian Academy Library (a legal deposit library) | `aleph23.biblacad.ro:9991/RAL01` |

Hit rates, 40 ISBNs per sample from trade publishers (Humanitas, Polirom,
Litera, RAO, Arthur, Paralela 45, Trei and the like), queried with yaz's
`zoomsh` (`measure-lookup.ts` has no Z39.50 client yet):

| Sample | BCU Cluj | BCU Timișoara | Academy | Any library | Open Library | Google Books |
|---|---|---|---|---|---|---|
| 2012-2015, national bibliography | 33 | 31 | 31 | 33 | 2 | not asked |
| 2024, CIP May 2024 | 2 | 4 | 18 | 18 | 0 | 0, 22 errors |
| 2026, CIP Jan-Mar 2026 | 1 | 2 | 0 | 3 | 0 | 0, 24 errors |

- Sixteen of the 2024 sample are children's activity and colouring books,
  which no library held. The Academy had 18 of the other 24.
- Libraries catalogue new books a year or more late. BCU Timișoara already
  had *Ce ne facem cu atîția proști?* (CIP February 2026), catalogued on
  2026-10-02.
- Books from before 2007 are catalogued under the ISBN-10. An ISBN-13 query
  misses them (checked on 973-576-186-6 in all three), so ask with the
  ISBN-10 as well when the ISBN starts with 978.
- The seven misses in the 2012-2015 sample were all one RAO pocket series
  from 2012.
- No terms of use are published. Use them the way LibraryThing uses Z39.50
  sources: one request at a time, found answers cached for good.

Google Books on 2026-10-17: 46 of 80 keyed calls answered 503, and `isbn:`
queries came back empty even for *The Hobbit*. The keyless page
`books.google.com/books?vid=ISBN<isbn>` answers 404 when Google has no
record (it did for 9786064031365) and costs no quota. The owner wants the key
used as little as possible.

The national bibliography (*Bibliografia Națională Română. Cărți, albume,
hărți*) lists every book received on legal deposit, with page counts: 24
issues a year, about 580 records each. Its PDFs from 2009 on were on the
library's old site, which answers 404 now. The Wayback Machine has full copies
of the 2010-2017 issues; take the largest capture of each file, since some
were cut off at 1 MiB. The 2012-2015 sample above came from 49 of them
(21,063 records).

## The flow (shipped 2026-10-15, brief 05)

1. The browser sends the ISBN to `POST /api/lookup`, unless the page has its
   answer from this visit ([memo.ts](../../web/src/add/memo.ts)); the server does the work
   ([routes/lookup.ts](../../server/src/routes/lookup.ts)). This keeps the
   Google key out of the browser and lets one queue per source respect the
   rate limits ([queue.ts](../../server/src/lookup/queue.ts)): one request at
   a time, starts at least 400 ms apart for Open Library and 200 ms for Google.
2. The server checks the lookup cache, `lookup_cache`: the raw answer per ISBN
   and source, with its outcome and fetch date
   ([cache.ts](../../server/src/lookup/cache.ts)). A found answer is reused
   forever, a not-found one for 7 days; an error is never stored. A hit costs
   no request, even for Google after its key is gone. A request for an ISBN
   whose lookup is running waits for it (brief 18), so no source is asked twice.
3. The sources in order: Open Library, the three library catalogs (the
   Academy, BCU Cluj, BCU Timișoara, brief 15), Google Books. The next one is
   asked only while no answer so far has a title, so Google isn't asked for a
   missing cover; without a key it is reported `skipped_no_key`. Merge field
   by field: the first non-empty value wins, in that order; cover candidates
   come in the same order ([merge.ts](../../server/src/lookup/merge.ts)). An
   Open Library lookup counts as an error unless both its calls succeed, so a
   half answer is never cached. A library lookup is one Z39.50 exchange (Init,
   Search, Present) with a 10 s deadline; a 978 ISBN is asked together with
   its ISBN-10 ([libraries.ts](../../server/src/lookup/libraries.ts),
   [z3950/](../../server/src/lookup/z3950/client.ts)). Each library has its
   own queue with a random 5-10 s pause after each request ends.
4. Return a draft the user confirms or edits before saving, with `tried` (each
   source asked and how it did) and the copies already saved with that ISBN.
   Nothing is saved silently.
5. Not found anywhere: open the manual form with the ISBN filled in.

What the clients keep: text trimmed and cut to the book schema's limits, the
year from any date string ("Apr 07, 2016"), MARC language codes mapped to
ISO 639-1 (`rum` → `ro`), the first 10 subjects only (Open Library lists 93
for The Hobbit, "thrushes" among them), Open Library's large cover by cover
ID, Google's largest image link forced to https without its page curl.

A batch (CSV import, offline queue) goes through the same queues. A found
ISBN costs two Open Library calls, so 300 found books take about four minutes,
300 unknown ones about two.

## Covers

Download the chosen cover once, on the server, from an allowlist of cover hosts
(the SSRF guard), and store it in the `covers` table; serve it from our API
([routes/covers.ts](../../server/src/routes/covers.ts)). The allowlist is
`covers.openlibrary.org`, `books.google.com` and
`books.googleusercontent.com`, https on the default port only, checked again
at every redirect, 2 MB and 10 s at most. Open Library's covers live at the
Internet Archive: on 2026-10-15 every cover URL answered 302 to `archive.org`,
which answered 302 to an `iaNNNNNN.us.archive.org` node. Those two are allowed
as redirect targets only, never as the URL asked for. Google's cover host
answered directly.
Photos taken in the app are resized in the browser before upload. Rejected: hotlinking
Open Library or Google, which breaks offline, leaks every page view to them
and runs into the cover rate limit. When there is no cover, the user can take
a photo of the book in the book page.

## Romanian fallbacks

In order of effort: fast manual entry (v1), Google Books (v1, measure it),
reading the CIP block from a photo (shipped 2026-10-23, see [cip-photo.md](cip-photo.md)).

The CIP bibliography PDFs are free public data with one record per book
(author, title, city, publisher, year, ISBN) and parse cleanly with
`pdftotext`, apart from ISBNs broken across lines. The current site has the
issues from 2019 on (about 2,800 ISBNs a month); the older archive did not
answer on 2026-10-14. As of 2026-10-17 the 2026 issues run January to August,
April to December 2025 are missing, and an issue goes up about four months
after its month. January to March 2026 parsed to 8,442 records. A local
index built from them would cover recent Romanian books, never older ones.
The owner wants it (2026-10-17): Google Books found none of 80 recent
Romanian trade books.

The order, confirmed by the owner and built on 2026-10-17 (briefs 15, 16):
Open Library, the three library catalogs, the CIP index, then Google Books
only when nothing has a title. The libraries cover books more than a year
old, and the CIP index covers the newest ones.

The CIP index as built (brief 16): `<dataDir>/cip.db`, kept out of
shelfmark.db so the backup stays small. The server refreshes it a minute
after it starts, then weekly ([job.ts](../../server/src/cip/job.ts)); the
refresh lists the issues through the site's WordPress media API, downloads the
missing ones newest first at the libraries' pace, and runs `pdftotext -layout`
([refresh.ts](../../server/src/cip/refresh.ts)). An issue that parses to under
1,000 records isn't stored, so a changed layout can't quietly empty it.
`CIP_REFRESH=off` turns the job off; `node server/dist/cip/cli.js refresh
[YYYY-MM ...]` runs it by hand. The lookup reads the index directly, with no
lookup cache.

Scraping Romanian bookshop sites was considered and rejected: fragile, against
their terms, and it breaks silently.
