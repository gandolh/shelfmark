# Task 04: Wishlist, with recommendations

**Depends on:**

- In Shelfmark: nothing to build first. Whichever of 06 (Base UI by the conventions), 07 (the web app to Tailwind) and 09 (the redesign) lands after this brief carries its page along. See Interplay.
- The owner's grilling of 2026-11-10: Q36 (the shape of this brief), Q3 (Open Library answers from the owner's machine, so step 1 runs locally), Q26 ("nothing boots the app" stands).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

On 2026-11-09 the owner asked for a page of book recommendations based on what the library already holds. **A recommendation must never be a book that is already in the database.** On 2026-11-10 the owner answered how it should look and where the picks come from:

- The third place in the navigation is **Wishlist**, after Library and Add a book.
- **The wishlist moves out of Library into it.** Library keeps the owned books. Wishlist holds the wished-for books and the recommendations.
- Wishlist has an **Add a book** button for books the owner hears about: the same add flow, landing in the wishlist.
- Recommendations come from, in this order: (1) a spike on the owner's real library of a free service and a small model run inside Shelfmark, (2) otherwise Claude, by hand, through a download and an Import button, (3) and if the spike works, the by-hand path stays as a second source the owner can drop.

### What Shelfmark has to work with

Each row in `books` carries:

- `title`, `subtitle` and `authors` (a JSON array);
- `series` and `series_number`;
- `subjects` (a JSON array, up to ten, from the lookup);
- `language`, `published_year`, `isbn13`;
- `collection` (`owned` or `wishlist`), `status` (unread, reading, read, abandoned) and `rating` (1-5).

`lookup_cache` keeps each source's raw answer per ISBN, including Open Library's edition record, which names its work (`works[0].key`). See [data-model.md](../../wiki/data-model.md) and [metadata-lookup.md](../../wiki/metadata-lookup.md).

Today the wishlist is the second tab of the Library (`CollectionTabs`, `web/src/library/LibraryPage.tsx:379-397`, with its empty state at `:273-283`). A scanned book not owned offers "Add to wishlist" (`web/src/add/AddBookPage.tsx:239`), "I bought it" moves a row onto a shelf, and the offline "do I own this?" copy and the CSV import both know the two collections ([wiki/scanning.md](../../wiki/scanning.md), [wiki/import.md](../../wiki/import.md)). The export already writes every book with a **Collection** column ([wiki/export.md](../../wiki/export.md)).

### Research (2026-11-09 and 2026-11-10)

- **No free catalog has a "similar books" endpoint.**
  - Open Library has a search API (`/search.json`) that filters by `author`, `subject` and `language` and sorts by `rating`, `readinglog`, `new` or `editions`. One request returns many works, with `key`, `title`, `author_name`, `first_publish_year`, `language`, `subject`, `isbn` (every edition's), `cover_i` and rating counts. Authors' works are at `/authors/<key>/works.json`. Check the parameter names against openlibrary.org/dev/docs/api/search before building.
  - **Verified in Open Library's own source** (`openlibrary/plugins/worksearch/schemes/works.py` in internetarchive/openlibrary at `9b2c746`, 2026-11-09): sorts `rating`, `readinglog`, `want_to_read`, `already_read`, `new`, `old`, `editions`, `trending`, `title`; fields include `key`, `title`, `subtitle`, `author_key`, `author_name`, `first_publish_year`, `language`, `isbn`, `subject`, `cover_i`, `edition_count`, `ratings_count`, `readinglog_count`, `want_to_read_count`, **`series_key`, `series_name`, `series_position`**, `genre_name`, `subgenre_name`, `award_name`. The series fields make "the next book in a series you own" a real, cheap source.
  - Open Library answers from the owner's machine (HTTP 200 on 2026-11-10), so step 1 runs locally. It was blocked in the cloud session of 2026-11-09.
- **TasteDive** (found 2026-11-10): a free key at about 300 requests an hour, with a books category. It is a legacy API since TasteDive joined Qloo, kept "until full migration", so it may go. It takes titles or authors as seeds and returns similar ones.
- **Hardcover** has a GraphQL API but no similar-books query, and its own recommendations are only planned. Out.
- **A small sentence-embedding model** (all-MiniLM-L6-v2, **about 23 MB**, run in Node through transformers.js) could rank Open Library candidates, found by the owner's authors, series and subjects, against the library's descriptions and subjects. It runs inside Shelfmark, so nothing about the library leaves the box.
- **Google Books has no "related" endpoint**, and it spends the owner's key, which Shelfmark keeps for lookups ([wiki/decisions.md](../../wiki/decisions.md); the owner's rule: spare the key, Google last, minimal calls).
- **Romanian books are Open Library's weak spot.** It found 12-20% of Romanian ISBNs on 2026-10-14; the three Romanian library catalogs over Z39.50 found 33 of 40. Z39.50 can search by author (Bib-1 use attribute 1003) as well as by ISBN (7); Shelfmark asks only by ISBN today, so measure an author search before relying on it.
- **Language-model picks are invented often enough to matter.** A 2025 newspaper reading list had 10 fabricated books out of 15, and a 2026 preprint measured hallucination rates that vary widely by catalog. So every imported pick is looked up in Open Library before it is shown.
- **The estate has a pattern.** Lantern's suggestions (`server/src/suggest/score.ts` in lantern) build a taste profile as a weight per feature, count a feature repeated k times as 1/√k, and keep each rated title's share of the score so a suggestion can say "because you liked X".

