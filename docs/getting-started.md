# Getting started

Run Shelfmark on your own machine: the API and the web app. Deploying is a
separate, hand-run step in [owner-setup.md](owner-setup.md).

## Prerequisites

- Node 24 or later and npm. `engines` in `package.json` sets the Node floor.
- Optional, for Google Books lookups: an API key, made as step 1 of
  [owner-setup.md](owner-setup.md) describes. Without it Shelfmark asks Open
  Library, the Romanian library catalogs and the CIP index only.
- Optional, for the CIP index: `pdftotext`, from poppler-utils
  (`sudo apt install poppler-utils`). Without it the weekly refresh logs one
  error and lookups go on without the index.
- Optional, for "Sign in with Ward": the local Ward container from the sibling
  `wzd_auth` repo, started and seeded as its
  `infrastructure/local/README.md` describes. Without it Shelfmark runs with
  local accounts only.

## Install

```bash
npm install
```

## Configure

Copy `.env.example` to `.env`, which git ignores. The server reads it at
start-up, and the Vite dev server reads it for the API port. Every key is
optional; an empty value counts as not set.

| Variable | Purpose | Default or source |
|---|---|---|
| `HOST` | Address the API binds to | `127.0.0.1` |
| `PORT` | API port; the dev proxy follows it | `8808` |
| `DATA_DIR` | Folder for `shelfmark.db`, which holds the covers too. A relative path is taken from the repo root | `./data` |
| `PUBLIC_ORIGIN` | The app's own origin as the browser sees it, with no path. Leave it empty for `npm run dev:https` | `http://localhost:5176` |
| `SHELFMARK_API_PREFIX`, `SHELFMARK_BASE` | The API prefix and the web base path as the browser sees them | `/shelfmark-api`, `/shelfmark/` |
| `GOOGLE_BOOKS_API_KEY` | Lets lookups ask Google Books, last, when no other source found a title. A secret | your Google Cloud project |
| `CIP_REFRESH` | `off` stops the weekly refresh of the CIP index (`data/cip.db`). The first refresh fetches about 80 issues, some 200 MB, over 15 minutes | on |
| `SEED_USERNAME`, `SEED_PASSWORD` | The account the seed creates; it asks for whichever is empty | you choose |
| `AUTH_TRUSTED_PROXIES` | Peers besides loopback whose `X-Forwarded-For` the login lockout believes. Empty is right locally | empty |
| `WARD_OIDC_ISSUER`, `WARD_OIDC_CLIENT_ID`, `WARD_OIDC_CLIENT_KEY`, `WARD_OIDC_REDIRECT_URI`, `WARD_OIDC_POST_LOGOUT_REDIRECT_URI` | Optional. "Sign in with Ward". The key is a secret | Ward's local seed writes all five |

## Create the account

Shelfmark has no sign-up page. Make the account with the seed:

```bash
npm run seed -w @shelfmark/server
```

It asks on the terminal for a username and password, or reads
`SEED_USERNAME` and `SEED_PASSWORD` from `.env` or the environment. The seed
saves the password in the database and nowhere else, and leaves an existing
account as it is.

## Run

```bash
npm run dev
```

This builds `shared`, then runs the API under `tsx watch` and the Vite dev
server side by side. Open <http://localhost:5176/shelfmark/> and sign in.

- Vite serves the app under `/shelfmark/` on port 5176 and stops if that port
  is taken.
- The API listens on port 8808. Vite proxies `/shelfmark-api` to it with the
  prefix stripped, the way Caddy does in production, so the paths match.
- The database is `data/shelfmark.db`. Covers live inside it.

## Scan from a phone

A browser opens the camera only on a secure origin, and plain
`npm run dev` is HTTP. Run this instead:

```bash
npm run dev:https
```

Vite then serves HTTPS with a self-signed certificate from
`@vitejs/plugin-basic-ssl`, which caches it under `node_modules/.vite/`, so it
never reaches git. It also listens on every network interface. On a phone on the same network, open
`https://<your computer's LAN address>:5176/shelfmark/` and accept the
certificate warning. Keep `PUBLIC_ORIGIN` empty, and the dev proxy hands the
server the right origin for requests from that address. Which browsers can
read barcodes, and why, is in
[corpus/wiki/scanning.md](../corpus/wiki/scanning.md).

On a laptop, a USB barcode scanner needs none of this. It types the digits
and Enter into the ISBN field on Add a book.

## Try "Sign in with Ward"

Start Ward locally and run its seed, as
`../wzd_auth/infrastructure/local/README.md` describes. The seed registers
Shelfmark and writes the five `WARD_OIDC_*` values into this repo's `.env`.
Restart `npm run dev` afterwards. The login page then shows the Ward button.

## Test, typecheck, lint, build

```bash
npm test            # vitest, every workspace
npm run typecheck
npm run lint
npm run build       # tsc for shared and server, then the web app
```

## Common problems

- **`npm run dev` stops with `ENOSPC`.** The system ran out of file watchers,
  which happens when VS Code holds most of them. Run it with polling instead:
  `CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=300 npm run dev`.
- **The server prints `Shelfmark cannot start:` and names a key.** A value in
  `.env` is malformed, such as a `PUBLIC_ORIGIN` with a path, or a
  `WARD_OIDC_*` value is missing while `WARD_OIDC_ISSUER` is set. The message
  says which.
- **Port 5176 is in use.** The dev server won't pick another port. Stop
  whatever holds it.
- **The add form says Google Books "isn't set up yet".** `GOOGLE_BOOKS_API_KEY`
  is empty, so Google was skipped after the other sources missed.
- **A Romanian book from the last year isn't found.** The CIP index may be
  empty: the server fills it a minute after it starts, then weekly. Run
  `npx tsx server/src/cip/cli.ts refresh` to fill it by hand, or
  `... refresh 2026-01 2026-02` for some months only.
- **A library "didn't answer".** The library catalogs are reached over TCP
  port 9991. A network that blocks it makes every library lookup an error;
  BCU Timișoara also misses the 10 s deadline now and then. Errors aren't
  cached, so "Look it up again" asks once more.
