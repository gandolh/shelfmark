# Task 05: The house style and the quality harness

**Depends on:**

- In Shelfmark: nothing. This brief runs first.
- In the owner's skills library:
  - brief 27, *A house style, and a quality harness that enforces it*: the `house-style` package at `v1.0.0` (vendored into each repo, see decision 1), the `house-style` skill, the plugin's `Stop` and `PostToolUse` hooks;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: how the two convention checkers are wired, and when they run `--warn-only`.
- The owner's grilling of 2026-11-10: the technical calls Q6-Q14, Q45-Q48 and Q51 (all decided below).

**Runs before:** 04, 06, 07 and 08. The reformat at width 120 touches 140 files (about 628 lines), and those briefs rewrite or move most of them. Format first, once.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

On 2026-11-09 the owner decided, for every web app: Base UI 1.9.0, Tailwind v4 for the whole app, and the researched conventions enforced in each repo. Brief 27 of the skills library answers "enforced" with a two-layer harness: the repo's own gate (`npm run check`, and `npm run check:fast`), and a Claude Code layer (the plugin's `Stop` hook runs `check:fast` and exits 2 on a failure, its `PostToolUse` hook formats the saved file, `.claude/rules/` scoped by `paths:`, a short root `CLAUDE.md`). This brief adopts both in Shelfmark.

### What Shelfmark has today (read 2026-11-10)