### Constraints from Shelfmark's decisions

- **Two places only** is revisited by this brief: Shelfmark now has **three places**, Library, Add a book and Wishlist, with the owner's request as the reason (step 8).
- **The libraries are asked politely**: one request at a time per library, a random 5-10 s pause, every answer cached. Google is used as little as possible and last.
- **Nothing is read or sent without a deliberate act**, and **nothing about the library leaves the box except through the owner's own download.** No service receives the library: if the spike's TasteDive path ships, it sends only the seed titles of one press of Refresh, which the owner sees on the button's help text.
- **Only lightweight tests**: nothing boots the app (kept by the technical call Q26).
- **The box gets no extra storage** (owner, 2026-11-06): the model's 23 MB is fine, and its size is said in the image.
- English interface. Physical books only.

## Owner decisions

Decided 2026-11-10 (owner), Q36:

1. **Where it lives.** A third place, **Wishlist**, after Library and Add a book. "Two places only" gets a dated revisit in `decisions.md`.
2. **The wishlist moves.** Library keeps owned books only (the `Owned | Wishlist` tabs go); Wishlist holds wished-for books plus the recommendations. The `books.collection` column is unchanged.
3. **Add a book on Wishlist.** A button that opens the same add flow, landing in the wishlist.
4. **Where recommendations come from, in order.** Step 1 is a spike on the owner's real library of (a) TasteDive and (b) the embedding ranker. If neither gives useful picks, the export and import path ships alone. If one works, the export and import path still ships as a second source, a default the owner can drop.
5. **Refresh stays on a press.** A dismissed pick never comes back.

Decided 2026-11-10 (technical call, to overrule):

6. **What "in the database" covers.** Both collections, plus dismissed. A book owned, wished for or dismissed is never shown, and the same filter drops imported picks.
7. **How many.** Up to 30, highest first.
8. **The export is the existing library export** (CSV, [wiki/export.md](../../wiki/export.md)), with the prompt beside it; no new export code.
9. **The import schema is JSON**, documented on the page: an array of `{ "title", "authors", "isbn13"?, "reason" }`.

## Files you OWN

