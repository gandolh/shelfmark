# Task 04: Book recommendations

## Context

On 2026-11-09 the owner asked for a new page of book recommendations based
on what the library already holds. **A recommendation must never be a book
that is already in the database.**

### What Shelfmark has to work with

Each row in `books` carries:

- `title`, `subtitle` and `authors` (a JSON array);
- `series` and `series_number`;
- `subjects` (a JSON array, up to ten, from the lookup);
- `language`, `published_year`, `isbn13`;
- `collection` (`owned` or `wishlist`), `status` (unread, reading, read,
  abandoned) and `rating` (1-5).

`lookup_cache` keeps each source's raw answer per ISBN, including Open
Library's edition record, which names its work (`works[0].key`). See
[data-model.md](../../wiki/data-model.md) and
[metadata-lookup.md](../../wiki/metadata-lookup.md).

### Research (2026-11-09)

- **No free catalog has a "similar books" endpoint.**
  - Open Library has a search API (`/search.json`) that filters by
    `author`, `subject` and `language` and sorts by `rating`,
    `readinglog`, `new` or `editions`. One request returns many works, with
    `key`, `title`, `author_name`, `first_publish_year`, `language`,
    `subject`, `isbn` (every edition's), `cover_i` and rating counts.
  - Authors' works are at `/authors/<key>/works.json`.
  - Recommendations have to be put together from author and subject overlap.
    Check the parameter names against openlibrary.org/dev/docs/api/search
    before building. They come from third-party summaries, because the docs
    page wasn't fetched that day.
- **Verified in Open Library's own source**
  (`openlibrary/plugins/worksearch/schemes/works.py` in
  internetarchive/openlibrary at `9b2c746`, 2026-11-09):
  - **Sorts:** `rating` (`ratings_sortable desc`), `readinglog`,
    `want_to_read`, `already_read`, `new`, `old`, `editions`, `trending`,
    `title`.
  - **Fields:** `key`, `title`, `subtitle`, `author_key`, `author_name`,
    `first_publish_year`, `language`, `isbn`, `subject`, `cover_i`,
    `edition_count`, `ratings_count`, `readinglog_count`,
    `want_to_read_count`, **`series_key`, `series_name`,
    `series_position`**, `genre_name`, `subgenre_name`,
    `literary_form_name`, `award_name`, `trending_z_score`.

  The series fields make **"the next book in a series you own"** a real
  source. Search by `series_name`, and keep the positions after the highest
  one the owner has. This is likely the strongest signal there is, and it
  is cheap.

  openlibrary.org was **blocked in that cloud session's network**, so step
  1's measurement runs where the server can reach it (Shelfmark's own
  server reaches it in production), or after the owner allows the host.
- **Google Books has no "related" endpoint either.** It also spends the
  owner's key, which Shelfmark's decisions keep for lookups.
- **Romanian books are Open Library's weak spot.** It found 12-20% of
  Romanian ISBNs on 2026-10-14. The three Romanian library catalogs over
  Z39.50 found 33 of 40. Z39.50 can search by author (Bib-1 use attribute
  1003) as well as by ISBN (7). Shelfmark asks only by ISBN today, so
  measure an author search before relying on it.
- **LLM recommendations are invented often enough to matter.** A 2025
  newspaper reading list had 10 fabricated books out of 15, and a 2026
  preprint measured hallucination rates that vary widely by catalog. Any
  suggestion from a model has to be found in a real catalog before it is
  shown.
- **The estate already has a pattern.** Lantern's suggestions
  (`server/src/suggest/score.ts` in lantern) build a taste profile as a
  weight per feature (genre 0.5, director 2, writer 1.5). A feature
  repeated k times counts 1/√k. Each rated title's share of the score is
  kept, so a suggestion can say "because you liked X", and one shared genre
  alone isn't enough to suggest a title.

### Constraints from Shelfmark's decisions

- **Two places only: Library and Add a book.** A new page is a new place,
  so it needs an explicit revisit of that entry. The owner's request is the
  reason.
- **The libraries are asked politely**: one request at a time per library,
  a random 5-10 s pause, every answer cached. Google is used as little as
  possible.
- **Nothing is read or sent without a deliberate act.** This is from the
  camera decision, but it applies here.
- **Only lightweight tests**: nothing boots the app.
- English interface. Physical books only.

## Owner decisions (defaults this brief builds)

