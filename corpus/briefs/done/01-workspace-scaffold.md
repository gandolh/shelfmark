# Task 01: Workspace scaffold

## Context

Greenfield. The repo holds `corpus/`, `PRODUCT.md`, a short `README.md` and a
`.gitignore`, on `main`, with no remote. Everything else waits on this brief.
Extend the existing `README.md` and `.gitignore` rather than replacing them.

Read [architecture.md](../../wiki/architecture.md) for the three workspaces and
the dev wiring, and [decisions.md](../../wiki/decisions.md) before choosing
anything that could go another way. The house template is Satchel
(`../satchel`): copy its tooling shape (root `package.json` scripts,
`tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, `.npmrc`), not
its code.

Fixed values for the whole project:

| What | Value |
|---|---|
| Package names | `@shelfmark/shared`, `@shelfmark/server`, `@shelfmark/web` |
| Web base path | `/shelfmark/` (env `SHELFMARK_BASE`) |
| API prefix as the browser sees it | `/shelfmark-api` (stripped before the server) |
| Dev ports | API `8808`, Vite `5176` (both free in the estate on 2026-10-14) |
| Production API port | `8796` (brief 14) |

## Files you OWN

```
package.json  package-lock.json  .npmrc  .gitignore  .env.example  README.md
tsconfig.base.json  tsconfig.json  eslint.config.js  vitest.config.ts
shared/package.json  shared/tsconfig.json  shared/src/index.ts  shared/src/index.test.ts
server/package.json  server/tsconfig.json  server/src/index.ts  server/src/app.ts
server/src/config.ts  server/src/config.test.ts  server/src/testing/testApp.ts
web/package.json  web/tsconfig.json  web/vite.config.ts  web/index.html  web/src/main.tsx
corpus/.planned-roots   (remove the roots you create)
```

## Files you must NOT touch

The rest of `corpus/`, and `PRODUCT.md`. No schema, store, routes, ISBN code or
UI beyond the placeholder: briefs 02 to 12 own those.

## What to do

1. **Workspaces** `shared`, `server`, `web` with the names above.
   `save-exact=true`, `engines.node ">=24"`, `"type": "module"` everywhere.
2. **Pins.** Start from Satchel's exact versions: fastify 5.12.5,
   better-sqlite3 13.0.3, zod 4.5.4, vite 8.2.2, @vitejs/plugin-react 6.1.1,
   react and react-dom 19.2.8, vitest 4.1.11, typescript 6.0.3, eslint 10.9.1,
   typescript-eslint 8.69.0, @eslint/js 10.0.1, @types/node 24.19.1, tsx
   4.23.13, concurrently 10.0.5 with Satchel's `shell-quote` 1.11.0 override,
   @types/better-sqlite3 9.6.0, @types/react 19.2.18, @types/react-dom
   19.2.7, eslint-plugin-react-hooks 7.1.1. Add `@vitejs/plugin-basic-ssl` at
   its current release, provided it is at least two weeks old. Run
   `npm audit`; if a pin has an advisory, take the lowest fixed patch release
   that is at least two weeks old and say so in the outcome note.
3. **TypeScript** as Satchel's base config: ES2023, NodeNext, `strict`,
   `noUncheckedIndexedAccess`, unused locals and parameters,
   `noImplicitOverride`, `isolatedModules`. `shared` and `server` are composite
   and build with `tsc -b` into `dist/`; `web` is checked with
   `tsc -p web --noEmit`. Vitest with `pool: "forks"` (better-sqlite3).
4. **Server placeholders.**
   - `config.ts` reads and validates the environment once: `HOST` (default
     `127.0.0.1`), `PORT` (`8808`), `DATA_DIR` (default `<repo>/data`),
     `PUBLIC_ORIGIN` (default `http://localhost:5176`),
     `SHELFMARK_API_PREFIX` (`/shelfmark-api`), `SHELFMARK_BASE`
     (`/shelfmark/`), `GOOGLE_BOOKS_API_KEY` (optional; empty means unset).
     Unit-test the defaults and one bad value.
   - `app.ts` exports `buildApp(config)` returning a Fastify instance with
     `GET /api/health` → `{ "ok": true }`. Feature routes are Fastify plugins
     registered from one list in `app.ts`; later briefs each add one line.
   - `index.ts` loads `<repo>/.env` with `process.loadEnvFile` (a missing file
     is fine), builds the config and listens.
   - `server/src/testing/testApp.ts` builds an app on a fresh temporary `DATA_DIR` and
     returns it with Fastify's `inject`, so route tests never touch `data/`.
     Brief 06 extends it with a signed-in session.
5. **Web placeholder.** Renders "Shelfmark". `vite.config.ts`: `base` from
   `SHELFMARK_BASE`, dev server on 5176 with `strictPort`, proxy
   `/shelfmark-api` → `http://127.0.0.1:8808` with the prefix stripped. When
   `SHELFMARK_HTTPS=1`, enable `@vitejs/plugin-basic-ssl` and listen on
   `0.0.0.0`, so a phone on the LAN can open the camera
   ([scanning.md](../../wiki/scanning.md)).
6. **Root scripts:** `dev` (build `shared`, then the server in watch mode and
   Vite together), `dev:https` (the same with `SHELFMARK_HTTPS=1`), `build`,
   `start`, `test`, `typecheck`, `lint`.
7. **`.gitignore`** already covers `node_modules/`, `dist/`, `data/`, `.env`.
   Add `dev-dist/` and `infrastructure/.env`.
8. **`.env.example`**: every key `config.ts` reads, plus `SEED_USERNAME` and
   `SEED_PASSWORD` (brief 06) and the five `WARD_OIDC_*` names, all with empty
   values and a comment that Ward's local `seed.mjs` fills the Ward ones and
   that no value is ever committed.
9. **`README.md`**: keep the paragraph; add "Run it locally" (`npm install`,
   `npm run dev`, open `http://localhost:5176/shelfmark/`; `npm run dev:https`
   for a phone) and an empty "Owner setup" heading that brief 14 fills.

## Acceptance

- From a clean checkout: `npm install && npm run typecheck && npm run lint &&
  npm test && npm run build` all pass; `npm audit` reports nothing above low.
- `npm start`, then `curl http://127.0.0.1:8808/api/health` returns
  `{"ok":true}`.
- `npm run dev` serves the placeholder at `http://localhost:5176/shelfmark/`,
  and `curl http://localhost:5176/shelfmark-api/api/health` reaches the
  server.
- `npm run dev:https` serves over HTTPS on the LAN address.
- `bash corpus/lint.sh` is clean.

## Outcome

_2026-10-14_. Done. Three workspaces on Satchel's tooling shape, with every pin
as listed; `@vitejs/plugin-basic-ssl` 2.3.0 (published 2026-03-24, peer
`vite ^6 || ^7 || ^8`). `npm audit` found nothing, so no pin moved. Feature
routes go in the `FEATURES` list in `server/src/app.ts`; `startTestApp()` in
`server/src/testing/testApp.ts` returns `{ app, config, dataDir, close }`.
`server/src/app.test.ts` was added beyond the file list to test the health
route through `startTestApp`. `.env.example` carries the non-secret defaults
(`HOST`, `PORT`, `DATA_DIR`) as values; every other key is empty. Checked:
typecheck, lint, 6 tests, build, `npm start` + health, `npm run dev` through
the proxy, `npm run dev:https` on the LAN addresses.
