# Task 10: A stop aborts the lookups in flight

**Depends on:** brief 08 (the server's feature folders, `close-with-grace` in `server.ts`), the owner's skills library page `code-structure/references/shutdown-and-timeouts.md` (`preClose`, the real-socket check).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

From the todo [a lookup in flight holds the shutdown](../../todos/a-lookup-in-flight-holds-the-shutdown.md) (2026-11-12). A lookup can wait on the catalogs for 40 s or more on a miss. `app.close()` waits for every request in flight, so a stop during one runs `close-with-grace`'s 10 s out and the process exits 1. The recipe: cancel held responses in `preClose`, which runs before the wait; `onClose` runs after it.

The lookup's outbound calls are Open Library and Google Books (`fetch` with an `AbortSignal.timeout`), and the three library catalogs over Z39.50 (a raw socket in `z3950/client.ts`). Between two requests to one source the queue sleeps (5-10 s for the catalogs). All of it must stop at once.

The server's timeout values (`connectionTimeout` 130 s and the others) are an open owner question on brief 08. Don't change them.

## Files you OWN

- `server/src/features/lookup/routes.ts`, `queue.ts`, `openlibrary.ts`, `googlebooks.ts`, `libraries.ts`, `z3950/client.ts`, and their tests; a new test `server/src/features/lookup/shutdown.test.ts`.
- `server/src/lib/api-error.ts` (one new code, `unavailable`, 503).
- `corpus/` (log, wiki status line, this brief's closeout, the todo's status).

## Files you must NOT touch

`server/src/server.ts` (timeouts, `close-with-grace`), `app.ts`, the covers and recommendations features, `features/lookup/cip/`, the web app, `vendor/`.

## What to do

1. One `AbortController` per `lookupRoutes` plugin; a `preClose` hook aborts it.
2. Each source takes an optional `signal`: `getJson` joins it with the timeout (`AbortSignal.any`); `searchIsbns` destroys its socket and rejects on abort; the queue's wait (`Clock.sleep`) and its turn stop on abort, so a task waiting in line fails at once and no timer outlives the stop.
3. A source that fails on the abort is not cached (it already isn't: errors are not cached). After the lookup, if the signal is aborted, the route answers `503 { error: { code: "unavailable" } }` instead of a draft built from half the sources.
4. Test: with a stub `fetch` that hangs and a fake catalog that never answers (no real network, never Google Books), start the lookup route on a real socket, begin a lookup, call `app.close()`; the client gets 503 and `close()` resolves within a second. Also unit tests for the queue and `searchIsbns` abort.

## Acceptance

- `npm run check` and `bash corpus/lint.sh` exit 0.
- The test in step 4 fails without the `preClose` hook (close waits) and passes with it.
- No call to a real remote from any test.

## Outcome (2026-11-13)

Built on local `main` (`c3cf248`), server only: `node cli.ts shelfmark server`. `lookupRoutes` makes one `AbortController` and aborts it in a `preClose` hook. Each source takes the signal: `getJson` joins it with its timeout, `searchIsbns` destroys its socket, and the queue's turn and pause stop (`Clock.sleep` takes the signal), so no timer outlives the stop. The route answers 503 `unavailable` (a new code in `lib/api-error.ts`) when the stop cut the lookup. `shutdown.test.ts` runs the route on a real socket over stubs that never answer (Open Library hanging; then the catalogs hanging): 503 and `close()` under a second; with the hook turned back into `onClose` both fail by timeout. Timeouts untouched. Not covered: the recommendations feature's Open Library calls and the CIP refresh job have no signal (the todo named the lookup only). Not run: the built server under SIGTERM (owner: stop the container during a lookup after the deploy).
