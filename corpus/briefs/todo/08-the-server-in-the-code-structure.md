# Task 08: The server in the house code structure

**Depends on:**

- In Shelfmark: brief 05, for the gate, the `no-process-env` rule (from `eslint-plugin-n`) (a warning until this brief) and `.claude/rules/server.md`.
- In the owner's skills library:
  - brief 03, *A code-structure skill for the Fastify + React apps*: rules 1-11, the references, `check-structure.mjs`, the dependency-cruiser and knip presets;
  - brief 16, *The Fastify servers adopt the code structure*: Shelfmark's row and the method;
  - brief 15: `check-structure` runs `--warn-only` until this brief is done.
- The owner's grilling of 2026-11-10: Q1 (how vps-deploy starts the service), Q23 (`server/src/`), Q24 (plugin options, explicit registration), Q25 (response schemas), Q26 (Shelfmark's "nothing boots the app" against `inject()`), Q27 (the test runner), and the new questions in decisions 3 and 4.

**Order:** after 05. It touches no file that 06 or 07 touch except `package-lock.json`, so run it before or after them, never at the same time.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner asked on 2026-11-09 for one researched code structure in every repo. Shelfmark's server already has the shape Almanac took from it: `buildApp(config, options)` never listens (`server/src/app.ts:125`), `loadConfig()` parses the environment once with zod (`server/src/config.ts:124`), features get a typed `FeatureContext` and register by name (`app.ts:18, 102`), and one error handler sends `{ error: { code, message } }` (`server/src/errors.ts:74`).

What is missing: the `server.ts` name, five stray readers of the environment, feature folders, route schemas (response schemas above all), `fastify-plugin` on the cross-cutting plugins, `close-with-grace`, timeouts. And one thing Almanac has that Shelfmark deliberately does not: **no test boots the app** ([wiki/decisions.md](../../wiki/decisions.md), "Only lightweight tests"; the route tests and `testApp.ts` were deleted on 2026-10-24). That shapes what "tested" can mean here (decision 4).

### The versions (verified 2026-11-10)

- **zod 4.5.4** in `shared`, `server` and the root `overrides`; one copy in `package-lock.json`. `@fastify/type-provider-zod` 1.0.3 needs `>=4.2.0`: **no zod move**.
- **fastify 5.12.7** (`server/package.json`); the provider needs `^5.5.0`.
- The provider declares `@fastify/swagger` and `openapi-types` as required peers; npm installs them (type-only weight). Pin both. `fastify-plugin` and `close-with-grace` are the other new dependencies, and all of them go in `dependencies`, not dev: the image's `proddeps` stage runs `npm ci --omit=dev -w @shelfmark/server`.
- **The Docker image has no `git`** (`infrastructure/Dockerfile`, `deps` stage). Every new dependency is an npm registry package, so this does not bite here; a `github:` dependency (brief 05, decision 1) would.

### A trap in the shared schemas (found 2026-11-10)

The provider's serializer calls zod's encode, and **zod throws when encoding through a `.transform()`**. Run against zod 4.5.4 and provider 1.0.3 on Shelfmark's own `shared/src` (a scratch copy):

- `savedViewListSchema` and `savedViewSchema` throw `Encountered unidirectional transform during encode: ZodTransform`.
- The cause is `state: z.unknown().transform(readSavedViewState)` at `shared/src/views.ts:174`. The same schema with `state: savedViewStateSchema` encodes fine.
- So `GET /api/views`, `POST /api/views` and `PATCH /api/views/:id` would each answer 500 once their response schemas are declared.

The web needs the lenient `savedViewSchema` (`web/src/library/savedViewsStore.ts:2-3, 34-36` parse answers with it). The server's store already applies `readSavedViewState` on the way out (`server/src/store/views.ts:56`). So: add a transform-free `savedViewOutputSchema` to `shared/src/views.ts` (`state: savedViewStateSchema`) for the server's `response`, and leave `savedViewSchema` for the web. The other `.transform()` and `preprocess` calls (`book.ts:116, 125, 211, 230`, `views.ts:168`) are in input schemas, which are decoded, and decoding is fine. `bookSchema`, `bookListSchema`, `bookBulkResultSchema`, `lookupResponseSchema` and `coverInfoSchema` have none.

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