- **`tsconfig.base.json`** (22 lines): `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `isolatedModules`, `NodeNext`. `web/tsconfig.json` overrides to `ESNext`/`bundler`, `types: ["vite/client"]`, `noEmit`.
- **`eslint.config.js`** (22 lines): `@eslint/js` recommended, `typescript-eslint` recommended (untyped, 8.69.0), `react-hooks` 7.1.1 recommended on `web/src`, `_`-prefixed unused names. It reports 0 errors and 0 warnings today (`npx eslint .`, measured below).
- **No formatter**, no Prettier config, no `format` script.
- **Scripts** (`package.json:15-21`): `typecheck` is `tsc -b && tsc -p web --noEmit`, two runs, the web one not incremental; `lint` is `eslint .`; `test` is `vitest run` with **no `pretest`**; no `check`.
- **`npm test` fails on a fresh checkout.** `@shelfmark/shared` resolves to `shared/dist` (`shared/package.json` `main`), which only `tsc -b` writes. With `shared/dist` and `server/dist` deleted, `npx vitest run` gave 36 of 63 files failed (measured 2026-11-10). It fails loudly, so it is not a silent gate, but `check` must put `typecheck` before `test`, and a `pretest` fixes the rest.
- **No root `CLAUDE.md` and no `.claude/`.** The only `CLAUDE.md` is [corpus/CLAUDE.md](../../CLAUDE.md), loaded once an agent reads under `corpus/`. Its Hard rules (no secrets, no CI, no pushes, deploys are owner steps) and its brief-board section apply everywhere.
- **`.npmrc`** has `save-exact=true`.
- **The Docker image** (`infrastructure/Dockerfile`): the `deps` stage runs a full `npm ci` (dev dependencies included) in `node:24-alpine` with `apk add python3 make g++` and **no `git`**, and `npx tsc -b server` runs there.

### Measured on 2026-11-10

On a scratch copy (`git ls-files` copied outside the repo, then `npm ci --ignore-scripts`; `better-sqlite3` rebuilt for the test run). Node 22.23.4 (the repo asks for 24, so npm printed `EBADENGINE`; nothing below depends on it), Prettier 3.8.1, TypeScript 6.0.3, ESLint 10.9.1, typescript-eslint 8.69.0, `eslint-plugin-n` 18.5.0, `@vitest/eslint-plugin` 1.6.28, `eslint-plugin-import-x` 4.18.1, knip 6.44.2.

**Baseline.** `npx tsc -b` 6.0 s and `npx tsc -p web --noEmit` 8.3 s, both clean. `npx eslint .` 12.2 s, 0 findings. `npx vitest run`: 63 files, 743 tests, 5.5 s.

**Prettier churn** (measured 2026-11-10 at several widths; the owner's estate width is 120, Q8 and Q51). `prettier --print-width <N> --trailing-comma all --write` over the 235 TypeScript and JavaScript files outside `vendor/` (32,068 lines), counting old lines changed with `diff old new | grep -c '^<'`:

| `printWidth` | Lines changed | Files changed |
|---|---|---|
| 100 | 1,540 | 194 |
| 110 | 997 | 175 |
| **120 (chosen)** | **628 (2.0%)** | **140** |
| 130 | 391 (1.2%) | 98 |
| 135 | 474 | 97 |
| 140 | 588 | 94 |
| 150 | 868 | 115 |

Shelfmark's least churn is 130, but the estate takes one width, 120 (Q8 and Q51), so **the one-off cost is 628 lines in 140 files, 237 lines and 42 files more than at 130.** The other file types, measured at 130 and re-measured at 120 on a scratch copy:

- **CSS:** 29 lines, all in `web/src/styles/tokens.css` (hex colours lowercased), the same at 120.
- **JSON:** at 130, 147 lines in 13 files, **all recorded fixtures** under `server/src/**/fixtures/`. Those must stay byte-for-byte at any width; they go in `.prettierignore`.
- **HTML:** 0.
- **Markdown:** 271 lines in 23 files at 120. Markdown stays out of Prettier (Q45).

**TypeScript flags** (added to `tsconfig.base.json` one at a time, then run `npx tsc -b` and `npx tsc -p web --noEmit`):

| Flags | server + shared errors | web errors |
|---|---|---|
| `verbatimModuleSyntax` | 0 | 0 |
| `erasableSyntaxOnly` | 2: `server/src/errors.ts:32` (`ApiError`'s `readonly code`), `server/src/store/views.ts:26` (`ViewNameTaken`'s `readonly viewName`) | 0 |
| both together | 2 (the same) | 0 |
| `exactOptionalPropertyTypes` | 0 | 63 |

**House shapes**, counted with a TypeScript-parser walk over the 235 files:

| Shape | Count | Where |
|---|---|---|
| `enum`, `any`, namespaces | 0 | |
| `@ts-ignore` / `@ts-expect-error` / `TODO` / `FIXME` | 0 | |
| non-null `!` | **123** in 32 files | 43 in 16 source files (`server/src/cip/parse.ts` 8, `shared/src/cip.ts` 7, `server/src/lookup/z3950/ber.ts` 6, `web/src/ocr/block.ts` 4, the rest 1-3); 80 in 16 test files (`protocol.test.ts` 25, `selection.test.ts` 18, `queue.test.ts` 9, `unimarc.test.ts` 9) |
| `console` | 20 | the CLIs and scripts (`server/src/index.ts:23`, `server/src/seed.ts:71, 79`, `server/src/cip/cli.ts:24, 40, 52`, `server/scripts/*`, `docs/images/demo-seed.mjs`, `web/src/ocr/fixtures/record.ts:25`), plus `web/src/library/view.test.ts:120` |
| default exports | 5 | four configs (`eslint.config.js:5`, `vitest.config.ts:5`, `web/pwa-assets.config.ts:8`, `web/vite.config.ts:140`) and `web/src/scanner/ScannerDemo.tsx:150`, which `AppShell.tsx:38` loads with `lazy(import())` |
| parameter properties | 2 | the two `erasableSyntaxOnly` errors |
| `void` on a discarded promise | 54 | |
| `process.env` | 10 | `server/src/config.ts:124` (the default parameter, sanctioned); 5 more in `server/src` (`index.ts:20`, `cip/cli.ts:36`, `seed.ts:59, 60, 66`); `server/scripts/measure-lookup.ts:47`; `docs/images/demo-seed.mjs:20`; `web/vite.config.ts:142, 147` |

**Typed lint and the house rules**, in a scratch `eslint.config.js` with the six typed rules (`projectService`, `allowDefaultProject` for `vitest.config.ts`, `eslint.config.js`, `server/scripts/*.ts`, `web/pwa-assets.config.ts`), `no-non-null-assertion`, an `enum` ban, `no-warning-comments`, `no-console` outside the CLIs, the `no-default-export` rule (from `eslint-plugin-import-x`) outside configs, the `no-process-env` rule (from `eslint-plugin-n`) as a warning, `@vitest/eslint-plugin` recommended. `npx eslint . -c <scratch> --format json`:

| Rule | Findings |
|---|---|
| `@typescript-eslint/no-non-null-assertion` | 123 |
| `no-unnecessary-type-assertion` | 9: `server/src/lookup/openlibrary.ts:77, 122`, `server/src/store/books.ts:164`, `web/src/api.ts:174`, `web/src/book/patch.ts:122` (twice), `web/src/library/BookTable.tsx:243`, `web/src/add/flow.test.ts:694`, `web/src/books/store.test.ts:447` |
| `switch-exhaustiveness-check` | 7 at first: `web/src/add/flow.ts:210`, `web/src/add/words.ts:297`, `web/src/auth/messages.ts:29, 45, 63, 77`, `web/src/router.ts:139`. Every one has a `default:`. With `considerDefaultExhaustiveForUnions: true`: **0** |
| `no-misused-promises` | 2: `web/src/import/ImportPage.tsx:323, 389` (`onClick={look}` on an async function) |
| `no-floating-promises` | 1: `server/src/app.ts:146` (`parseJson(request, body, done)`; read it before fixing, it may be Fastify's typing) |
| `await-thenable`, `consistent-type-imports` | 0, 0 |
| the `no-process-env` rule (from `eslint-plugin-n`) | 5 (`index.ts:20`, `cip/cli.ts:36`, `seed.ts:59, 60, 66`): brief 08's |
| the `no-default-export` rule (from `eslint-plugin-import-x`) | 1 outside configs: `ScannerDemo.tsx:150` |
| `no-console` | 1: `web/src/library/view.test.ts:120` |
| `@vitest` rules | 9 at first. `valid-expect` flagged `expect(x, message)` twice (`server/src/db/migrations.test.ts:134`, `web/src/router.test.ts:53`): vitest allows the message, so set `maxArgs: 2`. `expect-expect` flagged `web/src/add/flow.test.ts:209`, which asserts through the `expectStep` helper (`flow.test.ts:113`): set `assertFunctionNames: ["expect", "expectStep"]`. Left after both: `no-conditional-expect` (`web/src/book/patch.test.ts:56`, `web/src/ocr/block.test.ts:29`), `valid-title` (`block.test.ts:26`), `prefer-called-exactly-once-with` (`web/src/scanner/detector.test.ts:305`), and `valid-expect` on `detector.test.ts:225, 235`, which store a `.rejects` promise and `await` it later (false positives) |

**Lint time.** Typed with `projectService`: 24.2 s for `eslint .`. Typed with `project`: 19.5 s, but four files outside any tsconfig could not be parsed (`server/scripts/*.ts`, `vitest.config.ts`, `web/pwa-assets.config.ts`). One file: 5.4 s (server) to 7.6 s (web).

**Files no `tsc` project reaches:** `server/scripts/measure-lookup.ts` and `record-z3950.ts` (`server/tsconfig.json` includes only `src`), `web/pwa-assets.config.ts`, `vitest.config.ts`, `eslint.config.js`, `docs/images/demo-seed.mjs`. Typed lint reaches them only through `allowDefaultProject`.

**`check:fast` budget**, from its parts: `tsc -b` warm 0.3 s, `tsc -p web --noEmit --incremental` second run 4.3 s (first run 7.2 s; without `incremental` 6.1-8.3 s), ESLint on one file 5.4-7.6 s. About 10-12 s, under the 15 s the estate asks.

**knip** with no config: 0 unused dependencies. One unlisted binary, `pdftotext` (`server/src/cip/refresh.ts`; poppler, installed in the image). 12 "unused files": six are entry points knip does not know (`server/src/cip/cli.ts`, `server/scripts/*.ts`, `docs/images/demo-seed.mjs`, `web/src/ocr/fixtures/record.ts`) and six are vendored Ward files. 123 unused exports (73 outside `vendor/`), which the estate treats as warnings.

**Two stale facts found on the way:**

- `server/package.json:29-32` exports `./testing` as `./dist/testing/testApp.js`. That file was deleted on 2026-10-24 ([wiki/decisions.md](../../wiki/decisions.md), "Only lightweight tests"). Nothing imports `@shelfmark/server` by any export (`grep -rn "@shelfmark/server"` finds only `npm -w` commands). Brief 08 drops the map; this brief only records it.
- `server/src/testing/fakeFetch.ts:3-12` still describes `startTestApp`.

## Owner decisions (defaults this brief builds)

1. **Where the configs come from** (decided 2026-11-10, technical call, Q6): `house-style` is **vendored**, not a git, `github:` or tarball dependency. Shelfmark holds a copy with a version header, refreshed by a `house-style:sync` script that finds the `house-style` checkout by name. The Docker `deps` stage has no `git`, and a git dependency would need it in every build; a vendored copy needs nothing. Shelfmark's configs extend the vendored copy, and the Dockerfile is not touched.
2. **Width** (decided 2026-11-10, owner-confirmed estate call, Q8 and Q51): **120**. The one-off reformat is 628 lines in 140 files (table above).
3. **Markdown and fixtures stay out of Prettier** (decided 2026-11-10, technical call, Q45 for Markdown; fixtures are recordings and must stay byte for byte). `.prettierignore` lists `*.md` and `**/fixtures/`.
4. **tsconfig** (decided 2026-11-10, technical call, Q11 and Q50): add `verbatimModuleSyntax` and `erasableSyntaxOnly` now; `exactOptionalPropertyTypes` waits for a count (63 web errors today), in a later brief. `noUncheckedIndexedAccess` is already on. TypeScript is 6.0.3, past the 5.8 floor.
5. **Typed lint** (decided 2026-11-10, technical call, Q12 and Q48): the six rules through `projectService`, with `considerDefaultExhaustiveForUnions: true` on `switch-exhaustiveness-check` (the 7 findings go to 0), and `no-floating-promises` naming `describe`/`it`/`test` in `allowForKnownSafeCalls` only if the repo's tests use `node:test` (they use vitest, so no).
6. **The house shapes** (decided 2026-11-10, technical call, Q13 and Q47): errors, with these departures:
   - **`no-non-null-assertion`: an error in source (fix the 43), a warning in `*.test.ts` (80 left, listed)** (Q47). 123 findings stand; the owner's rule is the warning in tests.
   - **`no-process-env`** is a warning, because its five findings are brief 08's.
   - `console` is allowed in scripts and CLIs; a default export is allowed where a framework needs one, so `ScannerDemo.tsx:150` (a `lazy` import) and the config files get an ESLint override (Q13).
7. **`check:fast`** (decided 2026-11-10, technical call, Q10): typecheck plus ESLint on the changed files, built incrementally; about 11 s warm, under the 15 s target.
8. **The Claude Code layer** (decided 2026-11-10, technical call, Q7): the plugin's `Stop` hook runs `check:fast`, its `PostToolUse` hook formats the saved file.
9. **A root `CLAUDE.md`** (decided 2026-11-10, technical call, Q46): yes, short, with the commands. The Hard rules and brief-board sections move out of [corpus/CLAUDE.md](../../CLAUDE.md).
10. **`pretest`.** Default: add `"pretest": "tsc -b shared"`, as Almanac has.
11. **The deploy** (decided 2026-11-10, fact, Q1): the build runs `npm ci` and `npx tsc -b server`, no tests or lint, and stays as it is. `npm run check` and the `Stop` hook are the gate.

## Files you OWN

- `tsconfig.base.json`, and `web/tsconfig.json` (only to add `incremental` and a `tsBuildInfoFile`).
- `eslint.config.js`.
- New: the Prettier config, `.prettierignore`, `.git-blame-ignore-revs`, `knip.json`.
- The root `package.json` (scripts, devDependencies) and `package-lock.json`.
- The reformat: whitespace-only changes to every file Prettier covers.
- The fixes the new rules ask for: `server/src/errors.ts`, `server/src/store/views.ts`, the 43 source `!`, the 9 type assertions, `ImportPage.tsx:323, 389`, `server/src/app.ts:146`, the four real vitest findings, `view.test.ts:120`.
- New: `.claude/rules/web.md`, `.claude/rules/server.md`, `CLAUDE.md`, `scripts/conventions.json` (if an exception is needed).
- The vendored `house-style` copy and its `house-style:sync` script (root `package.json`).
- [corpus/CLAUDE.md](../../CLAUDE.md): the Hard rules and brief-board sections move out.
- Corpus: [wiki/decisions.md](../../wiki/decisions.md) (a new entry), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md), [.planned-roots](../../.planned-roots) (drop `.claude` and `scripts` once they exist).

## Files you must NOT touch

- `infrastructure/Dockerfile` (decision 1 means nothing in the build changes).
- Behaviour. Apart from the fixes above, every change is formatting or configuration.
- `server/vendor/` and `web/vendor/`: generated Ward copies, ignored by ESLint and Prettier.
- The layout of `server/src` and the CSS (briefs 08 and 07).
- `server/src/**/fixtures/`: recordings.
- The skills library and the `house-style` repo. A rule that seems wrong for Shelfmark is reported back, not patched here.

## What to do

One commit per step, with `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` green after each.

1. **Measure first.** Re-run the measurements above with the pinned tools and put the numbers in the `log.md` entry. Add the `pretest` first, so the test run is honest.
2. **Prettier and the reformat.**
   1. Add `prettier` (pinned) and the config: `printWidth: 120` (decision 2), `trailingComma: "all"`. Vendor `house-style` first (decision 1): copy it with its version header, add `house-style:sync`, and extend the configs from the copy.
   2. Add `.prettierignore`: `*.md`, `**/fixtures/`, `server/vendor/`, `web/vendor/`, `package-lock.json`, `dist/`, `dev-dist/`, `data/`, `coverage/`, `web/public/`, `.impeccable/`.
   3. Add `format` and `format:check`. Commit this alone.
   4. Run `npm run format`; commit only that, as `style: format with Prettier`. Do it when no other brief has uncommitted work, and push it straight to `main` with the rest (no branch).
   5. Put that commit's full hash in `.git-blame-ignore-revs`, in its own commit.
   6. Hand the owner `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
