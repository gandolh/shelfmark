# Task 14: Deploy to the shared VPS

## Context

Shelfmark runs on the owner's VPS like Satchel ([decisions.md](../../wiki/decisions.md),
[architecture.md](../../wiki/architecture.md)): Caddy serves the PWA at
`/shelfmark/` and forwards `/shelfmark-api/` with `handle_path` to an API
container on `127.0.0.1:8796`, deployed by `../vps-deploy`. Satchel is the
worked example for every file here: `../satchel/infrastructure/Dockerfile`,
`../satchel/infrastructure/docker-compose.yml`,
`../vps-deploy/stacks/satchel.ts`, its `SourceRepo` entry in
`../vps-deploy/lib/estate.ts`, and `satchel.useWard(ward.identityFor(...))` in
`../vps-deploy/app.ts`. Read `../vps-deploy/README.md` before touching it.

**Deploying is an owner step.** This brief prepares everything and writes the
exact commands; it never runs a deploy, never pushes, and never installs git
hooks. No secret value goes into any repo, and the production domain is never
written into documentation.

Depends on all v1 briefs except 13 (they can run side by side).

## Files you OWN

```
infrastructure/Dockerfile  infrastructure/docker-compose.yml
docs/owner-setup.md
README.md                                  (fill the "Owner setup" heading with a link)
../vps-deploy/stacks/shelfmark.ts          (new; commit in that repo)
../vps-deploy/lib/estate.ts                (the shelfmark SourceRepo entry)
../vps-deploy/app.ts                       (construct the stack; useWard)
```

## Files you must NOT touch

Application code, except to fix something the container build exposes (say so
in the outcome note). Other stacks in vps-deploy.

## What to do

1. **Image** (`infrastructure/Dockerfile`), Satchel's multi-stage shape: build
   `shared` and `server` with `tsc -b`; production dependencies for the server
   workspace only; better-sqlite3's foreign prebuilds removed with Satchel's
   blacklist (not a whitelist); `server/vendor` copied; tests stripped;
   `HOST=0.0.0.0`, `PORT=8796`, `DATA_DIR=/data`; `VOLUME /data`; health check
   on `/api/health`. Satchel's comment on why the container runs as root under
   rootless Docker applies; carry it over.
2. **Compose** (`infrastructure/docker-compose.yml`): service `shelfmark-api`,
   published on `127.0.0.1` only, `env_file: .env` (written by the deploy),
   environment overrides that beat a stray dev `.env`, the data directory
   bind-mounted from `SHELFMARK_DATA_DIR`.
3. **Stack** (`../vps-deploy/stacks/shelfmark.ts`): a `WebServiceStack` like Satchel's:
   `basePath: "/shelfmark"`, `apiPrefix: "/shelfmark-api"`, client built with
   `npm run build` and `baseEnv: "SHELFMARK_BASE"`, `tryFiles: "spa"`,
   persistent state `/srv/shelfmark-api/data` (it holds every book and cover),
   port 8796, environment from `../vps-deploy/secrets/shelfmark.env`:
   `GOOGLE_BOOKS_API_KEY` (and `WARD_OIDC_CLIENT_KEY` through `useWard`).
   Register the repo in `../vps-deploy/lib/estate.ts`, construct the stack in `app.ts` among
   the applications, and add `shelfmark.useWard(ward.identityFor(shelfmark,
   "shelfmark"))`. Run `npm run check` and `npm run graph` in vps-deploy: no
   port or path clash; commit the synth output if the README says to.
4. **Owner setup** (`docs/owner-setup.md`), every step with exact commands and
   no values: register Shelfmark as a client in production Ward (as Satchel was;
   follow `../wzd_auth/shared-library/README.md`); write
   `../vps-deploy/secrets/shelfmark.env` in vps-deploy with the two keys; run the deploy
   (`node cli.ts shelfmark deploy` or the phases the README names, with a
   `--dry-run` first); create the owner account on the server with the seed
   script inside the container (`SEED_USERNAME`, `SEED_PASSWORD` passed on the
   command line, never stored); grant the Ward account access to Shelfmark;
   open the app, install it on the phone; how to download a backup and how to
   restore one (stop the container, replace the `.db` file, start it).

## Acceptance

- `docker compose -f infrastructure/docker-compose.yml up --build` locally
  serves `{"ok":true}` on `http://127.0.0.1:8796/api/health`, with the
  database in the bind-mounted directory.
- In vps-deploy, `npm run check` passes and `node cli.ts shelfmark deploy
  --dry-run` prints the actions without running them.
- `docs/owner-setup.md` covers every step above; `grep` finds no secret value
  and no production domain in either repo's changes.
