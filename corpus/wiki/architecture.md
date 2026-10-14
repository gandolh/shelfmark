---
summary: How Shelfmark will be put together, proposed on 2026-10-14 before any code. Three npm workspaces copied from Satchel's layout (shared, server, web), what each owns, the request paths, where data lives, phone testing over HTTPS in dev, and the deploy shape on the shared VPS.
updated: 2026-10-14
---

# Architecture (proposed)

Nothing is built. This is the intended shape; the first brief creates it.

## Pieces

npm workspaces, the Satchel layout (`../satchel`), Node 24, exact versions
(`save-exact=true`), TypeScript strict, Vitest, ESLint:

- `shared`: zod schemas for every route, the book field definitions, ISBN
  parsing and validation (ISBN-10 ↔ 13, check digits). Used by both sides.
- `server`: Fastify + better-sqlite3. Owns the store (the only module that
  runs SQL, apart from the vendored auth library), the lookup queue and cache
  ([metadata-lookup.md](metadata-lookup.md)), cover files, backup, and the
  `/api/*` and `/auth/*` routes.
- `web`: Vite + React PWA (vite-plugin-pwa, Workbox). The library table
  ([library-table.md](library-table.md)), the scanner
  ([scanning.md](scanning.md)), the book page, export
  ([export.md](export.md)). Talks only to the API.

No CLI workspace: nothing outside the browser needs the data yet.

## Main routes

| Route | Does |
|---|---|
| `GET /api/books` | every book, for the table |
| `POST /api/books`, `PATCH /api/books/:id`, `DELETE /api/books/:id` | save, edit, delete |
| `POST /api/lookup` `{ isbn }` | draft from cache, Open Library, Google Books |
| `GET /api/books/:id/cover`, `PUT` same | serve or replace the cover |
| `GET /api/backup` | zip of the database and covers |
| `/auth/*` | the vendored `ward-auth` plugin: local login and Sign in with Ward |

## Request paths

As Satchel: Caddy on the shared VPS serves the PWA at `/shelfmark/*` and
forwards `/shelfmark-api/*` with `handle_path` to the API container on
`127.0.0.1:<port>`, deployed by `../vps-deploy` as a `WebServiceStack`. The
port is picked when the deploy brief is written. Deploying is an owner step.

## Dev

`npm run dev` runs the API (tsx watch) and Vite together. Vite proxies
`/shelfmark-api` to the API and strips the prefix, so paths match production.
The camera needs HTTPS on a phone ([scanning.md](scanning.md)): a
`dev:https` script serves Vite with a local certificate (mkcert or
`@vitejs/plugin-basic-ssl`) on the LAN address. Certificates stay gitignored.

## Data

`data/` at the repo root in dev, a mounted volume in the container:
`shelfmark.db` and `covers/`. See [data-model.md](data-model.md).

## Secrets

`.env` (gitignored) holds `GOOGLE_BOOKS_API_KEY`, the seed user values and, if
Ward is used, the `WARD_OIDC_*` values. `.env.example` lists the keys with no
values.