- `server/src/recommend/` (new): `profile.ts`; `score.ts`; `dedup.ts` (the "already have it" keys); `sources/openlibrary.ts`; `sources/tastedive.ts` and `rank/embeddings.ts` only if step 1 keeps them; `sources/library-catalogs.ts` only if the Romanian author search earns its place; `import.ts` (the check of imported picks); `job.ts`; `store.ts`; tests and fixtures for each.
- `server/scripts/spike-recommendations.ts` (new, throwaway, kept so the numbers can be rerun).
- `server/src/routes/recommendations.ts` (new) and its registration in `server/src/app.ts`.
- `server/src/db/migrations.ts`: append one migration, never edit an old one.
- `shared/src/recommendations.ts` (new zod schemas, including the import schema), exported from `shared/src/index.ts`.
- `web/src/wishlist/` (new: the page, its cards, the Add a book button, the Import dialog, the prompt and download panel), plus the navigation and route entries in `web/src/router.ts`, `web/src/layout/TopBar.tsx`, `TabBar.tsx` and `AppShell.tsx`.
- In the Library: `web/src/library/LibraryPage.tsx` (the collection tabs go, the empty state and the filter that depended on the tab), `state.ts` and `prefs.ts` where they hold a collection. Read each file's tests first.
- Corpus: `wiki/recommendations.md` (new), `decisions.md`, `glossary.md`, `features.md`, `design.md` and `DESIGN.md` (the navigation lines), `PRODUCT.md` (line 79), `import.md` (the "not a third tab" line), `status.md`, `index.md` (regenerated), `log.md`.

## Files you must NOT touch

- The lookup flow's behaviour and order (`server/src/lookup/`). Read its cache and reuse its HTTP and Z39.50 clients.
- The `books` table's columns.
- The add flow's own steps: Wishlist reuses it through a parameter that sets the target collection.

## What to do

One commit per step; `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` pass after each.

1. **The spike, on the owner's real library.** On a copy of the owner's database (the backup download), with `server/scripts/spike-recommendations.ts`, outside the app:
   1. Build the profile (step 3).
   2. **TasteDive:** with a free key kept in `.env` (name it, never write it), ask for similar books from the top authors and best-rated titles, within the 300 requests an hour. Record picks per seed, how many are real catalog books, how many are already owned, how many are in Romanian.
   3. **The embedding ranker:** fetch Open Library candidates by the owner's top authors, series and subjects (at most 25 requests, polite pace, cached), embed them with all-MiniLM-L6-v2 through transformers.js, and rank them against the library's descriptions and subjects. Record the model's size on disk, the first-load time, the time for a refresh, and the memory used.
   4. **Judge.** Write both results, with 10 real examples each, into this brief's outcome note and `wiki/recommendations.md`, with the owner's verdict on whether the picks are useful. A pick is useful if the owner would add it to the wishlist; record the owner's count out of 10 for each.
   5. **Decide.** Neither useful: step 2 ships alone. One useful: it joins steps 3-4, and step 2 still ships as a second source. Hardcover is not tried.
2. **The export, prompt and import path** (ships in every outcome).
   - The Wishlist page offers **Download your library** (the existing CSV) and **Copy the prompt**: a ready prompt for Claude that says what the file is, asks for up to 30 books the owner does not have, in Romanian or English, each with a one-line reason, and asks for **only** the JSON of the documented schema. The prompt names the schema and warns that titles must be real books.
   - **Import** takes the JSON (paste or file). Each pick is checked against Open Library by ISBN, else by title and author, at the polite pace as a job with progress; a pick that isn't found is listed as "not found" and never shown as a recommendation. Then the dedup (step 4) drops the books already owned, wished for or dismissed, and says how many it dropped.
   - If the spike kept a source, this path is labelled "From Claude", and a setting on the page (kept with the other Library settings, `web/src/library/prefs.ts`) can hide it.
