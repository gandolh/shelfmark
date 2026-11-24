# Task 18: The one-pass check runner and the ESLint scripts option

**Depends on:** nothing. **Runs after:** 17 (so the Dockerfile brief's own check run is still the old chain).
**Builder:** Sonnet.
**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Promoted 2026-11-25 from the todo `todos/the-one-pass-check-runner.md`.

## Context

On 2026-11-23 the estate's other app repos got `scripts/check.mjs` as the runner behind `npm run check`: every step
runs even after one fails, one line per step with its time, the tail of each failure, and the whole output in
`node_modules/.cache/check/last.log`. Prettier's check got its own cache location (a Prettier run without `--cache`,
such as the format-on-save hook, deletes the default one) and `depcruise` got `--cache`. Shelfmark was mid-brief then
and was left out. Today its `check` is `npm run typecheck && npm run lint && npm run format:check && npm run
check:conventions && npm test`, so the first red step hides the rest.

The model is the estate's other copy, for example `scripts/check.mjs` in `lantern` or `almanac` (the same file in
both). Lantern's commit "build: npm run check runs every step and keeps its log; Prettier and dependency-cruiser
caches" is the whole change, and Lantern's `CLAUDE.md` has the paragraph to copy. The skills library's check-speed
page of 2026-11-23 has the reasoning.

The runner prints, so `scripts/` must be in the house ESLint `scripts` option in `eslint.config.js` (today:
`["server/scripts", "docs/images", "web/src/ocr/fixtures"]`). `scripts/check-fast.mjs` already exists and stays.

## Decisions

- Copy `check.mjs` from `lantern` unchanged (the two copies are byte-identical; keep it that way so a later sweep can
  diff them). Do not restructure it.
- Step order stays as today: `typecheck lint format:check check:conventions test`.
- Shelfmark's `typecheck` is two runs (`tsc -b`, `tsc -p web --noEmit`) and `pretest` builds `shared/dist`; the
  runner calls `npm run <step>`, so both still happen. Don't change them.

## Files you OWN

- `scripts/check.mjs` (new), `package.json` (`check`, `format:check` only), `eslint.config.js` (the `scripts` option),
  `knip.config.js` if knip reports the new file, the "Commands" bullet for `npm run check` in the root `CLAUDE.md`.
- Closeout: outcome note, `corpus/log.md`, `corpus/wiki/status.md`.

## Files you must NOT touch

- `scripts/check-fast.mjs`, `vendor/`, `infrastructure/`, any lockfile, `.github/` (none; never add CI).

## Steps

1. Copy `scripts/check.mjs` from `lantern`. Set `check` to `node scripts/check.mjs typecheck lint format:check
   check:conventions test`, and `format:check` to `prettier --check . --cache --cache-location
   node_modules/.cache/prettier-check/.prettier-cache`.
2. Add `depcruise ... --cache node_modules/.cache/dependency-cruiser` to `check:conventions` as Lantern has it.
3. Add `scripts` to the `scripts` array in `eslint.config.js`.
4. Replace the `npm run check` bullet in `CLAUDE.md` with Lantern's wording (keeps going, log path, read the log
   instead of re-running, `check:fast` while working).
5. Run `npm run check` once. Confirm: one line per step, the log file exists, an `ok`/`FAIL` per step. Then break one
   step on purpose (a lint error in a scratch file), confirm the run still reaches the later steps and exits 1, and
   remove the scratch file.

## Acceptance

- [ ] `npm run check` exits 0 on a clean tree and prints one line per step plus `check passed`; `node_modules/.cache/check/last.log` holds the output.
- [ ] With a deliberate lint error, the run still runs `format:check`, `check:conventions` and `test`, and exits 1 (the scratch file removed afterwards).
- [ ] `npx eslint scripts/check.mjs` is clean; `bash corpus/lint.sh` OK.
- [ ] `scripts/check.mjs` is identical to `lantern`'s copy.
- [ ] End move `done` (tooling only, nothing to deploy).

## Owner steps

None.

## Owner decisions

- Settled 2026-11-25 (owner): promote it.
- Mine (technical): copy Lantern's file verbatim rather than adapt it; keep the existing step order.
