# Task 05: Metadata lookup and covers

## Context

Turns an ISBN into a draft book, and stores and serves covers. Read
[metadata-lookup.md](../../wiki/metadata-lookup.md) (sources, limits, measured
hit rates, the flow), the Google Books entry in
[decisions.md](../../wiki/decisions.md), and the terms *lookup* and *draft* in
[glossary.md](../../wiki/glossary.md). Covers live in the `covers` table brief
02 created.

**Owner step before this runs:** create the Google Books API key (Google Cloud
project, enable the Books API, an API key restricted to it) and put it in
`.env` as `GOOGLE_BOOKS_API_KEY`. Without it, Google is skipped and reported
as such; nothing fails.

Depends on briefs 02 and 03.

## Files you OWN

```
shared/src/lookup.ts  shared/src/lookup.test.ts   (and one export line in shared/src/index.ts)
server/src/lookup/openlibrary.ts  server/src/lookup/googlebooks.ts
server/src/lookup/merge.ts  server/src/lookup/queue.ts  server/src/lookup/cache.ts
server/src/lookup/*.test.ts  server/src/lookup/fixtures/*.json
server/src/store/covers.ts  server/src/store/covers.test.ts
server/src/routes/lookup.ts  server/src/routes/lookup.test.ts
server/src/routes/covers.ts  server/src/routes/covers.test.ts
server/src/db/migrations.ts   (append one migration)
server/src/app.ts             (registration lines)
server/scripts/measure-lookup.ts
```

## Files you must NOT touch

`server/src/store/books.ts` (use `findByIsbn`, `get`); auth; the web app.

## What to do

1. **Contract** (`shared/src/lookup.ts`): `Draft` (the `BookCreate` fields a
   lookup can fill, plus `coverCandidates: { url, source }[]` and
   `source: "openlibrary" | "googlebooks" | "both"`); `LookupResponse`
   `{ isbn13, draft: Draft | null, tried: { source, outcome }[], owned:
   { id, shelf, createdAt }[], wishlisted: { id }[] }`, where `outcome` is
   `found`, `not_found`, `error` or `skipped_no_key`.
2. **Open Library** (`/api/books?bibkeys=ISBN:<isbn>&jscmd=data&format=json`)
   and **Google Books** (`/books/v1/volumes?q=isbn:<isbn>&key=…`) clients,
   each mapping the answer to a partial draft: title, subtitle, authors,
   publisher, year (from any date string), pages, language (ISO 639-1; map
   Open Library's three-letter codes), subjects, description, cover URLs
   (Open Library by cover ID, large; Google's `imageLinks`, forced to https).
   Open Library requests carry `User-Agent: Shelfmark/<version>
   (johndoe@example.com)`. Timeouts 8 s.
3. **Queue** (`queue.ts`): one in-process queue per source, one request at a
   time, at least 400 ms apart for Open Library and 200 ms for Google; a batch
   of 300 ISBNs must not burst.
4. **Cache** (`cache.ts`, table `lookup_cache` in a new migration:
   `isbn13`, `source`, `response` JSON, `fetched_at`, primary key on the
   first two). A found answer is reused forever; a not-found answer for 7 days;
   errors are never cached.
5. **Merge** (`merge.ts`): Open Library first, Google fills the gaps field by
   field; the first non-empty value wins. Ask Google only when Open Library
   missed or came back thin (no title, or no cover).
6. **Route** `POST /api/lookup { isbn }`: `parseIsbn` (brief 03) or 400; then
   `findByIsbn` for `owned`/`wishlisted`; then cache, sources, merge. Nothing
   is saved: a lookup returns a draft the owner confirms.
7. **Covers.** `server/src/store/covers.ts` and routes:
   - `GET /api/books/:id/cover`: the bytes, the stored `mime`, an `ETag`,
     `Cache-Control: private, max-age=86400`.
   - `PUT /api/books/:id/cover`: raw `image/jpeg|png|webp`, at most 2 MB (the
     web app resizes photos before upload).
   - `POST /api/books/:id/cover/fetch { url }`: the server downloads a
     candidate and stores it. Only `https` URLs on `covers.openlibrary.org`,
     `books.google.com` and `books.googleusercontent.com` are allowed, after
     redirects too, with a 2 MB cap and a 10 s timeout. Anything else is 400:
     this is the SSRF guard.
   - `DELETE /api/books/:id/cover`.
8. **Measurement** (`server/scripts/measure-lookup.ts`): given ISBN list files, prints
   per-source hit counts as in metadata-lookup.md. If the key exists when this
   brief runs, measure Google on the Romanian samples (a fresh 40 from a CIP
   issue on the national library's site) and put the numbers in
   metadata-lookup.md; otherwise say in the outcome note that it waits for the
   key.

## Acceptance

- Tests use recorded fixtures only; no test touches the network.
- Tests cover: merge order, thin-answer fallback, cache reuse and expiry,
  errors not cached, the queue spacing, `owned` detection, the SSRF guard
  (wrong host, http, redirect to a wrong host, oversize), cover round trip.
- Against the running dev server: `9780547928227` returns a draft with a
  cover candidate; `9786063205583` returns `draft: null` with every source in
  `tried`.
- `npm run typecheck && npm run lint && npm test` pass.
