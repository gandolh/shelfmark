# Brief 16: Similar books from Shelfmark's own model

**Depends on:** brief 04 (the recommendations, the Claude import, the dedup). **Runs after:** 15.

**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Filed 2026-11-23 from the owner's ask: "I would like to try all-MiniLM-L6-v2 with transformers. Keep it as an option in the UI. Refactor the UI on that part to look better. Use personal skills to enforce the UI for it." It takes over the embedding half of the blocked spike todo (`todos/blocked/recommendations-spike.md`); TasteDive stays there.

## Context

Brief 04 shipped the Claude import as the only source of recommendations. Its step 1, a spike of a free service and a small model run inside Shelfmark, never ran, so the model was never tried. The owner now wants the model itself, in the app, as a second source they can choose next to Claude, and the Recommendations part of the Wishlist page redone to look better.

Measured 2026-11-23 in throwaway containers (`@huggingface/transformers` 4.3.2, `Xenova/all-MiniLM-L6-v2` at revision `751bff37182d3f1213fa05d7196b954e230abad9`, `dtype: "q8"`):

- On `node:24-alpine` the import fails: onnxruntime-node's Linux binaries need glibc (`ld-linux-x86-64.so.2`). transformers.js loads onnxruntime-node eagerly in Node and offers no WASM path there.
- On `node:24-trixie-slim` it works: the model file is 23 MB, first load 3.3 s including the download, 600 short texts embed in 3 to 6 s, peak RSS about 230 MB, and still 199 to 212 MB after `dispose()`.
- The install is 475 MB: onnxruntime-node 288 MB (every platform), onnxruntime-web 141 MB (unused in Node), `@img` (sharp) 19 MB. Without `ONNXRUNTIME_NODE_INSTALL=skip` npm 11 runs onnxruntime-node's postinstall, which also downloads the CUDA and TensorRT providers. With the foreign platforms and onnxruntime-web's `.wasm` files pruned, it still runs.

## Decisions

- **Server-side, in a child process.** The model runs on the server, as brief 04 specified, in a short-lived child process that loads transformers.js with `import()`, embeds, answers over IPC and exits. Memory goes back when it exits, and a load failure fails that refresh, never the API's boot. The model files are cached under `DATA_DIR/models` (the bind mount), downloaded from Hugging Face on the first refresh. That download names nothing about the library.
- **The runtime image moves to glibc.** `proddeps` and `prod` move together from `node:24-alpine` to `node:24-trixie-slim`, so native modules install on the libc they run on; `poppler-utils` from apt; the healthcheck uses `node` instead of busybox `wget`; `ONNXRUNTIME_NODE_INSTALL=skip` in every stage that runs `npm ci`; the foreign onnxruntime-node platforms and onnxruntime-web's `.wasm` files are pruned. The `deps` and `builder` stages may stay on Alpine: they only compile TypeScript.
- **The source's name is "Similar"** (`source: "similar"`): books the model finds close to books in the library. UI copy: "Similar books". Added to the glossary.
- **The profile is the household's.** The stored list is shared by the family, so every reader's rating counts: a book's weight comes from the best rating anyone gave it (5 → 3, 4 → 2, 3 → 1, 1 or 2 → left out), else its statuses (read or reading → 1, wishlist → 1, unread → 0.5, abandoned by everyone → left out).
- **Candidates** come from Open Library's search (`/search.json`, `sort=editions`, 20 a request, with `subject`) by the library's top authors and its subjects and tags that at least two books share (generic Open Library subjects such as "Fiction" left out): at most 25 requests a refresh, one at a time through the same catalog (and queue and 30-day cache) the import uses. A second refresh within 30 days makes no request.
- **Ranking:** each candidate's score is its best cosine similarity to a seed book, scaled by that book's weight; the reason names that book ("Close to *Baltagul*, rated 5 by you" or "Close to *Baltagul* in your library"). At most 3 books by one author, 30 in all. Every dedup rule from brief 04 applies.
- **One row per work.** A work already listed from Claude is not added by a refresh; a Claude import of a work listed as Similar takes the row over (source, reason, score). A refresh replaces only the Similar rows.
- **The list caps per source:** up to 30 per source, so the model's scored rows never push Claude's (score 0) off the page.
- **The option in the UI: a tab per source** (the owner's pick, 2026-11-23, over both ways side by side with a Show switch; instead of brief 04's hide setting in the Library's prefs). The Recommendations card has two tabs, *Similar books* and *From Claude*, each with its count. Each tab holds its own one-line explanation, its action (*Find similar books*, which runs the model; *Ask Claude*, the download, prompt and import as one dialog in three steps) and its own list, so a card needs no source label. The last tab is remembered on the device.

## Files you OWN

- `server/src/features/recommendations/` (the refresh job, the profile, candidates, ranking, the child process, the store's per-source list), `server/src/app.ts` (the model folder in the options), `server/package.json`, `package-lock.json`, `infrastructure/Dockerfile`, `knip.config.js`, `.npmrc` if the install flag belongs there.
- `shared/src/recommendations.ts`.
- `web/src/wishlist/` and `web/src/api.ts` (the refresh calls).
- Corpus: `corpus/wiki/recommendations.md`, `corpus/wiki/decisions.md`, `corpus/wiki/glossary.md`, `corpus/wiki/status.md`, `corpus/log.md`, `todos/blocked/recommendations-spike.md`, `DESIGN.md` (the Wishlist section).

## Files you must NOT touch

`server/vendor/`, `web/vendor/`, `vendor/house-style/`, the lookup feature beyond what it already exports.

## What to do

1. Shared: `"similar"` in the source enum; the refresh job's schema (state, step, counts, a message on failure).
2. Server: profile, candidate search (wider fields, `limit` 20, budget 25), the embedder interface with the child process behind it, ranking, the refresh job (one at a time, progress), `POST /api/recommendations/refresh` (202, 409 while running) and `GET /api/recommendations/refresh`; the store's per-source cap and the conflict rule. Unit tests with a fake embedder and fake fetch; nothing in vitest loads the model.
3. Dockerfile as decided; a `docker build` of the real Dockerfile and a running container where a refresh finds books.
4. Web: the redesigned Recommendations card, a tab per source, with the `impeccable` and `base-ui` skills: today's shots at 1280 and 390, light and dark, first; one filled primary per screen (the header's *Add a book*); every phone target 44 px.
5. A real refresh on the demo library (`docs/images/demo-seed.mjs`), with ten of its results and the timings in the outcome note for the owner to judge.

## Acceptance

- [ ] `npm run check` exit 0; `bash corpus/lint.sh` OK.
- [ ] A refresh on the demo library finds books; the outcome note has ten of them, the requests made, the times and the peak memory.
- [ ] The built image runs a refresh; its size before and after is in the outcome note and the deploy steps.
- [ ] Shots at 1280 and 390, light and dark, before and after; a design critique of the after against the before.
- [ ] End move `ready_for_deploy` with the measured sizes and the deploy commands.
