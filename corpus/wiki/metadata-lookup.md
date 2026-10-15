---
summary: Where a scanned book's title, authors, cover and other details come from. Open Library and Google Books (with the owner's free key) compared, their limits, the hit rates measured on 2026-10-14 (Romanian ISBNs found 12-20% of the time vs 92% for English; every free keyless catalog worse still), why the national library's CIP catalog can't be used, the lookup flow and cache as shipped by brief 05 (two Open Library calls per found ISBN), how covers are downloaded (the host allowlist, Open Library's archive.org redirects) and stored, the measurement script, and the fallbacks for Romanian books.
updated: 2026-10-15
---

# Metadata lookup

## Sources

| Source | Key | Limits | Notes |
|---|---|---|---|
| Open Library | none | 1 req/s anonymous, 3 req/s with a `User-Agent` naming the app and a contact address | Crowd-sourced. `/api/books?bibkeys=ISBN:<isbn>&jscmd=data&format=json` returns resolved authors, publishers, subjects and cover URLs, but no language and no description; `jscmd=details` (the edition record) has those, as MARC codes (`/languages/rum`), and no resolved authors. So a found ISBN costs two calls. Cover URLs by cover ID are not rate limited; by ISBN they were limited (100 per 5 min per IP, as of 2011). |
| Google Books | **required in practice** | ~1,000 req/day per project by default | `GET /books/v1/volumes?q=isbn:<isbn>&key=...`. Without a key every call returned 429 "Queries per day" on 2026-10-14 and again on 2026-10-15 (`quota_limit_value` 0): keyless calls share one public quota that is always spent. |
| ISBNdb | paid | per plan | Not evaluated further; only if the free sources prove too thin. |
| Romanian National Library (BNR) | n/a | n/a | The CIP catalog (`aleph.bibnat.ro`, base `CIP`) covers nearly every book from a Romanian publisher since 1996, but every request redirects to a CAPTCHA. Not usable, and not to be worked around. |
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

## The flow (shipped 2026-10-15, brief 05)

1. The browser sends the ISBN to `POST /api/lookup`; the server does the work
   ([routes/lookup.ts](../../server/src/routes/lookup.ts)). This keeps the
   Google key out of the browser and lets one queue per source respect the
   rate limits ([queue.ts](../../server/src/lookup/queue.ts)): one request at
   a time, starts at least 400 ms apart for Open Library and 200 ms for Google.
2. The server checks the lookup cache, `lookup_cache`: the raw answer per ISBN
   and source, with its outcome and fetch date
   ([cache.ts](../../server/src/lookup/cache.ts)). A found answer is reused
   forever, a not-found one for 7 days; an error is never stored. A hit costs
   no request, even for Google after its key is gone.
3. Open Library first. If missing or thin (no title, or no cover), ask Google
   Books; without a key it is reported `skipped_no_key`. Merge field by field:
   the first non-empty value wins, in that order; cover candidates are Open
   Library's then Google's ([merge.ts](../../server/src/lookup/merge.ts)). An
   Open Library lookup counts as an error unless both its calls succeed, so a
   half answer is never cached.
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
reading the CIP block from a photo (later, see [features.md](features.md)).

The CIP bibliography PDFs are free public data with one record per book
(author, title, city, publisher, year, ISBN) and parse cleanly with
`pdftotext`, apart from ISBNs broken across lines. The current site has the
issues from 2019 on (about 2,800 ISBNs a month); the older archive did not
answer on 2026-10-14. A local index built from them would cover recent
Romanian books, never older ones; it is a later todo, worth doing only if
Google Books misses many recent Romanian books.

Scraping Romanian bookshop sites was considered and rejected: fragile, against
their terms, and it breaks silently.