**Feature boundaries after the move** (rule 5: only through `index.ts`): `covers` and `lookup` use `books` through `server/src/features/books/index.ts` (the `books` store is also in `FeatureContext`); `covers` uses `server/src/lookup/index.ts`. `lookup` ↔ CIP is one feature because today they import each other: `server/src/cip/issues.ts:1-3` and `server/src/cip/refresh.ts:5-6` import `server/src/lookup/merge`, `server/src/lookup/openlibrary` and `server/src/lookup/queue`, and `server/src/lookup/cip.ts:1` imports `server/src/cip/store`.

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
| health | `GET /api/health` (`app.ts:151`) | | | `200`: **new** `healthSchema` (`{ ok: true }`) |
| books | `GET /api/books` (`books.ts:32`) | | | `bookListSchema` |
| | `GET /api/books/:id` (34) | **new** `idParamsSchema` | | `bookSchema` |
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

**Q25's answer from the code:** no route sends pass-through JSON, but two send bytes (the cover image and the backup), which cannot have a JSON `response`. They are the only exceptions, recorded in `scripts/conventions.json`. The `PUT` cover route has no body schema because its body is raw bytes, parsed by a plugin-scoped `*` content-type parser (`covers.ts:181-185`).

**`idParamsSchema` stays a plain `{ id: string }`.** `bookId()`, `viewId()` (a regex, `^[1-9]\d{0,15}$`) answer a non-numeric id with 404 `not_found`; a regex in the schema would make it a 400.

