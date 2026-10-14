# Task 06: Accounts and sign-in

## Context

Shelfmark is for one person and runs on the VPS, so it needs a login
([decisions.md](../../wiki/decisions.md)). The estate's rule is that every app
owns its accounts and its login page, with "Sign in with Ward" as a second way
in, through Ward's shared library vendored into the app. Read, in this order:

- `../wzd_auth/corpus/wiki/integrating.md` and
  `../wzd_auth/shared-library/README.md` (the adoption guide: vendoring,
  `wardAuth`, the hooks, the gotchas).
- Satchel, the worked example on this exact stack: `../satchel/server/vendor/ward/`
  (library 0.3.1), the `wardAuth` registration in `../satchel/server/src/app.ts`,
  `../satchel/server/src/auth/guard.ts`, `../satchel/server/src/seed.ts`, and
  `../satchel/web/src/auth/` (login page, auth gate, session).

Shelfmark is simpler than Satchel: one user, no roles, no bearer tokens, no
WebSocket. Depends on briefs 02 and 04.

## Files you OWN

```
server/vendor/ward/*                      (the built library, 0.3.1, never edited)
server/src/auth/*                         (only if glue is needed beyond the plugin)
server/src/seed.ts                        (and the "seed" script in server/package.json)
server/src/app.ts                         (register wardAuth first, as the root guard)
server/src/config.ts                      (the WARD_OIDC_* and AUTH_TRUSTED_PROXIES settings)
server/src/testing/testApp.ts             (a signed-in session helper)
web/src/auth/LoginPage.tsx  web/src/auth/AuthGate.tsx  web/src/auth/session.ts  web/src/auth/*.test.ts
web/src/account/actions.ts                (change password, Ward link/unlink, sign out)
web/src/account/ChangePassword.tsx
web/src/App.tsx                           (wrap the shell in AuthGate)
../wzd_auth/infrastructure/local/seed.mjs (one APPS entry; commit in that repo)
```

## Files you must NOT touch

Every other route file; the library, add and book pages.

## What to do

1. **Vendor** the library at 0.3.1 exactly as Satchel did (copy the built
   files and their README; never edit them).
2. **Guard.** Register `wardAuth` first in `app.ts`: local accounts in the app's
   own database, sessions in the `shelfmark_session` cookie with
   `Path=/shelfmark-api`. Public routes: `GET /api/health` only. Every other
   `/api/*` and `/auth/*` route needs a live session. Refuse cross-origin
   writes as Satchel's guard does. `testApp` gains a helper that creates a user
   and returns a session cookie, and every existing route test uses it; they
   all still pass.
3. **Ward.** "Sign in with Ward" is on when the five `WARD_OIDC_*` values are
   set, hidden otherwise. Add Shelfmark to the local Ward seed's `APPS` list:
   `{ slug: "shelfmark", name: "Shelfmark", repo: "shelfmark", envFiles:
   [".env"], dev: "http://localhost:5176/shelfmark/", api: "/shelfmark-api" }`.
   Running the seed (with the local Ward container up, see the owner's Ward
   notes) writes the values into `.env`. Production registration is brief 14's.
4. **Seed** (`npm run seed -w @shelfmark/server`): creates the one local user
   from `SEED_USERNAME` and `SEED_PASSWORD` or, for what is missing, a terminal
   prompt; never from a file in the repo; an existing user is left untouched.
   There is no register page.
5. **Web.** `AuthGate` asks `GET /auth/session`; signed out → `/login`. The
   login page is in the design's world ([design.md](../../wiki/design.md)):
   the wordmark, username, password, a primary "Sign in" pill, and "Sign in
   with Ward" under it when available; errors name the problem ("Wrong username
   or password"). Any 401 from `api.ts` returns to the login page. The account
   menu's Change password, Sign in with Ward (link or unlink, showing
   "Linked") and Sign out now work.
6. Load `impeccable` for the login page and the password dialog, inside the
   existing world.

## Acceptance

- Signed out, `GET /shelfmark-api/api/books` is 401 and the web app shows the
  login page; after `npm run seed` and signing in, the library loads.
- With the local Ward container running and the seed run, "Sign in with Ward"
  completes and lands in the library (if Ward isn't running, say so in the
  outcome note and show the button hidden when unset).
- `npm run typecheck && npm run lint && npm test` pass; no secret value is in
  any committed file.
