---
summary: Where a scanned book's title, authors, cover and other details come from. Open Library and Google Books (with the owner's free key) compared, their limits, the hit rates measured on 2026-10-14 (Romanian ISBNs found 12-20% of the time vs 92% for English; every free keyless catalog worse still), why the national library's CIP catalog can't be used, why lookups run on the server with a cache, how covers are stored, and the fallbacks for Romanian books.
updated: 2026-10-14
---

# Metadata lookup

## Sources

| Source | Key | Limits | Notes |
|---|---|---|---|
| Open Library | none | 1 req/s anonymous, 3 req/s with a `User-Agent` naming the app and a contact address | Crowd-sourced. Use `/api/books?bibkeys=ISBN:<isbn>&jscmd=data&format=json`: one call returns resolved authors, publishers and cover URLs. Cover URLs by cover ID are not rate limited; by ISBN they were limited (100 per 5 min per IP, as of 2011). |
| Google Books | **required in practice** | ~1,000 req/day per project by default | `GET /books/v1/volumes?q=isbn:<isbn>&key=...`. Without a key every call returned 429 "Queries per day" on 2026-10-14: keyless calls share one public quota that is always spent. |
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
coverage is **untested** until the key exists; the first lookup brief measures
it on the same samples.

## Recommended flow

1. The browser sends the ISBN to `POST /api/lookup`; the server does the work.
   This keeps the Google key out of the browser and lets one queue respect the
   rate limits.
2. The server checks a lookup cache (ISBN → raw response per source, with a
   fetch date). A hit costs nothing.
3. Open Library first. If missing or thin (no title, or no cover), ask Google
   Books. Merge field by field: the first non-empty value wins, in that order.
4. Return a draft the user confirms or edits before saving. Nothing is saved
   silently.
5. Not found anywhere: open the manual form with the ISBN filled in.

A batch (CSV import, offline queue) goes through the same queue, one request
per ~400 ms for Open Library, so 300 books take about two minutes.

## Covers

Download the chosen cover once, on the server, from an allowlist of cover hosts
(the SSRF guard), and store it in the `covers` table; serve it from our API.
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
