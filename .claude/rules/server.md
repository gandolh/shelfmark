---
paths:
  - "server/src/**"
  - "shared/src/**"
---

# The API (`server/src`, `shared/src`)

- Add a field to `FeatureContext` only when two features need it. The sign-in
  feature registers first.
- Errors are `ApiError` with the body `{ error: { code, message } }` that
  `web/src/api.ts` parses.
- Every outbound request goes through `ctx.fetch` or `ctx.connect`, never the
  global `fetch`.
- The catalogs are asked politely: one request at a time per source, through
  `server/src/lookup/queue.ts`.
- No test boots the app: handlers are tested without `inject()`. Never call
  the Google Books API from a test.
- `server/src/config.ts` is the one reader of the environment. The server
  entry, the seed and the CIP command still read it themselves (an ESLint
  warning for now); add no other reader.
- No `enum`, no `any`, no `!` in source, no `console` outside the CLIs.
- `server/vendor/` is generated. Never edit it.
- `npm run check:conventions` runs `check-structure` over these folders,
  `--warn-only` until the server is restructured.