1. **Where it lives.** Default: a third place, **Recommendations**, in the
   navigation after Library and Add a book. Revisit "Two places only" in
   `decisions.md`, with the owner's request as the reason. Alternatives: a
   third tab inside Library next to Owned and Wishlist, which would count
   as no new place; or a section on Add a book.
2. **Where candidates come from.** Default: catalogs only. Use Open Library
   search by the owner's authors and top subjects, and the Romanian
   catalogs' author search for Romanian authors (step 1 decides whether
   that is good enough). No language model: sending the library to a third
   party conflicts with "nothing sent without a deliberate act", and model
   suggestions need verifying anyway. Alternative: Claude proposes from a
   summary of the library, and each proposal is shown only once it is found
   in Open Library or a Romanian catalog.
3. **When it asks.** Default: only on a press of **Refresh
   recommendations**. The page shows the last list, with its date. The
   first visit shows an empty state with the button. Alternative: refresh
   when the page opens, at most once a week.
4. **What "in the database" covers.** Default: both collections. A book
   owned or on the wishlist is never recommended, and neither is one the
   owner dismissed.
5. **How many.** Default: up to 30, highest score first.

## Files you OWN

- `server/src/recommend/` (new):
  - `profile.ts`: the taste profile;
  - `score.ts`;
  - `dedup.ts`: the "already have it" keys;
  - `sources/openlibrary.ts`;
  - `sources/library-catalogs.ts`: the Z39.50 author search, on the existing
    `lookup/z3950/` client;
  - `job.ts`: the refresh, with progress;
  - `store.ts`;
  - unit tests and fixtures for each.
- `server/src/routes/recommendations.ts` (new), and its registration in
  `server/src/app.ts`.
- `server/src/db/migrations.ts`: append one migration, never edit an old
  one.
- `shared/src/recommendations.ts` (new zod schemas), exported from
  `shared/src/index.ts`.
- `web/src/recommendations/` (new page and components), plus the
  navigation and route entries in `web/src/router.ts` and the shell.
- `corpus/wiki/recommendations.md` (new), plus `decisions.md`,
  `glossary.md`, `features.md`, `status.md`, `index.md` (regenerated) and
  `log.md`.

## Files you must NOT touch

- The lookup flow's behaviour and order (`server/src/lookup/`). Read its
  cache and reuse its HTTP and Z39.50 clients; don't change them.
- The `books` table's columns. Work keys come from `lookup_cache` and the
  new tables.
- The Library's table and covers code, beyond reusing the covers card.

## What to do

1. **Measure before building.** On a copy of the owner's database (the
   backup download), with a throwaway script under `server/scripts/`:
   - Build the profile.
   - Run the Open Library queries for the top 10 authors and the top 8
     subjects.
   - Run the Romanian catalogs' author search for the top 5 Romanian
     authors, at the polite pace.

   Count the candidates per source, how many survive deduplication, how
   many are in Romanian, and how many requests and seconds a refresh takes.
   Write the numbers into `corpus/wiki/recommendations.md`, and bring
   decision 2 back to the owner if the Romanian share is poor.

2. **The profile** (`profile.ts`), from every book in both collections. Each
   book's weight:

   | The book | Weight |
   |---|---|
   | rating 5 | 2 |
   | rating 4 | 1.5 |
   | rating 3 | 0.5 |
   | rating 1-2 | -1 |
   | read, no rating | 1 |
   | reading | 1 |
   | owned and unread | 0.5 (it was bought) |
   | abandoned | -1 |
   | on the wishlist | 1 |

   The features, and how much each counts:

   | Feature | Counts |
   |---|---|
   | author, by normalised name | 2 |
   | subject, normalised and lower-cased, Open Library's long tail cut by keeping the subjects that appear on at least two books | 0.5 |
   | series | 3 |

   A feature repeated k times on one book counts 1/√k, as in lantern. The
   languages the library holds become a filter, not a weight.

3. **Sources.**
   - **The next in a series:** for each `series` the library holds,
     `search.json?q=series_name:"…"&fields=key,title,series_position,…`,
     keeping positions after the owner's highest. The reason line reads
     "Next in *Series* (you have 1-3)".
   - **Open Library:** `search.json?author=…` sorted by `readinglog`, and
     `?subject=…&language=…` sorted by `rating`.
   - **Romanian catalogs:** an author search on the libraries, for authors
     whose books are mostly Romanian.

   Every request goes through a new `catalog_query_cache` table (the URL or
   query as key, the response, `fetched_at`, kept 30 days). Open Library is
   asked one request at a time, with Shelfmark's User-Agent, at most 25
   requests per refresh. The libraries follow their existing rules. The
   refresh runs as a job like `lookup/queue.ts`, and the page shows its
   progress.

