---
paths:
  - "server/src/**"
  - "shared/src/**"
---

# The API (`server/src`, `shared/src`)

- Read the `code-structure` skill before you add or move a route, a plugin or a
  module. Also read [wiki/architecture.md](../../corpus/wiki/architecture.md)
  and [wiki/data-model.md](../../corpus/wiki/data-model.md).
- `server/src/config.ts` is the only reader of the environment, the `.env`
  file and the data folder (`n/no-process-env` is an error). `server.ts` is
  the only file that listens; `app.ts` builds the app and never does.
- A feature is `server/src/features/<name>/`: `routes.ts`, `store.ts`, an
  `index.ts` other code imports through, and its own options type (never
  `FeatureContext` from `app.ts`). Cross-cutting code (errors, the JSON body,
  sign-in) is `server/src/plugins/`, wrapped in `fastify-plugin`, registered
  in `buildApp` before the features. `lib/` is pure and never imports Fastify.
  Lookup and the CIP index are one feature (`features/lookup/cip/`), and the
  recommendations use its helpers through `features/lookup/index.ts`.
- Every route declares `params`, `querystring` and `body` as it takes them and
  a `response` for each status it sends, through
  `@fastify/type-provider-zod` (`FastifyPluginAsyncZod`). No handler parses
  request input. A response schema has no `.transform()` and no `.strict()`:
  the saved views answer with `savedViewOutputSchema`, and `savedViewSchema`
  stays for the web. The image and backup routes send bytes and have no
  response schema. Add a serializer test (`testing/serialize.ts`) that strips
  a field and one for the 500.
- Errors are `throw new ApiError(code, message)`, and the body is
  `{ error: { code, message } }`, which `web/src/api.ts` parses. A thrown
  message never reaches the client; `mapError` (`plugins/errors.ts`) is the
  one decision, tested on its own.
- Every outbound request goes through `ctx.fetch` or `ctx.connect`, never the
  global `fetch`.
- The catalogs are asked politely: one request at a time per source, through
  `server/src/features/lookup/queue.ts`.
- No test boots the app: handlers and plugins are tested without `inject()`
  (response schemas through `serializerCompiler`, the error mapping through
  `mapError`, the cover service with `fakeFetch`). Never call the Google Books
  API from a test.
- Sign-in registers before every feature, as a plugin.
- A `FeatureContext` field only when two features need it.
- No `enum`, no `any`, no `!` in source, no `console` outside the CLIs.
- `server/vendor/` is Ward's generated library. Never edit it.
- `npm run check:conventions` runs `check-structure` (strict) and
  dependency-cruiser over these folders; the one exception is the backup
  stream, in `scripts/conventions.json`.