3. **The profile** (`profile.ts`), only if the spike keeps a source that needs it, from every book in both collections. Each book's weight: rating 5 is 2, rating 4 is 1.5, rating 3 is 0.5, rating 1-2 is -1, read with no rating is 1, reading is 1, owned and unread is 0.5, abandoned is -1, on the wishlist is 1. Features: author (normalised) counts 2, subject (normalised, kept if on at least two books) counts 0.5, series counts 3; a feature repeated k times on one book counts 1/√k. The languages the library holds become a filter, not a weight.
4. **Deduplication, the hard part** (`dedup.ts`), used by every source including the import. A candidate is dropped if:
   - **(a)** an ISBN of any of its editions equals any `books.isbn13`;
   - **(b)** its Open Library work key equals one resolved for a library book (from `lookup_cache`; for a book with no cached record, one capped title-and-author search per refresh, cached). This catches a translation: the owner has *Stăpânul inelelor*, and Open Library offers *The Lord of the Rings* under the same work;
   - **(c)** its title key equals a book's. The key is the title folded for case and diacritics (as `web/src/library/search.ts`'s `fold` does), the subtitle after ":" cut, punctuation and a leading article dropped, and the first author's surname appended;
   - **(d)** it matches a dismissal by work key or title key.

   Candidates that are editions of one work merge into one and keep the best cover and the edition in a language the library reads.
5. **Sources and the job** (only what step 1 kept, plus the import). Every request goes through a new `catalog_query_cache` table (URL or query as key, the response, `fetched_at`, kept 30 days). Open Library is asked one request at a time with Shelfmark's User-Agent, at most 25 requests per refresh; the libraries follow their existing rules; Google is not asked. "The next in a series" from `series_name` stays the cheapest candidate source. The refresh runs as a job like `lookup/queue.ts`, with progress on the page. Reasons read "Because you have 4 books by Mircea Cărtărescu", "Next in *Series* (you have 1-3)", or Claude's own line for an import.
6. **Storage** (one migration): `recommendations` (work key, title, authors, year, language, `cover_url`, ISBNs, score, reasons as JSON, source, `refreshed_at`; the last list only, replaced in one transaction per refresh, imports appended), `recommendation_dismissals` (work key or title key, `dismissed_at`), `catalog_query_cache`.
7. **The API and the page.**
   - `GET /api/recommendations`; `POST /api/recommendations/refresh` and `GET` for its progress (only if a source was kept); `POST /api/recommendations/import` and its progress; `POST /api/recommendations/:key/dismiss`. Adding to the wishlist uses the existing book-create route with a draft from the candidate.
   - The Wishlist page, in Covers style following [DESIGN.md](../../../DESIGN.md): the wished-for books first (the same table and covers the Library uses, collection `wishlist`, with "I bought it"), the **Add a book** button, then **Recommendations** with Refresh (if a source was kept), the download and prompt panel, and **Import**. Each recommendation card shows the cover, title, authors, year, language, the reason, **Add to wishlist**, **Not interested**, and a link to Open Library. Language chips filter. The empty states, the navigation (top bar's segmented control gets a third item, the phone's tab bar a third tab) and phone and desktop layouts follow the Library's patterns. Any menu or dialog uses the Base UI wrappers as they stand.
   - Library loses its tabs and its Wishlist empty state; its counts and header card say owned books only. Stats keeps its Wishlist count, now linking to the Wishlist page. A `/library?collection=wishlist` link from before redirects to Wishlist.
8. **The corpus.** In `decisions.md`, under **Two places only: Library and Add a book**, keep the 2026-10-14 entry as written and add a dated revisit: *2026-11-10, revisited: Shelfmark now has three places, Library, Add a book and Wishlist, because the owner asked for recommendations and a place for books they hear about; the wishlist moves out of Library; account items still live in the menu; a new place still needs an explicit revisit.* Add a `log.md` entry for it. Update the "Two places" lines in `design.md`, `DESIGN.md`, `PRODUCT.md` and `import.md`. `glossary.md`: **Recommendation** (a book in no collection, suggested from the library; _Avoid_: suggestion, pick, discovery), **Dismissed** (a recommendation the owner said no to, never shown again), **Wishlist** (now a place, not a tab). Then `features.md`, `status.md`, `log.md`, `bash corpus/lint.sh --index`, `bash corpus/lint.sh`.

## Acceptance

