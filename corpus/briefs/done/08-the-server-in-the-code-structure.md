# Task 08: The server in the house code structure

**Depends on:**

- In Shelfmark: brief 05, for the gate, the `no-process-env` rule (from `eslint-plugin-n`) (a warning until this brief) and `.claude/rules/server.md`.
- In the owner's skills library:
  - brief 03, *A code-structure skill for the Fastify + React apps*: rules 1-11, the references, `check-structure.mjs`, the dependency-cruiser and knip presets;
  - brief 16, *The Fastify servers adopt the code structure*: Shelfmark's row and the method;
  - brief 15: `check-structure` runs `--warn-only` until this brief is done.
- The owner's grilling of 2026-11-10: Q1 (the container starts a file path, so the rename changes the Dockerfile's `CMD`), Q23 (`features/<name>/`), Q24 (typed plugin options, explicit registration), Q25 and Q53 (a response schema on every route; streams and binary routes exempt), Q26 (Shelfmark's "nothing boots the app" stands against `inject()`), Q27 (vitest stays), Q43 (one error handler), Q52 and Q54-Q56, and the new question in decision 3.

**Order:** after 05. It touches no file that 06 or 07 touch except `package-lock.json`, so run it before or after them, never at the same time. Brief 04 (Wishlist, with recommendations) adds server files and a migration and edits `server/src/app.ts`, which this brief moves, so run the two one after the other too (04 first is the plan).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner asked on 2026-11-09 for one researched code structure in every repo. Shelfmark's server already has the shape Almanac took from it: `buildApp(config, options)` never listens (`server/src/app.ts:125`), `loadConfig()` parses the environment once with zod (`server/src/config.ts:124`), features get a typed `FeatureContext` and register by name (`app.ts:18, 102`), and one error handler sends `{ error: { code, message } }` (`server/src/errors.ts:74`).

What is missing: the `server.ts` name, five stray readers of the environment, feature folders, route schemas (response schemas above all), `fastify-plugin` on the cross-cutting plugins, `close-with-grace`, timeouts. And one thing Almanac has that Shelfmark deliberately does not: **no test boots the app** ([wiki/decisions.md](../../wiki/decisions.md), "Only lightweight tests"; the route tests and `testApp.ts` were deleted on 2026-10-24). That shapes what "tested" can mean here (decision 4).

### The versions (verified 2026-11-10)

- **zod 4.5.4** in `shared`, `server` and the root `overrides`; one copy in `package-lock.json`. `@fastify/type-provider-zod` 1.0.3 needs `>=4.2.0`: **no zod move**.
- **fastify 5.12.7** (`server/package.json`); the provider needs `^5.5.0`.
- The provider declares `@fastify/swagger` and `openapi-types` as required peers; npm installs them (type-only weight). Pin both. `fastify-plugin` and `close-with-grace` are the other new dependencies, and all of them go in `dependencies`, not dev: the image's `proddeps` stage runs `npm ci --omit=dev -w @shelfmark/server`.
- **The Docker image has no `git`** (`infrastructure/Dockerfile`, `deps` stage). Every new dependency is an npm registry package, so this does not bite here (brief 05 vendors `house-style` for the same reason).

### A trap in the shared schemas (found 2026-11-10)

The provider's serializer calls zod's encode, and **zod throws when encoding through a `.transform()`**. Run against zod 4.5.4 and provider 1.0.3 on Shelfmark's own `shared/src` (a scratch copy):

- `savedViewListSchema` and `savedViewSchema` throw `Encountered unidirectional transform during encode: ZodTransform`.
- The cause is `state: z.unknown().transform(readSavedViewState)` at `shared/src/views.ts:174`. The same schema with `state: savedViewStateSchema` encodes fine.
- So `GET /api/views`, `POST /api/views` and `PATCH /api/views/:id` would each answer 500 once their response schemas are declared.

The web needs the lenient `savedViewSchema` (`web/src/library/savedViewsStore.ts:2-3, 34-36` parse answers with it). The server's store already applies `readSavedViewState` on the way out (`server/src/store/views.ts:56`). So: add a transform-free `savedViewOutputSchema` (`state: savedViewStateSchema`, imported from `shared`) for the server's `response`, and leave `savedViewSchema` for the web. By Q55 it lives in the views feature, `server/src/features/views/schemas.ts`, not in `shared/`, because only the server uses it. The same goes for brief 04's schemas: a response schema must carry no `.transform()`. The other `.transform()` and `preprocess` calls (`book.ts:116, 125, 211, 230`, `views.ts:168`) are in input schemas, which are decoded, and decoding is fine. `bookSchema`, `bookListSchema`, `bookBulkResultSchema`, `lookupResponseSchema` and `coverInfoSchema` have none.

**Cost of the serializer, measured:** 3,000 full book rows through `serializerCompiler` took 20-49 ms (3.97 MB), against 6 ms for `JSON.stringify`. `GET /api/books` answers the whole library, so that is its price.

**Response validation is strict.** The serializer re-checks every value: `z.iso.datetime()` on `createdAt`/`updatedAt`/`coverUpdatedAt`, the ISBN-13 regex, `rating` 1-5. A stored value out of shape becomes a 500. Step 1's comparison runs against a copy of a real database for this reason.

### The move map: every file under `server/src/` (57 TypeScript files: 36 source, 21 tests; plus 20 fixture files)

A bare name sits at the root of `server/src/`; other paths are from the repo root.

| Today | Lines | Target | Note |
|---|---|---|---|
| `index.ts` | 61 | `server.ts` | config → `buildApp` → `listen`, `close-with-grace`. The `.env` read, the data-dir rule and the weekly CIP job move out (below). |
| `app.ts` | 164 | the same | Keeps `buildApp`, `FeatureContext`, `Feature`, `FEATURES`. `signIn` (53-92) moves to `server/src/plugins/auth/index.ts`, the empty-body JSON parser (139-148) to `server/src/plugins/json-body.ts`, the health route (151) to `server/src/features/health/routes.ts`. |
| `config.ts`, `config.test.ts` | 147, 114 | the same | Gains `loadEnvFile()`, `resolveDataDir()`, `loadSeedConfig()`. |
| `errors.ts` | 91 | `server/src/lib/api-error.ts` + `server/src/plugins/errors.ts` | `ApiError`, `ERROR_STATUS`, `ErrorCode`, `ErrorBody`, `errorBody` to `lib/` (no Fastify import); `sendError` and the handlers to the plugin. |
| `server/src/auth/accounts.ts`, `server/src/auth/guard.ts` | 31, 66 | `server/src/plugins/auth/` (same names) | `index.ts` (new) is `signIn`, wrapped in `fastify-plugin` so `wardAuth` and the origin guard stay root hooks. |
| `server/src/db/open.ts`, `server/src/db/migrations.ts`, `server/src/db/migrations.test.ts` | 30, 124, 181 | the same | |
| `server/src/routes/books.ts`, `server/src/store/books.ts`, `server/src/store/books.test.ts` | 64, 360, 415 | `server/src/features/books/{routes,store,store.test,index}.ts` | `index.ts` exports `createBookStore` and `BookStore`. |
| `server/src/routes/covers.ts`, `server/src/store/covers.ts`, `server/src/store/covers.test.ts` | 231, 45, 87 | `server/src/features/covers/{routes,store,store.test,service}.ts` | `sniffImage`, `checkCoverUrl`, `downloadCover` (`covers.ts:31, 58, 122`) go to `service.ts`: logic shared by routes, rule 7. |
| `server/src/routes/views.ts`, `server/src/store/views.ts`, `server/src/store/views.test.ts` | 62, 141, 143 | `server/src/features/views/` | |
| `server/src/routes/backup.ts` | 52 | `server/src/features/backup/routes.ts` | |
| `server/src/routes/lookup.ts` | 55 | `server/src/features/lookup/routes.ts` | |
| `server/src/lookup/*.ts` and tests (`cache`, `cip`, `googlebooks`, `libraries`, `merge`, `openlibrary`, `queue`) | 14 files | `server/src/features/lookup/` (same names) | |
| `server/src/lookup/z3950/*` and tests | 8 files | `server/src/features/lookup/z3950/` | |
| `server/src/cip/*` (`issues`, `job`, `parse`, `refresh`, `store`, `cli`) and tests | 11 files | `server/src/features/lookup/cip/` | One feature with the lookup: decision 3. |
| (new) | | `server/src/features/lookup/index.ts` | What other code may use: `USER_AGENT`, the CIP store and job. `covers` imports `USER_AGENT` (`covers.ts:13`) through it. |
| `seed.ts` | 81 | the same | A CLI. The container runs `node server/dist/seed.js` ([docs/owner-setup.md](../../../docs/owner-setup.md):137). |
| `server/src/testing/fakeFetch.ts`, `server/src/testing/fakeLibraries.ts` | 118, 133 | the same | Used by cip, lookup and covers tests: three features, so they stay shared. |
| `server/scripts/measure-lookup.ts`, `record-z3950.ts` | 138, 99 | the same | Their `../src/lookup/…` imports (`measure-lookup.ts:26-29`, `record-z3950.ts:17-21`) take the new paths. |

Fixtures move with their tests, and **two hard-coded paths must move with them:**

- `server/src/testing/fakeFetch.ts:15` (`new URL("../lookup/fixtures/", …)`) and `fakeLibraries.ts:42` (`../lookup/z3950/fixtures/`).
- `fakeFetch.ts:99, 104` answer `hasFixture(name) ? fixture(name) : {}`. With a stale path, `hasFixture` is false and Open Library silently answers `{}` ("not found") instead of failing. Add a guard test that `hasFixture("openlibrary-data-9780547928227")` is true, in the commit that moves the fixtures.

**Feature boundaries after the move** (rule 5: only through `index.ts`): `covers` and `lookup` use `books` through `server/src/features/books/index.ts` (the `books` store is also in `FeatureContext`); `covers` uses `server/src/features/lookup/index.ts`. `lookup` ↔ CIP is one feature because today they import each other: `server/src/cip/issues.ts:1-3` and `server/src/cip/refresh.ts:5-6` import `server/src/lookup/merge`, `server/src/lookup/openlibrary` and `server/src/lookup/queue`, and `server/src/lookup/cip.ts:1` imports `server/src/cip/store`.

### Every reader of the environment

| Where | What | Afterwards |
|---|---|---|
| `config.ts:124` | `loadConfig(env = process.env)` | stays, the one reader |
| `index.ts:20` | `loadConfig(process.env)` | `server.ts` calls `loadConfig()` |
| `server/src/cip/cli.ts:36` | the same | the same |
| `index.ts:13`, `server/src/cip/cli.ts:29`, `seed.ts:27`, `scripts/measure-lookup.ts:34` | `process.loadEnvFile(<repo>/.env)`, ENOENT swallowed | `loadEnvFile()` in `config.ts` |
| `seed.ts:59, 60` | `SEED_USERNAME`, `SEED_PASSWORD` | `loadSeedConfig()` |
| `seed.ts:66`; `index.ts:29`; `server/src/cip/cli.ts:37` | `DATA_DIR`, with the "relative means the repo root" rule written three times (seed has its own `./data` default) | `resolveDataDir()`, one rule |
| `scripts/measure-lookup.ts:47` | `GOOGLE_BOOKS_API_KEY` | a script, excepted |
| outside `server/` | `web/vite.config.ts:142, 147`, `docs/images/demo-seed.mjs:20` | out of scope |

**A silent failure to design around.** Each of those files computes `REPO_ROOT` from its own depth (`new URL("../../", import.meta.url)`, `server/src/cip/cli.ts:20` uses `../../../`). Moving a file one folder deeper without fixing that makes `loadEnvFile` fail with ENOENT, which is swallowed, so `.env` and `DATA_DIR` are quietly not read. `loadEnvFile()` and `resolveDataDir()` take the root from `config.ts`'s own location, once, and `server/src/cip/cli.ts` stops computing one.

No file reads `NODE_ENV`; the Dockerfile sets it for Fastify's dependencies only.

### Every route: 17, by feature

The vendored `wardAuth` plugin's `/auth/*` routes are generated and out of scope. Schemas are the existing ones in `shared/src/`; new ones are marked.

| Feature | Method and path | params | body | response |
|---|---|---|---|---|
| health | `GET /api/health` (`app.ts:151`) | | | `200`: **new** `healthSchema` (`{ ok: true }`), in `features/health/` (Q55) |
| books | `GET /api/books` (`books.ts:32`) | | | `bookListSchema` |
| | `GET /api/books/:id` (34) | **new** `idParamsSchema` (in `server/src/lib/`, three features use it, Q55) | | `bookSchema` |
| | `POST /api/books` (40) | | `bookCreateSchema` | `201`: `bookSchema` |
| | `POST /api/books/bulk` (46) | | `bookBulkSchema` | `bookBulkResultSchema` |
| | `PATCH /api/books/:id` (53) | `idParamsSchema` | `bookPatchSchema` | `bookSchema` |
| | `DELETE /api/books/:id` (60) | `idParamsSchema` | | `204` |
| views | `GET /api/views` (`views.ts:32`) | | | **new** `savedViewListOutputSchema` |
| | `POST /api/views` (34) | | `savedViewCreateSchema` | `201`: `savedViewOutputSchema` |
| | `PATCH /api/views/:id` (45) | `idParamsSchema` | `savedViewPatchSchema` | `savedViewOutputSchema` |
| | `DELETE /api/views/:id` (58) | `idParamsSchema` | | `204` |
| lookup | `POST /api/lookup` (`lookup.ts:38`) | | `lookupRequestSchema` | `lookupResponseSchema` |
| covers | `GET /api/books/:id/cover` (`covers.ts:187`) | `idParamsSchema` | | **bytes** (`304`, headers): no JSON schema |
| | `PUT /api/books/:id/cover` (200) | `idParamsSchema` | **raw bytes** | `coverInfoSchema` |
| | `POST /api/books/:id/cover/fetch` (215) | `idParamsSchema` | `coverFetchRequestSchema` | `coverInfoSchema` |
| | `DELETE /api/books/:id/cover` (226) | `idParamsSchema` | | `204` |
| backup | `GET /api/backup` (`backup.ts:23`) | | | **a file stream**: no JSON schema |

**Q25's answer from the code:** no route sends pass-through JSON (so no loose object is needed), but two send bytes (the cover image and the backup), which cannot have a JSON `response`. Streams and binary routes are exempt (Q53); they are the only exceptions, each with an entry in `scripts/conventions.json`. The `PUT` cover route has no body schema because its body is raw bytes, parsed by a plugin-scoped `*` content-type parser (`covers.ts:181-185`).

**`idParamsSchema` stays a plain `{ id: string }`.** `bookId()`, `viewId()` (a regex, `^[1-9]\d{0,15}$`) answer a non-numeric id with 404 `not_found`; a regex in the schema would make it a 400.

**Hand parsing removed:** 7 `.parse(request.body)` calls in 4 files: `books.ts:41, 47, 55`, `views.ts:35, 47`, `lookup.ts:39`, `covers.ts:217`. (`config.ts`'s `safeParse` reads the environment, not a request.)

### The error plugin

`server/src/plugins/errors.ts`, wrapped in `fastify-plugin`, registered first. It **keeps Shelfmark's body, `{ error: { code, message } }`**, which `web/src/api.ts:164-178` parses. In order:

1. `ApiError` → its code.
2. `hasZodFastifySchemaValidationErrors(error)` → 400 `validation`. The message is the first issue's path and message, as `describeIssue` builds today (`errors.ts:50`): `body.isbn13: must be 13 digits…`, `/` giving the message alone.
3. A `z.core.$ZodError` → 400 `validation`, for any parse left in a service (`errors.ts:78`).
4. `isResponseSerializationError(error)` → 500 `internal`, logged with the method and URL, never shown.
5. A 4xx Fastify raised → its status, `not_found` for 404, else `validation` (`errors.ts:80-84`). Fastify's own 4xx pass through with their status (Q43).
6. Anything else → 500 `internal`, logged, and **a thrown message is never echoed to the client** (Q43).

Keep the mapping as an exported pure function, `mapError(error)`, so it is unit-tested without Fastify. The 404 handler stays, and the 415 the cover `PUT` builds by hand (`covers.ts:~206`, code `validation`) stays too. `@fastify/rate-limit` is not a dependency, so the 404 handler is not rate-limited.

### The `server.ts` / `app.ts` split

`server.ts`:

1. `loadEnvFile()` and `loadConfig()`; a `ConfigError` goes to stderr and exits 1, before any logger exists.
2. `buildApp(config, { logger: true, server: { connectionTimeout, requestTimeout, keepAliveTimeout, trustProxy } })`; `BuildAppOptions` gains `server`.
3. The weekly CIP job (`index.ts:35-49`), as `startCip(app, config)` exported by `server/src/features/lookup/index.ts`.
4. `close-with-grace`, replacing the two signal handlers (`index.ts:51-62`).
5. `listen({ host, port })`.

`app.ts` registers in a fixed order: errors plugin, JSON body plugin, the provider's compilers, `server/src/plugins/auth` (still before anything with routes), then `FEATURES`: health, books, lookup, covers, backup, views.

**Renaming the entry moves the built file** from `server/dist/index.js` to `server/dist/server.js`. It is named in: `infrastructure/Dockerfile:112` (`CMD`), the root `package.json:19` (`start`), and `server/package.json`: `main` (7), `dev` (`tsx watch src/index.ts`), `start` (11), and `exports` (24-37). The `exports` map has no importer and its `./testing` entry points at a deleted file, so **drop it and `main`**. The container starts the `CMD`'s path, so the Dockerfile edit is the whole change (decision 6).

**Moving the CIP CLI moves its documented command.** `node server/dist/cip/cli.js refresh` ([docs/owner-setup.md](../../../docs/owner-setup.md):208, [wiki/metadata-lookup.md](../../wiki/metadata-lookup.md):199) becomes `node server/dist/features/lookup/cip/cli.js refresh`, and `npx tsx server/src/cip/cli.ts` ([docs/getting-started.md](../../../docs/getting-started.md):125) likewise. Update those pages, and hand the owner the container command.

### Test impact

- 21 test files (the whole suite is 63 files, 743 tests, 5.5 s on 2026-11-10); no route test exists.
- Moved tests need their relative imports updated, `../db/open.js` and `../testing/…` first.
- No existing assertion changes.
- **New tests, none of which boots the app (decision 4):**
  - `server/src/features/views/schemas.test.ts`: `z.encode(savedViewSchema, view)` throws the unidirectional-transform error, and `z.encode(savedViewOutputSchema, view)` passes (the trap, written down).
  - For each response schema, `serializerCompiler` over a store row: an extra field is stripped, and a row with a bad value is a `ResponseSerializationError`.
  - `mapError` for each of the six cases.
  - `server/src/features/covers/service.test.ts`: `checkCoverUrl`'s host allowlist and redirects, `sniffImage`, `downloadCover` with `fakeFetch`. Today these have **no tests at all** (knip lists `sniffImage`, `COVER_HOSTS`, `checkCoverUrl`, `downloadCover` as exports nothing imports, and the fakes `redirect`, `image`, `RECORDED_COVER` in `fakeFetch.ts:30, 46, 87` serve no test), left over from the deleted route tests.
  - The `hasFixture` guard.

## Owner decisions (defaults this brief builds)

1. **`server/src/features/<name>/`** (decided 2026-11-10, technical call, Q23). As in the move map.
2. **Typed plugin options, explicit registration** (decided 2026-11-10, technical call, Q24 and Q56). Keep `FeatureContext` and `FEATURES`. Tests pass dependencies as plugin options; no decorators as a test seam. Decorators only for request-scoped values; there are none. `FeatureContext.cip` is used by one feature and the entry; leave it, since the store is closed with the app. A feature's CLI may live beside it (the CIP CLI does).
3. **Lookup and CIP as one feature.** Default: yes, `server/src/cip/` becomes a private subfolder of `server/src/features/lookup/`, because the two import each other today. The alternative keeps two features and moves `queue.ts`, `getJson`, `USER_AGENT` and the `record`/`array` helpers to `lib/`. Either moves the documented CIP command. *Still open for the owner; the pages don't answer it.*
4. **Tests without booting the app** (decided 2026-11-10, technical call, Q26): Shelfmark's "Only lightweight tests" decision stands. Handlers and plugins are tested as units without `inject()`: response schemas through `serializerCompiler`, the error mapping through `mapError`, the cover service with `fakeFetch`. The before/after JSON comparison is a manual script, not a test. Plugins take their dependencies as options, so a handler can be called with a fake.
5. **The error body** (decided 2026-11-10, technical call, Q43): one handler, keeping `{ error: { code, message } }`; Fastify's own 4xx pass through; a thrown message is never echoed to the client.
6. **The entry file** (decided 2026-11-10, fact, Q1): the container starts a file path (`CMD ["node", "server/dist/index.js"]`), and the build runs `npm ci` and `npx tsc -b server` with no tests or lint. Rename to `server.ts` and change the Dockerfile's `CMD`, the scripts and the `exports` map in the **same commit**; the repo owns the Dockerfile, so there is no vps-deploy edit to hand over.
7. **Test runner** (decided 2026-11-10, technical call, Q27): vitest stays.
8. **Timeouts and proxy.** Defaults: `connectionTimeout: 10_000`; `requestTimeout: 30_000` (the cover download allows 10 s, `covers.ts:53`; the backup streams the database and is the longest, so measure it on a copy first and raise this if it needs more); `keepAliveTimeout: 125_000`, above Caddy's two-minute upstream idle default (check the deploy's Caddy snippet, which was not readable here); `trustProxy`: loopback plus `AUTH_TRUSTED_PROXIES`, one list. Ward's lockout reads its own list (`config.trustedProxies`), unchanged.
9. **Validation before authorisation** (decided 2026-11-10, technical call, Q52): accepted. Sign-in still registers first and gates every route, so only a signed-in request meets a body schema. A big `store.ts` stays whole (Q54): no store here is split.
10. **Logging.** Default: JSON as today, no `pino-pretty`.
11. **Fastify 5.12.8.** Default: not in this brief.

## Files you OWN

- `server/src/**` and `server/scripts/**` (import paths only).
- `server/package.json` (scripts, new pinned dependencies, `main` and `exports` dropped) and `package-lock.json`.
- `server/src/features/*/schemas.ts` (new): `healthSchema`, `savedViewOutputSchema` and `savedViewListOutputSchema`, and `server/src/lib/` for `idParamsSchema` (Q55). `shared/` does not change.
- `infrastructure/Dockerfile` (the `CMD` line), the root `package.json` (`start`, `check:conventions`).
- `.dependency-cruiser.cjs` (new), `eslint.config.js` (`no-process-env` to error), `knip.json` (entries), `scripts/conventions.json`, `.claude/rules/server.md`.
- Docs: [docs/architecture.md](../../../docs/architecture.md):87-88, [docs/getting-started.md](../../../docs/getting-started.md):125, [docs/owner-setup.md](../../../docs/owner-setup.md):208.
- Corpus: [wiki/metadata-lookup.md](../../wiki/metadata-lookup.md) (its links to `server/src/routes/lookup.ts`, `server/src/lookup/*`, `server/src/routes/covers.ts`, `server/src/cip/*`, lines 117-197, break the corpus linter when files move), [wiki/data-model.md](../../wiki/data-model.md):13, 67, [wiki/architecture.md](../../wiki/architecture.md), [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `shared/`, and `web/`. A response schema that drops a field the web reads is a finding: fix the schema.
- `server/vendor/`, `server/src/**/fixtures/` contents.
- The Dockerfile beyond the `CMD` line, and the deploy.
- Behaviour: status codes, error codes and messages, and every route's JSON apart from fields the comparison shows were leaks.

## What to do

One commit per step; `npm run check` and `npm run build` pass after each, and `npm start` answers `GET /api/health`.

1. **Before.** Run `check-structure` strict and record counts by rule. Seed a scratch `DATA_DIR` from a copy of the owner's database (the backup download) plus `docs/images/demo-seed.mjs`. Save the JSON of every JSON route above, signed in as the demo user, as `server/scripts`-style throwaway output outside git. Include a view, a book with a cover, a wishlist book and a lookup of a seeded ISBN. Save the two byte routes' headers and sizes.
2. **`config.ts` and the split.** Add `loadEnvFile()`, `resolveDataDir()`, `loadSeedConfig()`; `seed.ts` and `server/src/cip/cli.ts` use them. `index.ts` becomes `server.ts`, with `close-with-grace`, timeouts, `trustProxy` and the entry-file changes. the `no-process-env` rule (from `eslint-plugin-n`) now finds nothing in `server/src`; make it an error.
3. **The error plugin, `server/src/lib/api-error.ts`, `server/src/plugins/json-body.ts`, `server/src/plugins/auth/`.** Add `mapError` and its test. Behaviour is unchanged.
4. **Feature folders** (2026-11-11: `.dependency-cruiser.cjs` already landed with the harness, with `no-circular` lowered to a warning; this step drops that lowering and adds the cross-feature check.), `git mv` file by file per the map, so history follows. Fix the two fixture paths and add the guard test. Add an `index.ts` to each feature. Add `.dependency-cruiser.cjs` and check that a deliberate import of one feature's internals from another feature fails it. Move `sniffImage`, `checkCoverUrl` and `downloadCover` to `server/src/features/covers/service.ts` with their tests.
5. **The type provider and schemas, one feature per commit:** health, views (with the output schemas and their encode test first), books, lookup, covers, backup. Each commit declares params, body and response, removes that feature's `.parse(request.…)`, types the plugin as `FastifyPluginAsyncZod<FeatureContext>`, and adds its serializer test.
6. **After.** Save the same JSON again and diff it against step 1's. A field that vanished is a leak (keep it dropped and list it) or a missing schema field (add it). Time `GET /api/books` on the 3,000-book copy before and after. The diff's summary goes in `log.md`.
7. **Strict.** Drop `check-structure`'s `--warn-only`; dependency-cruiser joins `check:conventions`.
8. **Corpus.** In [wiki/decisions.md](../../wiki/decisions.md) add an entry adopting the structure (rejected: the layer split `server/src/routes/` + `server/src/store/`, autoload, TypeBox, and a `lib/`-split of the lookup/CIP helpers if decision 3's default stands), and update the pages above. `bash corpus/lint.sh --index`, then `bash corpus/lint.sh`.

## Acceptance

- [ ] `check-structure` passes strict, with only the two byte routes and any decision-6 exception in `scripts/conventions.json`. Counts before and after are in the outcome note.
- [ ] `grep -rnE "\.(safe)?[pP]arse\(request\." server/src` prints nothing; every route in the table has a `response` except the two byte routes.
- [ ] `grep -rn "process\.env" server/src --include=*.ts | grep -v "\.test\.ts"` prints only `config.ts`.
- [ ] The new unit tests pass (`npx vitest run server/src/plugins server/src/features`), and every existing test passes unchanged. No new test calls `inject()` or boots `buildApp`.
- [ ] The before and after JSON comparison is in `log.md`, with every dropped field named, and `GET /api/books`' time on 3,000 books.
- [ ] `npm run build` writes `server/dist/server.js`; `docker build -f infrastructure/Dockerfile .` succeeds and the container's health check passes; the CIP command in the docs matches the built path; the container command for the CIP refresh is handed to the owner as an exact command.
- [ ] dependency-cruiser fails on a deliberate cross-feature import and passes clean.
- [ ] `npm run check` passes and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 04 (Wishlist, with recommendations) adds `server/src/recommend/` and `server/src/routes/recommendations.ts`, possibly `@huggingface/transformers` (a dependency, the spike decides), and edits `server/src/app.ts`. If it lands first (the plan), this brief moves its files to `server/src/features/recommendations/` and gives its routes schemas, including the import route's body from `shared/`; if second, it is written in that shape from the start. It also appends a migration to `server/src/db/migrations.ts`, which does not move.
- The skills library should hear about the transform trap (confirmed here on a second repo) and the error-body question before the other servers run its brief 16.

## Outcome (2026-11-12)

Built on `main`, one commit per step, by shelfmark-08. [log.md](../../log.md) holds the details; this is the short form.

- **`check-structure`**, strict, one exception (the backup stream, `scripts/conventions.json`). Before: 36 errors and 9 warnings (rule-1 1, rule-3 5, rule-6 30, rule-11 9). After: 0 errors, 9 warnings (rule-11, the web app's files), 1 excepted. The cover `GET` declares its params, so it needs no exception. dependency-cruiser passes; a deliberate `features/books/store.js` import from `features/covers/` fails it (exit 1), and so does a deliberate cycle in `lib/` (the narrowed `no-circular`).
- **Moves.** `server.ts`, `plugins/` (errors with `mapError`, `json-body`, `auth`), `features/<name>/` for health, books, lookup (with `cip/`), covers (with `service.ts`), backup, views and recommendations (brief 04's files, which the move map did not list), `lib/` (`api-error.ts`, `id-params.ts`). Read these two alone: `a08c839` is `git mv` and import paths only (`accounts.ts`, `guard.ts` to `plugins/auth/`); `eee2470` takes `signIn` out of `app.ts` into `plugins/auth/index.ts` under `fastify-plugin` and drops `SESSION_COOKIE`, `PUBLIC_ROUTES` and `AUTH_ROUTE_PREFIX` as exports of `app.ts` (nothing imported them); the body of `signIn` is unchanged, plus an `AuthOptions` type carrying `fetch`. All 13 sign-in replies (wrong password, unknown user, bad body, the session in and out, cross-origin and same-origin login, the password route, logout, the dead cookie) are byte-identical old against new; the vendored library reads neither `request.ip` nor a route schema, so `trustProxy` and the compilers don't touch it.
- **Comparison**, 114 replies through the built app on `inject()` against a scratch database (the demo seed through a shim plus edge rows: ratings 1 and 5, a wishlist book, unicode, a view with an odd stored state, covers, lookups over the recorded fixtures, an import job). **No real database:** the owner's library stays on the VPS, and no Google Books call was made. 92 identical, 10 the same JSON in another key order, 12 different, no field dropped. The 10 are every book reply (`tags` now before the cover's facts and the times: the shared `bookSchema`'s order). Nine of the 12 are a request with no body ("received undefined" is now "received null"); three are validation before the id check (a bad body on a non-numeric id: 400, was 404, on `PATCH /api/books/abc`, `PATCH /api/views/abc`, `POST /api/books/abc/cover/fetch`).
- **`GET /api/books` on 3,000 books**, in-process: 24-25 ms before, 33-39 ms now (2.26 MB).
- **Strict responses.** A stored time that isn't ISO (shown on a scratch row) makes `GET /api/books` answer 500 for the whole library. The app only writes `toISOString()`, so none should exist. `server/scripts/check-stored-replies.ts` checks the real data first (owner step 1).
- **Caught late:** `openlibrary.ts` read `server/package.json` by a path from its own folder and fell back to `0.0.0`; after the move it sent `Shelfmark/0.0.0` to every catalog. Fixed (`bc84017`), with a test that fails on the fallback.
- **Deviations.**
  1. zod 4.5.4 to 4.6.7 in `shared/package.json`, `server/package.json` and the root override (GHSA-mrhx-c7xc-m3w5), against the brief's "no zod move" and its "`shared/` does not change": the shared builder notes name 4.6.7. One copy in the lockfile. The manifest is the only `shared/` file touched, and the zod version reaches the web bundle, which is why the phase is `all`.
  2. `connectionTimeout` is 130 s, not 10 s (`server/src/server.ts`): a lookup is silent for as long as its sources take (up to 40 s on a miss, longer behind a batch), and Node cuts a silent socket (shown at 1 s on a 2.5 s route). It sits above `keepAliveTimeout` (125 s). `requestTimeout` 30 s (the whole request must arrive; a response can run longer, so the backup is not capped) and `trustProxy` as the brief says.
  3. Book replies come out with `tags` before `hasCover`, `coverUpdatedAt` and the times (the shared schema's order; the store's `toBook` order no longer matters).
  4. The cover `PUT`'s 415 is declared (`features/covers/schemas.ts`, the generic `{ error: { code, message } }`), because `reply.code(415)` doesn't type-check on an undeclared status. It encodes every 415, Fastify's own included, which the error plugin gives that same body.
  5. `no-circular` is an error for the server and shared and a warning for `web/` only (`no-circular-web`): the web app's two add-flow cycles are outside this brief, and `web/` is not touched. The brief wanted the lowering dropped entirely.
  6. `features/lookup/index.ts` exports more than the brief lists (the helpers `array`, `record`, `text`, `texts`, `yearOf`, `getJson`, `languageOf`, the origins and timeouts, `createQueue`, `Clock`, `Queue`, `OPEN_LIBRARY_SPACING_MS`), because the recommendations feature, which the brief predates, builds on them.
  7. `mapError` uses `instanceof ResponseSerializationError`, not the provider's `isResponseSerializationError` (true for any object with a `method`), and the 500 log carries the error's name and code, the method and the URL, never the zod issues (they would quote a book's fields).
  8. Stale path comments remain in `web/vite.config.ts`, `web/src/api.ts`, `web/src/ocr/block.test.ts`, `web/src/wishlist/WishlistPage.tsx` and `shared/src/cip.ts` (`web/` and `shared/` are not mine to edit).
  9. New scripts: `server/scripts/check-stored-replies.ts`; new test helper `server/src/testing/serialize.ts`.
- **Tests.** 872 pass (823 before); the new ones never call `inject()`: `mapError` (7 cases), each response schema through `serializerCompiler` (health, views with the encode trap, books, lookup, covers, recommendations), the cover guard and download with `fakeFetch` (`service.test.ts`), the fixture-path guard, the `APP_VERSION` guard, `resolveDataDir` and `loadSeedConfig`.
- **Not run.** `docker build` (local Docker gives an I/O error); the built `server/dist/server.js` ran on a real socket instead, from a scratch folder, every setting pinned (`config.ts` loads the repo's `.env` by a fixed path, and a pinned key wins): health 200, signed out 401, sign-in then books, views and a backup download 200, a bad body 400, SIGTERM exit 0 from the node PID in 0.02 s. The `npm ci --omit=dev` closure was read from the lockfile (the provider, its peers, `fastify-plugin` and `close-with-grace` are not dev). A lookup still in flight at SIGTERM will run `close-with-grace`'s 10 s out and exit 1; the check was idle.
- **Deploy: `all`.** `server` rebuilds the container (the entry file and the `CMD` changed); `deploy` ships the web client, whose bundle carries the new zod.
- **Open for the owner:** decision 3 (lookup and the CIP index as one feature; the default is built) and decision 8 (the timeouts, including the 130 s, and `trustProxy`: loopback plus `AUTH_TRUSTED_PROXIES`).
- **Owner steps, in order.** (1) Before the deploy, download a backup (account menu, Download a backup) and run `npx tsx server/scripts/check-stored-replies.ts <the backup file>` from a checkout: any row it prints would answer 500, so fix those first. (2) `node cli.ts shelfmark all` from the vps-deploy checkout. (3) The container turns healthy (the `CMD` changed) and `docker stop` ends at once. (4) The CIP refresh by hand: `docker compose -f infrastructure/docker-compose.yml exec shelfmark-api node server/dist/features/lookup/cip/cli.js refresh`.