**Hand parsing removed:** 7 `.parse(request.body)` calls in 4 files: `books.ts:41, 47, 55`, `views.ts:35, 47`, `lookup.ts:39`, `covers.ts:217`. (`config.ts`'s `safeParse` reads the environment, not a request.)

### The error plugin

`server/src/plugins/errors.ts`, wrapped in `fastify-plugin`, registered first. It **keeps Shelfmark's body, `{ error: { code, message } }`**, which `web/src/api.ts:164-178` parses. In order:

1. `ApiError` → its code.
2. `hasZodFastifySchemaValidationErrors(error)` → 400 `validation`. The message is the first issue's path and message, as `describeIssue` builds today (`errors.ts:50`): `body.isbn13: must be 13 digits…`, `/` giving the message alone.
3. A `z.core.$ZodError` → 400 `validation`, for any parse left in a service (`errors.ts:78`).
4. `isResponseSerializationError(error)` → 500 `internal`, logged with the method and URL, never shown.
5. A 4xx Fastify raised → its status, `not_found` for 404, else `validation` (`errors.ts:80-84`).
6. Anything else → 500 `internal`, logged.

Keep the mapping as an exported pure function, `mapError(error)`, so it is unit-tested without Fastify. The 404 handler stays, and the 415 the cover `PUT` builds by hand (`covers.ts:~206`, code `validation`) stays too. `@fastify/rate-limit` is not a dependency, so the 404 handler is not rate-limited.

### The `server.ts` / `app.ts` split

`server.ts`:

1. `loadEnvFile()` and `loadConfig()`; a `ConfigError` goes to stderr and exits 1, before any logger exists.
2. `buildApp(config, { logger: true, server: { connectionTimeout, requestTimeout, keepAliveTimeout, trustProxy } })`; `BuildAppOptions` gains `server`.
3. The weekly CIP job (`index.ts:35-49`), as `startCip(app, config)` exported by `server/src/lookup/index.ts`.
4. `close-with-grace`, replacing the two signal handlers (`index.ts:51-62`).
5. `listen({ host, port })`.

`app.ts` registers in a fixed order: errors plugin, JSON body plugin, the provider's compilers, `server/src/plugins/auth` (still before anything with routes), then `FEATURES`: health, books, lookup, covers, backup, views.

**Renaming the entry moves the built file** from `server/dist/index.js` to `server/dist/server.js`. It is named in: `infrastructure/Dockerfile:112` (`CMD`), the root `package.json:19` (`start`), and `server/package.json`: `main` (7), `dev` (`tsx watch src/index.ts`), `start` (11), and `exports` (24-37). The `exports` map has no importer and its `./testing` entry points at a deleted file, so **drop it and `main`**. vps-deploy builds this image and likely runs its `CMD`, but its Shelfmark stack may name the file; that is Q1 and was not readable here.

**Moving the CIP CLI moves its documented command.** `node server/dist/cip/cli.js refresh` ([docs/owner-setup.md](../../../docs/owner-setup.md):208, [wiki/metadata-lookup.md](../../wiki/metadata-lookup.md):199) becomes `node server/dist/features/lookup/cip/cli.js refresh`, and `npx tsx server/src/cip/cli.ts` ([docs/getting-started.md](../../../docs/getting-started.md):125) likewise. Update those pages, and hand the owner the container command.

### Test impact

- 21 test files (the whole suite is 63 files, 743 tests, 5.5 s on 2026-11-10); no route test exists.
- Moved tests need their relative imports updated, `../db/open.js` and `../testing/…` first.
- No existing assertion changes.
- **New tests, none of which boots the app (decision 4):**
  - `shared/src/views.test.ts`: `z.encode(savedViewSchema, view)` throws the unidirectional-transform error, and `z.encode(savedViewOutputSchema, view)` passes (the trap, written down).
  - For each response schema, `serializerCompiler` over a store row: an extra field is stripped, and a row with a bad value is a `ResponseSerializationError`.
  - `mapError` for each of the six cases.
  - `server/src/`: `checkCoverUrl`'s host allowlist and redirects, `sniffImage`, `downloadCover` with `fakeFetch`. Today these have **no tests at all** (knip lists `sniffImage`, `COVER_HOSTS`, `checkCoverUrl`, `downloadCover` as exports nothing imports, and the fakes `redirect`, `image`, `RECORDED_COVER` in `fakeFetch.ts:30, 46, 87` serve no test), left over from the deleted route tests.
  - The `hasFixture` guard.

## Owner decisions (defaults this brief builds)

1. **`server/src/features/<name>/`** (Q23). Default: yes, as in the move map.
2. **Typed plugin options, explicit registration** (Q24). Default: keep `FeatureContext` and `FEATURES`. Decorators only for request-scoped values; there are none. `FeatureContext.cip` is used by one feature and the entry; leave it, since the store is closed with the app.
3. **Lookup and CIP as one feature.** Default: yes, `server/src/cip/` becomes a private subfolder of `server/src/`, because the two import each other today. The alternative keeps two features and moves `queue.ts`, `getJson`, `USER_AGENT` and the `record`/`array` helpers to `lib/`. Either moves the documented CIP command. *New question for the grilling.*
4. **Tests without booting the app** (Q26). Default: keep "Only lightweight tests". Response schemas, the error mapping and the cover service are tested as units (above), and the before/after JSON comparison is a manual script, not a test. The alternative is to revisit that entry and allow `inject()` against one route plugin with an in-memory database, which would also test the type-provider wiring end to end.
5. **The error body** (rule 8's shape). Default: keep `{ error: { code, message } }`; the substance (one handler, no 5xx detail, a `validation` code) holds. Same question as Almanac's; one answer for both.
6. **The entry file** (Q1). Default: rename to `server.ts`, change the Dockerfile, scripts and `exports` in one commit. If vps-deploy's Shelfmark stack names `dist/index.js`, hand the owner the exact edit in the same session, or keep `index.ts` and record the exception.
7. **Test runner** (Q27). Default: vitest stays.
8. **Timeouts and proxy.** Defaults: `connectionTimeout: 10_000`; `requestTimeout: 30_000` (the cover download allows 10 s, `covers.ts:53`; the backup streams the database and is the longest, so measure it on a copy first and raise this if it needs more); `keepAliveTimeout: 125_000`, above Caddy's two-minute upstream idle default (check the deploy's Caddy snippet, which was not readable here); `trustProxy`: loopback plus `AUTH_TRUSTED_PROXIES`, one list. Ward's lockout reads its own list (`config.trustedProxies`), unchanged.
9. **Logging.** Default: JSON as today, no `pino-pretty`.
10. **Fastify 5.12.8.** Default: not in this brief.

## Files you OWN

- `server/src/**` and `server/scripts/**` (import paths only).
- `server/package.json` (scripts, new pinned dependencies, `main` and `exports` dropped) and `package-lock.json`.
- `shared/src/views.ts`, `shared/src/index.ts` and tests, only to add `healthSchema`, `idParamsSchema`, `savedViewOutputSchema` and `savedViewListOutputSchema`. Input schemas do not change.
- `infrastructure/Dockerfile` (the `CMD` line), the root `package.json` (`start`, `check:conventions`).
- `.dependency-cruiser.cjs` (new), `eslint.config.js` (`no-process-env` to error), `knip.json` (entries), `scripts/conventions.json`, `.claude/rules/server.md`.
- Docs: [docs/architecture.md](../../../docs/architecture.md):87-88, [docs/getting-started.md](../../../docs/getting-started.md):125, [docs/owner-setup.md](../../../docs/owner-setup.md):208.
- Corpus: [wiki/metadata-lookup.md](../../wiki/metadata-lookup.md) (its links to `server/src/routes/lookup.ts`, `server/src/lookup/*`, `server/src/routes/covers.ts`, `server/src/cip/*`, lines 117-197, break the corpus linter when files move), [wiki/data-model.md](../../wiki/data-model.md):13, 67, [wiki/architecture.md](../../wiki/architecture.md), [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `web/`. A response schema that drops a field the web reads is a finding: fix the schema.
- Input schemas in `shared/`, `server/vendor/`, `server/src/**/fixtures/` contents.
- The deploy beyond the `CMD` line; vps-deploy edits are handed to the owner.
- Behaviour: status codes, error codes and messages, and every route's JSON apart from fields the comparison shows were leaks.

## What to do

One commit per step; `npm run check` and `npm run build` pass after each, and `npm start` answers `GET /api/health`.

1. **Before.** Run `check-structure` strict and record counts by rule. Seed a scratch `DATA_DIR` from a copy of the owner's database (the backup download) plus `docs/images/demo-seed.mjs`. Save the JSON of every JSON route above, signed in as the demo user, as `server/scripts`-style throwaway output outside git. Include a view, a book with a cover, a wishlist book and a lookup of a seeded ISBN. Save the two byte routes' headers and sizes.
2. **`config.ts` and the split.** Add `loadEnvFile()`, `resolveDataDir()`, `loadSeedConfig()`; `seed.ts` and `server/src/cip/cli.ts` use them. `index.ts` becomes `server.ts`, with `close-with-grace`, timeouts, `trustProxy` and the entry-file changes. the `no-process-env` rule (from `eslint-plugin-n`) now finds nothing in `server/src`; make it an error.
3. **The error plugin, `server/src/lib/api-error.ts`, `server/src/plugins/json-body.ts`, `server/src/plugins/auth/`.** Add `mapError` and its test. Behaviour is unchanged.
4. **Feature folders**, `git mv` file by file per the map, so history follows. Fix the two fixture paths and add the guard test. Add `server/src/`. Add `.dependency-cruiser.cjs` and check that a deliberate import of `server/src/` from `server/src/` fails it. Move `sniffImage`, `checkCoverUrl` and `downloadCover` to `server/src/covers/service.ts` with their tests.
5. **The type provider and schemas, one feature per commit:** health, views (with the output schemas and the shared test first), books, lookup, covers, backup. Each commit declares params, body and response, removes that feature's `.parse(request.…)`, types the plugin as `FastifyPluginAsyncZod<FeatureContext>`, and adds its serializer test.
6. **After.** Save the same JSON again and diff it against step 1's. A field that vanished is a leak (keep it dropped and list it) or a missing schema field (add it). Time `GET /api/books` on the 3,000-book copy before and after. The diff's summary goes in `log.md`.
7. **Strict.** Drop `check-structure`'s `--warn-only`; dependency-cruiser joins `check:conventions`.
8. **Corpus.** In [wiki/decisions.md](../../wiki/decisions.md) add an entry adopting the structure (rejected: the layer split `server/src/routes/` + `server/src/store/`, autoload, TypeBox, and a `lib/`-split of the lookup/CIP helpers if decision 3's default stands), and update the pages above. `bash corpus/lint.sh --index`, then `bash corpus/lint.sh`.

## Acceptance

- [ ] `check-structure` passes strict, with only the two byte routes and any decision-6 exception in `scripts/conventions.json`. Counts before and after are in the outcome note.
- [ ] `grep -rnE "\.(safe)?[pP]arse\(request\." server/src` prints nothing; every route in the table has a `response` except the two byte routes.
- [ ] `grep -rn "process\.env" server/src --include=*.ts | grep -v "\.test\.ts"` prints only `config.ts`.
- [ ] The new unit tests pass (`npx vitest run shared/src/views.test.ts server/src/plugins server/src/features`), and every existing test passes unchanged. No new test calls `inject()` or boots `buildApp`.
- [ ] The before and after JSON comparison is in `log.md`, with every dropped field named, and `GET /api/books`' time on 3,000 books.
- [ ] `npm run build` writes `server/dist/server.js`; `docker build -f infrastructure/Dockerfile .` succeeds and the container's health check passes; the CIP command in the docs matches the built path; the vps-deploy step, if any, is handed over as exact commands.
- [ ] dependency-cruiser fails on a deliberate cross-feature import and passes clean.
- [ ] `npm run check` passes and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 04 (recommendations) adds `server/src/recommend/` and `server/src/routes/recommendations.ts`. If it lands second it is written as `server/src/` with schemas; if first, this brief moves it. It also appends a migration to `server/src/db/migrations.ts`, which does not move.
- The skills library should hear about the transform trap (confirmed here on a second repo) and the error-body question before the other servers run its brief 16.
