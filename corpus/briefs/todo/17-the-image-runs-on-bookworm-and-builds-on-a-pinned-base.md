# Brief 17: The image runs on bookworm, builds on a pinned base, and compiles from the server's install

**Depends on:** brief 16 (the Similar books model, on main). **Runs after:** 16.
**Builder:** Sonnet.
**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Filed 2026-11-24 from the estate's infra review. Every app image is built on the box by vps-deploy's `server`
phase. On 2026-11-23 the box's build cache (9.3 GB) took its disk to 90%; the cache was pruned to zero on
2026-11-24, so the next rollout builds every image cold. The box gets no extra storage (vps-deploy's decisions,
2026-11-06).

## Context

Four things in `infrastructure/Dockerfile`:

- **Shelfmark is the only image on Debian trixie.** `proddeps` and `prod` are `FROM node:24-trixie-slim` (lines
  61 and 101). The four other Debian images in the estate (atrium, newspapper, ro-housing, gazette) are on
  bookworm, so trixie is a base of about 230 MB on the box that nothing shares. The header says the runtime needs
  glibc for onnxruntime-node; bookworm has glibc 2.36, and onnxruntime-node ships manylinux binaries, so it
  should load there. Bookworm also ships `poppler-utils`, though an older poppler than trixie's, and the CIP
  refresh parses `pdftotext -layout` output (`server/src/features/lookup/cip/parse.ts`).
- **The `deps` stage installs every workspace** (`RUN npm ci`, line 47) to run `npx tsc -b server` (line 58). The
  web app's tree is installed for nothing. Measured on the laptop on 2026-11-24: the full install is 916 MB of
  `node_modules`; the server's closure plus the root's dev dependencies is about 720 MB, so about 196 MB less per
  cold build.
- **The bases float.** `FROM node:24-alpine` (line 34) follows whatever the tag is on the build day: on the
  laptop it is Node 24.21.0 on alpine 3.24.2, while imbatranimOS pins `node:24.22.1-alpine`. vps-deploy's weekly
  housekeeping removes a base tag no image uses after two weeks; the next deploy pulls the tag's current image and
  every cache entry keyed on the old one is dead. The same holds for the Debian tag.
- **The `proddeps` toolchain line differs from the other Debian images'.** BuildKit keys a cache layer on the
  exact command text. The others write:

  ```dockerfile
  RUN apt-get update \
   && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
   && rm -rf /var/lib/apt/lists/*
  ```

`MALLOC_ARENA_MAX=2` is already set (2026-11-23); keep it.

## Decisions

- `proddeps` and `prod` move to `node:24.22.1-bookworm-slim`; `deps` (and so `builder`) to `node:24.22.1-alpine`.
  The estate moves to a new patch in one sweep, not per repo.
- `deps` runs `npm ci -w @shelfmark/server --include-workspace-root`. Every manifest is still copied: `npm ci`
  checks the lockfile against all of them.
- The `proddeps` toolchain line takes the text above, character for character.
- **The fallback:** if the model doesn't load on bookworm, or the CIP parse gives different records, keep
  `node:24.22.1-trixie-slim` for those two stages, land the rest, and say which check failed.
- The header comment names bookworm and keeps the reason for glibc.

## Files you OWN

- `infrastructure/Dockerfile`
- The root `CLAUDE.md` line "The build is `npm ci` and `npx tsc -b server`", which names the install
- The image lines in `corpus/wiki/decisions.md`, if they name trixie
- The closeout: the outcome note, `corpus/log.md`, `corpus/wiki/status.md`

## Files you must NOT touch

- Any `package.json` or `package-lock.json`, `.npmrc`.
- The model code under `server/src/features/recommendations/` and the CIP code.
- vps-deploy: read only.

## What to do

1. **Check the scoped install without Docker.** Export the tree to a scratch folder outside the repo
   (`git archive HEAD | tar -x -C <scratch>`). There, run the full `npm ci` and `du -sm node_modules`; delete
   `node_modules`, run the scoped command, `du -sm` again, then `npx tsc -b server`. It must compile. If it fails
   on a missing package, add the workspace that brings it and say so in the outcome.
2. **Check bookworm before relying on it.** In a throwaway `node:24.22.1-bookworm-slim` container with the
   scoped production install, `node -e "import('onnxruntime-node')"` must load. Then run one CIP PDF through
   `pdftotext -layout` in a bookworm and a trixie container and parse both outputs with the server's parser:
   same record count, same first and last records. Any difference: the fallback in Decisions.
3. Edit the Dockerfile as decided.
4. On the laptop, build today's image and the new one (`docker compose -f infrastructure/docker-compose.yml build
   shelfmark-api`) and save `docker history` of each.
5. Brief 16's walk on the new image with a scratch data folder: the container is healthy, *Find similar books*
   runs the model and lists books, and a CIP refresh stores records.

If your session can't build Docker images, do step 1 and as much of step 2 as runs without a build, make the
change, run the checks, and hand back with steps 2, 4 and 5 for the controller.

## Acceptance

- [ ] Step 1's two `du` readings and the compile result are in the outcome.
- [ ] Step 2's results: the model import and the CIP comparison, on bookworm.
- [ ] The image builds; `docker history` before and after, from one machine, in the outcome.
- [ ] The walk in step 5 passes; `/api/health` answers.
- [ ] `npm run check` exits 0; `bash corpus/lint.sh` passes.
- [ ] End move `ready_for_deploy`.

## Owner steps

- `node cli.ts shelfmark server` from vps-deploy. The deploy builds the image on the box.
