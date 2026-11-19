# Brief 15: A new column joins a saved order at its place

**Depends on:** brief 12 (the Readers column). **Runs after:** 14.

**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Filed 2026-11-19 from the owner's answer to shelfmark-12's question 1: "a new column joins a saved order at its default place".

## Context

`LIBRARY_COLUMN_IDS` (`shared/src/views.ts`, `web/src/library/columns.ts`) is the table's default order. A device that saved its own column order, and a saved view that names columns, both meet columns they never heard of when a version adds one; today the new column goes to the end. So Readers (brief 12, on by default after Your status) appears after Added on every device the owner uses.

## Decisions

- **The rule:** a column the stored order doesn't name goes right after the nearest column before it in the default order that the stored order does name; first if there is none. Two new columns keep their default order between them. Everything the stored order names keeps its place.
- **On read, not on write:** the merge happens wherever a stored order is read; the stored value changes only when the person changes the columns.
- A new column's shown or hidden default is unchanged (Readers shows).
- Where a stored order lives (device storage, saved views, the export's column list if it follows the table) is for you to find: every reader of a stored column order uses the one merge.

## Files you OWN

- `web/src/library/` (the merge and its readers), `shared/src/views.ts` only if the merge belongs there, their tests.
- Corpus: `corpus/wiki/library-table.md`, `corpus/wiki/status.md`, `corpus/log.md`.

## Files you must NOT touch

`server/` (unless a saved view's order is merged on the server; then say so before changing it), `server/vendor/`, `web/vendor/`.

## What to do

1. One merge function with unit tests: a stored order without `readers` puts it right after `status`; a reordered stored order keeps the person's order and still slots the new column after its default neighbour; two new columns at once; a stored order naming a column that no longer exists drops it.
2. Use it at every read of a stored order. A test that fails on today's code: a device order saved before Readers shows Readers after Your status.
3. Shots of the Library at 1280 light with a pre-Readers saved order; read it. Only lightweight tests (the owner's rule for Shelfmark since 2026-10-24).

## Acceptance

- [ ] The tests above pass; `npm run check` exit 0; `bash corpus/lint.sh` OK.
- [ ] End move `ready_for_deploy`, owner step: deploy with briefs 11 to 14 (`node cli.ts shelfmark server`, then `node cli.ts shelfmark deploy`).