3. **tsconfig.** Add the two flags. Fix `ApiError` and `ViewNameTaken` with a declared field assigned in the constructor (keep `readonly` and behaviour). Add `incremental` to `web/tsconfig.json`. `npx tsc -b server` (the Dockerfile's line) must still build.
4. **ESLint.** Extend the vendored house config with Shelfmark's roots: web is `web/src`, server is `server/src`, the CLIs are `server/src/index.ts` (later `server.ts`), `server/src/seed.ts`, `server/src/cip/cli.ts`, `server/scripts/*`, `docs/images/*.mjs`, `web/src/ocr/fixtures/record.ts`. In effect:

   | Rule | Today | After |
   |---|---|---|
   | the six typed rules | off | error, `projectService` |
   | `no-non-null-assertion` | off | error in source, warn in tests |
   | `enum` ban, `no-warning-comments`, `no-console` outside the CLIs, `no-default-export` outside configs | off | error |
   | the `no-process-env` rule (from `eslint-plugin-n`) on `server/src`, outside `config.ts` and tests | off | warn (brief 08 makes it an error) |
   | `@vitest/eslint-plugin` recommended, `maxArgs: 2`, `assertFunctionNames: ["expect", "expectStep"]` | off | error |
   | `no-explicit-any`, `ban-ts-comment`, `react-hooks` | on | unchanged |
   | `better-tailwindcss` | absent | brief 07 |

   `allowDefaultProject`: `vitest.config.ts`, `eslint.config.js`, `server/scripts/*.ts`, `web/pwa-assets.config.ts`. `web/public/` and `docs/images/*.mjs` take `disableTypeChecked`. Fix each finding in "Files you OWN", or list it, with its reason, in the outcome note.
5. **The gate.** `check` runs `typecheck`, `lint`, `format:check`, `check:conventions`, `test`. `check:conventions` is knip (entries for the CLIs and scripts, `ignoreBinaries: ["pdftotext"]`, exports as warnings, vendor ignored) plus the two checkers from `house-style`. `check-base-ui` runs `--warn-only` until brief 07, `check-structure` until brief 08. `check:fast` runs `typecheck`, then ESLint on files changed against `HEAD` plus untracked ones. No shell-only syntax (the owner works under WSL). Time both and record.
6. **`.claude/rules/`**, each under about 40 lines.
   - `web.md` (`paths: ["web/src/**"]`): read [DESIGN.md](../../../DESIGN.md) and [wiki/overlays.md](../../wiki/overlays.md); Base UI only through `ui/` wrappers; native checkboxes, radios and selects stay native ([wiki/decisions.md](../../wiki/decisions.md)); light only until brief 07 adds the Light / Dark / System switch (Q18); calls go through `web/src/api.ts` with the shared schemas; the glossary's words in UI copy; English only.
   - `server.md` (`paths: ["server/src/**", "shared/src/**"]`): `FeatureContext` fields only when two features need them; the sign-in feature registers first; errors are `ApiError` with the body `{ error: { code, message } }` that `web/src/api.ts:164` parses; every outbound request goes through `ctx.fetch` or `ctx.connect`; the catalogs are asked politely (`server/src/lookup/queue.ts`); no test boots the app; `server/vendor/` is generated.
   - Briefs 07 and 08 add their lines.
7. **`CLAUDE.md`** at the root, under about 60 lines: one line on Shelfmark; read [corpus/index.md](../../index.md) first; `npm run dev`, `npm run dev:https`, `npm run check` before every hand-back, `npm run check:fast`, one test with `npx vitest run <file>`, `npm run seed -w @shelfmark/server`; what misleads (the typecheck is two runs, `shared/dist` must exist before tests, `.env` sits at the repo root, the dev API is on 8808 and Vite on 5176, production on 8796); the moved Hard rules and brief-board sections. [corpus/CLAUDE.md](../../CLAUDE.md) keeps the rest.
8. **Corpus.** The [wiki/decisions.md](../../wiki/decisions.md) entry "The house style, formatted and checked" (width, config source, what was rejected and why); [wiki/status.md](../../wiki/status.md); [log.md](../../log.md); `.planned-roots`; `bash corpus/lint.sh` clean.

## Acceptance

- [ ] `npm run check` passes. Its time and `check:fast`'s (warm, one changed file) are in the outcome note, and `check:fast` is under about 15 s or the owner accepted the time.
- [ ] `npx prettier --check .` passes at width 120, and the vendored `house-style` copy carries its version header and `house-style:sync` runs. `git diff -w <hash>^ <hash>` shows nothing for the reformat commit, `git diff <hash>^ <hash> -- '**/fixtures/**'` shows nothing, and the hash is in `.git-blame-ignore-revs`.
- [ ] `tsconfig.base.json` has both flags; `npm run typecheck` and `docker build -f infrastructure/Dockerfile .` pass, with the Dockerfile unchanged.
- [ ] ESLint reports 0 errors. Counts before and after, and every finding left, are in the outcome note.
- [ ] A deliberate `enum`, `!` in `server/src/app.ts`, `console.log` in `web/src/api.ts`, `// TODO` and an `export default` in a component each fail `npm run lint`. Revert them.
- [ ] On a fresh clone (`rm -rf shared/dist server/dist`), `npm test` passes without a manual build.
- [ ] `.claude/rules/web.md` and `server.md` exist with `paths:`; the root `CLAUDE.md` is under about 60 lines and lists `npm run check`.
- [ ] `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 04 (Wishlist, with recommendations) adds files. If it lands first, the reformat covers them; if second, it is written formatted at 120.
- Brief 06 adds nothing to the gate. Brief 07 adds `better-tailwindcss` and drops `check-base-ui`'s `--warn-only`. Brief 08 adds dependency-cruiser, drops `check-structure`'s `--warn-only`, makes `no-process-env` an error and the `exports` map goes.
- The reformat lowercases `web/src/styles/tokens.css`'s hex, which brief 07 deletes anyway. `web/src/components/cover.test.ts:11` reads those lines with a case-insensitive regex, so it still passes.