4. **Deduplication, the hard part** (`dedup.ts`). A candidate is dropped if
   any of these is true:
   - **(a)** an ISBN of any of its editions equals any `books.isbn13`;
   - **(b)** its Open Library work key equals one resolved for a library
     book. Resolve from `lookup_cache`; for books with no cached Open
     Library record, run one capped title-and-author search per refresh and
     cache the answer. This is what catches a translation: the owner has
     *Stăpânul inelelor*, and Open Library offers *The Lord of the Rings*
     under the same work;
   - **(c)** its title key equals a book's. The key is the title folded for
     case and diacritics (as `web/src/library/search.ts`'s `fold` does), the
     subtitle after ":" cut, punctuation and a leading article dropped, and
     the first author's surname appended;
   - **(d)** it matches a dismissal by work key or title key.

   Candidates that are editions of one work merge into one, and keep the
   best cover and the edition in a language the library reads.

5. **Scoring** (`score.ts`). The score is the sum of the candidate's feature
   weights, plus a small nudge for Open Library's ratings and reading-log
   counts. Each library book's share of the score is kept, so the reason
   reads "Because you have 4 books by Mircea Cărtărescu" or "Like *X* and
   *Y*". A candidate needs at least an author or series match, or two
   subjects shared with books weighted 1 or more. One subject alone is not
   enough.

6. **Storage** (one migration):
   - `recommendations`: work key, title, authors, year, language,
     `cover_url`, ISBNs, score, reasons as JSON, source, `refreshed_at`.
     It holds the last list only, replaced in one transaction per refresh.
   - `recommendation_dismissals`: work key or title key, `dismissed_at`.
   - `catalog_query_cache`.

7. **The API**, with zod in `shared/`:
   - `GET /api/recommendations`: the list and its date.
   - `POST /api/recommendations/refresh`: starts the job.
   - `GET /api/recommendations/refresh`: the job's progress.
   - `POST /api/recommendations/:key/dismiss`.

   Adding to the wishlist uses the existing book-create route, with a draft
   built from the candidate. That puts it in the database, so it leaves the
   list at the next read.

8. **The page.**
   - A covers grid in the Library's Covers style, following DESIGN.md.
   - Each card shows the cover, title, authors, year and language, the
     reason line, **Add to wishlist**, **Not interested**, and a link to the
     book on Open Library.
   - Language chips filter the list.
   - The empty state and the refresh progress follow the Library's patterns.
   - Use Base UI for any menu or dialog.
   - Phone and desktop layouts.

9. **The corpus.**
   - `glossary.md`:
     - **Recommendation**: a book in neither collection, suggested from the
       library. _Avoid_: suggestion, pick, discovery.
     - **Dismissed**: a recommendation the owner said no to, never shown
       again.
   - `decisions.md`: the place revisit, and decisions 2-4 as built.
   - `features.md`: a new tier row.
   - Then `status.md` and `log.md`.

## Acceptance

- The unit tests for the profile, scoring, every dedup rule and the Open
  Library mapping pass, run against recorded fixtures with no network.
  Among them:
  - a candidate sharing an edition ISBN with an owned book is dropped;
  - a translation with the same work key is dropped;
  - a same-title, same-author book with no ISBN is dropped;
  - a wishlist book is dropped;
  - a dismissed one is dropped.
- With the owner's database copy: after a refresh, no item on the page is in
  `books`. Check with a SQL join on ISBNs, work keys and title keys, and
  paste the zero-row result into `recommendations.md`.
- A refresh makes no more than 25 Open Library requests. The library
  requests keep their pause. A second refresh within 30 days is served from
  the cache.
- "Add to wishlist" makes the book disappear from the list, and "Not
  interested" keeps it away after a refresh.
- `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` pass.
  The page works at 1280 and 390 px.
- The "Two places only" revisit is in `decisions.md`, and `log.md` has the
  entry.

## Interplay

The owner's skills library has two briefs filed on 2026-11-09 that touch
this repo: Shelfmark's whole web app moving to Tailwind, and the server
moving to `features/` folders with zod route schemas. Build this in
Shelfmark's styling and layout as they stand when it starts. Whichever of
those lands later carries this page along with the rest.
