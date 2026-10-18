# Architecture

Shelfmark is three npm workspaces. `shared` holds the zod schemas for every
route, the book field definitions, and ISBN parsing and validation (ISBN-10
to 13, check digits); the other two import it. `server` is a Fastify API on
one SQLite file (better-sqlite3). Its store is the only code that runs SQL,
apart from the vendored Ward auth library. The server also owns the lookup
queue and cache, the covers (stored as BLOBs in the same database) and the
backup. `web` is the React PWA, served under `/shelfmark/`. It holds the
library table, the scanner, the book page and the export, and talks only to
the API. In production Caddy serves the PWA and forwards `/shelfmark-api/*`
to the API container with the prefix stripped, so the server's own routes
are `/api/*` and `/auth/*`. In development Vite does the same.

```mermaid
flowchart LR
  subgraph device["Phone or laptop"]
    web["Shelfmark PWA<br/>/shelfmark/"]
  end
  subgraph vps["VPS"]
    caddy["Caddy"]
    api["Shelfmark API<br/>Fastify, port 8796"]
    db[("SQLite<br/>books, covers, lookup cache")]
    ward["Ward"]
  end
  ol["Open Library"]
  libs["Romanian library catalogs<br/>Z39.50, port 9991"]
  bnr["National library's site<br/>CIP lists, weekly"]
  gb["Google Books"]
  web -- "/shelfmark-api/* with the session cookie" --> caddy
  caddy --> api
  api --> db
  api -- "ISBN lookup" --> ol
  api -- "when Open Library has no title" --> libs
  api -. "weekly refresh of cip.db" .-> bnr
  api -. "last, only with a key" .-> gb
  api -. "Sign in with Ward (OpenID Connect)" .-> ward
```

## Adding a book

1. You aim the phone camera and tap *Scan the barcode*. Only then does it
   read, with BarcodeDetector, or with the ZXing WebAssembly polyfill where
   the browser has none, until two reads agree, for up to 3 s. You can also
   type the ISBN, or let a USB scanner type it. `shared` checks the digits.
2. The web app sends `POST /api/lookup` with the ISBN. An ISBN the page
   already looked up during this visit shows at once, with no request.
3. The server answers from its cache, or asks the sources in order: Open
   Library, then three Romanian library catalogs over Z39.50 (the Romanian
   Academy Library, BCU Cluj, BCU Timișoara), then the CIP index, then Google
   Books. It stops at the first source with a title. The CIP index is a local
   copy of the national library's monthly lists of books announced before
   printing, in `data/cip.db`, refreshed weekly from its site; it covers
   books from 2019 on, which the libraries take a year or so to catalogue. The libraries are asked one request at a
   time each, with a random 5-10 s pause between requests, so a second
   Romanian book scanned straight after the first can take ten seconds. The
   server runs one lookup per ISBN at a time, and returns a draft plus any
   book with that ISBN you already own.
4. If you own it, the app says so and offers "Open the book" or "Add another
   copy".
5. If the draft is good, you pick a shelf and a status and save it with
   `POST /api/books`. If the lookup found nothing, a short form asks for the
   title, and the rest can wait.
6. A cover found by the lookup is fetched from an allowed host and stored in
   the database. A book without one gets a cover drawn from its title and
   author.

The library then loads every book with `GET /api/books`, and TanStack Table
sorts, filters and searches them in the browser.

## Read more

- [corpus/wiki/architecture.md](../corpus/wiki/architecture.md): routes,
  request paths, ports, data and secrets
- [corpus/wiki/metadata-lookup.md](../corpus/wiki/metadata-lookup.md): the
  sources, their hit rates, the queue and the cache
- [corpus/wiki/scanning.md](../corpus/wiki/scanning.md): barcode reading,
  HTTPS and the iOS camera bug
- [corpus/wiki/library-table.md](../corpus/wiki/library-table.md) and
  [corpus/wiki/export.md](../corpus/wiki/export.md): the table and the
  exports
- [corpus/wiki/decisions.md](../corpus/wiki/decisions.md): what was decided
  and what was rejected
- Code: [shared/src/isbn.ts](../shared/src/isbn.ts),
  [server/src/lookup/](../server/src/lookup/),
  [server/src/routes/](../server/src/routes/),
  [web/src/add/](../web/src/add/), [web/src/library/](../web/src/library/)
