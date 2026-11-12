---
summary: How the Wishlist page's recommendations work and what is still open. A recommendation is a book in no collection, never one that is owned, wished for or dismissed; the dedup rules (ISBN, work key, title key, dismissal), the Claude import (download the library, copy the prompt, paste the JSON, each pick checked in Open Library), the three tables, the API, and the spike of a free service and an embedding ranker that the owner still has to judge. Read before touching recommend/ or the Wishlist page.
updated: 2026-11-12
---

# Recommendations

Built 2026-11-11 (brief 04), not deployed. The owner's rule: **a recommendation is never a book already in the database.**

## What ships

- The Wishlist page ([design.md](design.md)): wished-for books as covers, an Add a book button that lands in the wishlist (`/wishlist/add`, the add flow with its target set to the wishlist: whatever the sheet offers, the book is saved with `collection: "wishlist"`, no shelf), then Recommendations.
- **From Claude, by hand.** "Download your library" writes the existing CSV export; "Copy the prompt" copies a ready prompt (`web/src/wishlist/prompt.ts`) that asks for up to 30 real books as JSON `[{ "title", "authors", "isbn13"?, "reason" }]`; "Import" takes the paste or a file. No library data leaves the box except through the owner's own download.
- **Every pick is checked.** `server/src/features/recommendations/job.ts` asks Open Library (`/search.json`, one request at a time through the lookup's Open Library queue, User-Agent as everywhere) by ISBN, else by title and author, up to two requests a pick. A pick is accepted only when the work's title key equals the pick's, or the folded titles are equal and an author's surname is shared (`matchPick`): the guard against invented books. A pick not found is listed as "not found" and never shown. Every answer is cached 30 days in `catalog_query_cache` by URL.
- **A card** shows the cover (Open Library's, hot-linked, else the typographic placeholder), title, authors, year, language, Claude's reason, Add to wishlist, Not interested and an Open Library link. Language chips filter. Up to 30.

## Dedup (`server/src/features/recommendations/dedup.ts`)

A candidate is dropped if (a) an ISBN of any edition equals a `books.isbn13`; (b) its work key equals one resolved for a library book, read from the Open Library edition record in `lookup_cache` (`details`, `works[0].key`); (c) its title key equals a book's (title folded for case and diacritics, subtitle after ":" cut, punctuation and a leading article dropped, first author's surname appended); (d) it matches a dismissal by work key or title key. Both collections count. The same filter runs on import and **again on every read of the list**, so a book added since never lingers. Editions of one work merge into one candidate.

Check the database copy with this join (zero rows means no recommendation is a book; the tests check the same on made-up rows):

```sql
SELECT r.key FROM recommendations r JOIN books b
  ON b.isbn13 = r.isbn13 OR lower(b.title) = lower(r.title);
```

The list read is what the page shows; the join above looks at stored rows, which may include one a later read drops.

## Storage and API

Migration 4: `recommendations` (the stored list; an import appends), `recommendation_dismissals` (work key or title key, one row each), `catalog_query_cache`.

`GET /api/recommendations`; `POST /api/recommendations/import` (zod-checked body, 202 with the job, 409 while one runs) and `GET /api/recommendations/import` for progress; `POST /api/recommendations/:key/dismiss`. A key is `OL…W` for a work or `t:<title key>`.

## Not done, still open

- **The spike (step 1).** TasteDive and the embedding ranker (all-MiniLM-L6-v2 through transformers.js) were not tried: they need the owner's real library, a free TasteDive key and the owner's verdict on ten picks each. Until then the Claude import is the only source, and the page has no Refresh. If a source is kept, it joins `server/src/features/recommendations/sources/`, its rows use a new `source` value, and the Claude path gets the "From Claude" label and a hide setting.
- **The profile (step 3)** is only needed by a kept source, so it is not built.
- **Rule (b) for a book with no cached Open Library record** falls back to the title key alone; the capped title-and-author search per refresh belongs with a refresh job.
- **Series source.** "Next in a series you own" from `series_name` is the cheapest candidate source; it also waits on the spike's decision.
- Brief 06 replaces the import panel with the Base UI dialog.