- [ ] The outcome note holds the spike: for TasteDive and the embedding ranker, 10 real examples each, the owner's count of useful picks, the model's size (about 23 MB), times and requests, and the decision it led to.
- [ ] Unit tests pass, with recorded fixtures and no network, for the profile (if built), every dedup rule, the Open Library mapping, the import schema and the check of imported picks. Among them: a candidate sharing an edition ISBN with an owned book is dropped; a translation with the same work key is dropped; a same-title, same-author book with no ISBN is dropped; a wishlist book is dropped; a dismissed one is dropped; an imported pick not found in Open Library is not shown; malformed JSON gives a readable error and changes nothing. No test boots the app.
- [ ] With the owner's database copy, after an import (and a refresh, if a source was kept), no item on the page is in `books`. Check with a SQL join on ISBNs, work keys and title keys, and paste the zero-row result into `recommendations.md`.
- [ ] A refresh makes no more than 25 Open Library requests; the libraries keep their pause; a second refresh within 30 days is served from the cache. No request names a book from the library except TasteDive's seeds, if that source shipped.
- [ ] "Add to wishlist" makes a card leave the list; "Not interested" keeps it away after a refresh and an import of the same JSON.
- [ ] The navigation has Library, Add a book and Wishlist at 1280 and 390 px; Library shows no wishlist books; the Add a book button on Wishlist saves into the wishlist.
- [ ] `decisions.md` holds the 2026-11-10 revisit of "Two places only", with the old entry intact, and `log.md` the entry.
- [ ] `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` pass, and `bash corpus/lint.sh` ends clean.

## Interplay

- **Order: 05, then 04, then 06, 07 and 09; 08 any time apart from them.** This brief changes the navigation and the Library page, and brief 07 rewrites every stylesheet, so build the Wishlist once, in the app's plain CSS, and let 06 (Base UI by the conventions) and 07 (Tailwind) carry it along: it is one more page for them, and 06's wrappers replace any menu or dialog it uses. The redesign (09) comes last and treats Wishlist as a screen of its own.
- The step 1 spike needs the owner to judge picks, so it may wait. If 06 or 07 lands first, this brief's page uses the `ui/` wrappers and Tailwind from the start, and the Library edits follow the moved files.
- Brief 05 (the house style): if it lands first, write formatted at width 120; if second, the reformat covers these files.
- Brief 08 (the server in feature folders): if it lands second it moves `server/src/recommend/` and `routes/recommendations.ts` into `server/src/features/recommendations/` with route schemas; the migration does not move. The import route takes a zod schema from `shared/`, and no response schema may carry a `.transform()` (see 08's trap).

## Outcome (2026-11-11)

Built on local `main`, not deployed (`node cli.ts shelfmark all`). Done: Wishlist as the third place (top bar, tab bar, `/wishlist`, `/wishlist/add`), Library owned-only (a saved Wishlist tab reads as Owned; the old `?collection=wishlist` link redirects), the Claude path (CSV download, prompt, paste or file, every pick checked in Open Library, "not found" listed and never shown), the dedup with all four rules (also applied on every list read), migration 4 (`recommendations`, `recommendation_dismissals`, `catalog_query_cache`), the API, Add to wishlist and Not interested, the corpus revisit and glossary, [recommendations.md](../../wiki/recommendations.md). Unit tests with no network cover every dedup rule, the Open Library mapping, the match guard, the import schema, malformed JSON, dismissals and a repeat import.

Not done, and why: **step 1, the spike** (TasteDive and the embedding ranker) needs the owner's real library, a TasteDive key and the owner's count of useful picks out of 10, so there are no spike numbers to record; it is filed as [a todo](../../todos/blocked/recommendations-spike.md). With it go the profile (step 3), a Refresh button, the series source and the "From Claude" label with its hide setting. Rule (b) for a library book with no cached Open Library record falls back to the title key. The Import is an inline panel, not a dialog, because the Base UI dialog wrapper arrives with brief 06. The two Open Library fixtures are shaped from the documented fields, not recorded live. Not checked: screenshots at 1280 and 390 px, and the SQL join on the owner's database copy (the query is in recommendations.md).
