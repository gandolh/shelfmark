---
summary: How the Wishlist page's recommendations work. Two sources, each a tab: Similar books (all-MiniLM-L6-v2 through transformers.js on the server, in a short-lived child process, ranking Open Library's books by the library's authors and subjects) and From Claude (download the library, copy the prompt, paste the JSON, each pick checked in Open Library). A recommendation is never a book that is owned, wished for or dismissed; the dedup rules, the Similar filters (translations, title echoes, scripts), the per-source cap, one row per work, the tables, the API, and what is still open (TasteDive, the series source). Read before touching features/recommendations or the Wishlist page.
updated: 2026-11-23
---

# Recommendations

Brief 04 built the Claude path (2026-11-11); brief 16 added Similar books and the tabs (2026-11-23). The owner's rule: **a recommendation is never a book already in the database.**

## The page

The Wishlist ([design.md](design.md)): the wished-for books as covers, then the Recommendations card with **a tab per source** (the owner's pick, 2026-11-23, over both sources side by side with a Show switch): *Similar books* and *From Claude*, each with its count, its one-line explanation, its action and its own list. The tab last chosen is kept on the device (`web/src/wishlist/tab.ts`); with none, the first tab that has books. A row is the cover (Open Library's, hot-linked, else the typographic placeholder), the title, authors, year, language, the reason, a grey *Add to wishlist*, *Not interested* in plain ink, and an Open Library link. Language segments filter a tab when its books are in more than one. Up to 30 a source.

## Similar books

`server/src/features/recommendations/similar/`. *Find similar books* (`POST /api/recommendations/refresh`, progress on `GET`) runs one refresh at a time:

1. **The profile** (`profile.ts`) is the household's: every book in both collections, weighed by the best rating anyone gave it (5 → 3, 4 → 2, 3 → 1, 1 or 2 → out), else its statuses (read or reading → 1, wishlist → 1, unread → 0.5, abandoned by all → out). The 400 heaviest are the seeds.
2. **Candidates** (`candidates.ts`): Open Library's `/search.json` with `sort=editions`, 20 works and their subjects a search, by the subjects and tags at least two seeds share (generic ones such as "Fiction" left out, at most 10) and then the top authors, 25 searches in all, through the catalog's queue and 30-day cache (a second refresh within a month asks nothing). A search names one author or one subject, never the library.
3. **Filters** before the model: the dedup below; a held author's work whose *first* language is not one the library reads them in (a translation of a book on a shelf: "Анна Каренина" for "Anna Karenina"; Open Library lists every edition's language on a work, so only the first counts); a title that repeats a library title, alone or inside another ("The Odyssey" by Ὅμηρος, "Novels (Jane Eyre / …)"), Romanian's older "î" for "â" included; a title in a script none of the library's languages is written in (Cyrillic, Greek); one work per title key (Open Library keeps "Villette" as three works); a work Claude already listed.
4. **The model** (`embedder.ts`, `embed-child.ts`): `Xenova/all-MiniLM-L6-v2` at revision `751bff3…`, `dtype: "q8"` (23 MB), run in a child process forked for the call and ended with its answer, so onnxruntime's memory goes back and a model that can't load fails the refresh, never the API. Its files are cached in `<DATA_DIR>/models`, downloaded from Hugging Face on the first refresh (that request names nothing about the library; it is the one outbound request not through `ctx.fetch`).
5. **Ranking** (`rank.ts`): a candidate scores its best cosine to a seed times `0.7 + 0.1 × weight`; the reason names that seed ("Close to “Baltagul”, rated 5.", "… in your library.", "… on your wishlist."). At most 3 by one author, 30 in all; a refresh replaces only the Similar rows.

Measured 2026-11-23 on the demo library (27 classics, `docs/images/demo-seed.mjs`): a cold refresh 70 to 127 s (Open Library was slow; the model step 8 to 25 s, the first with the download), a cached one 5 s; the model process peaks about 230 MB under plain Node (450 MB under tsx in dev) and ends; the container held 430 MB at the peak. On a library with few subjects (hand-entered Romanian books) the picks are mostly "more by authors you rate": other books by Mateiu Caragiale, Sadoveanu, Rebreanu, *Villette* for *Jane Eyre*. Translated titles the filters can't see ("I Crai della Vecchia Corte") still slip through.

## From Claude

*Ask Claude* opens one dialog in three numbered steps: *Download your library* (the CSV export), *Copy the prompt* (`web/src/wishlist/prompt.ts`: up to 30 real books as JSON `[{ "title", "authors", "isbn13"?, "reason" }]`; if the clipboard refuses, the prompt shows to select), *Paste Claude's answer* (or choose a file), then *Check and import* (`POST /api/recommendations/import`). No library data leaves the box except through the owner's own download.

**Every pick is checked** (`job.ts`): Open Library by ISBN, else by title and author, up to two requests a pick, accepted only when the work's title key equals the pick's, or the folded titles are equal and an author's surname is shared (`matchPick`): the guard against invented books. A pick not found is listed as "not found" and never shown.

## Dedup (`dedup.ts`)

A candidate from either source is dropped if (a) an ISBN of any edition equals a `books.isbn13`; (b) its work key equals one resolved for a library book, read from the Open Library edition record in `lookup_cache`; (c) its title key equals a book's (title folded for case and diacritics, subtitle after ":" cut, punctuation and a leading article dropped, first author's surname appended); (d) it matches a dismissal by work key or title key. Both collections count. The same filter runs on import, on refresh, and **again on every read of the list**, so a book added since never lingers. Editions of one work merge into one candidate.

```sql
SELECT r.key FROM recommendations r JOIN books b
  ON b.isbn13 = r.isbn13 OR lower(b.title) = lower(r.title);
```

Zero rows means no stored recommendation is a book (a later read drops what the join would find).

## Storage and API

Migration 4: `recommendations` (one row per work: `source` is `claude` or `similar`), `recommendation_dismissals`, `catalog_query_cache`. **One row per work:** a refresh leaves a work Claude listed alone; a Claude import of a work listed as Similar takes the row over (source, reason, score). **The list caps each source on its own** (30 each), so the model's scored rows never push Claude's (score 0) off the page.

`GET /api/recommendations`; `POST`/`GET /api/recommendations/import`; `POST`/`GET /api/recommendations/refresh` (202 with the job, 409 while one runs; a failure is `state: "failed"` with a fixed message, the cause in the server log); `POST /api/recommendations/:key/dismiss`. A key is `OL…W` for a work or `t:<title key>`.

## Still open

- **TasteDive**, the other half of the old spike ([todo](../todos/blocked/recommendations-spike.md)): a free key and the owner's verdict.
- **Series source.** "Next in a series you own" from `series_name`; the `series` source value is reserved.
- **Rule (b) for a book with no cached Open Library record** falls back to the title key alone.
- **The owner's verdict on Similar books**: ten of them rated on the real library decide whether the tab stays.
