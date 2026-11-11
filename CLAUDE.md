# Shelfmark

A catalog of the physical books the owner has at home: a React PWA, a Fastify
API and SQLite. Read [corpus/index.md](corpus/index.md) first.

## Commands

- `npm run dev`: the API on 8808 and the page on 5176 (`npm run dev:https` for
  the phone camera).
- `npm run check`: typecheck, lint, format check, conventions, tests. Run it
  before every hand-back.
- `npm run check:fast`: the typecheck, then ESLint on the changed files. The
  Stop hook runs it.
- `npx vitest run <file>`: one test file.
- `npm run format`: Prettier writes every file it covers (Markdown and the
  recorded fixtures stay out).
- `npm run seed -w @shelfmark/server`: a local account and some books.

## Places that mislead

- The typecheck is two runs: `tsc -b` (shared, server), then
  `tsc -p web --noEmit`.
- `shared/dist` must exist before the tests: `pretest` builds it.
- `.env` sits at the repo root, not in `server/`. Production listens on 8796.
- The build is `npm ci` and `npx tsc -b server` (the Dockerfile). The
  Dockerfile copies only `tsconfig.base.json`, so the house compiler flags live
  there and not in an extended file.
- `vendor/house-style/`, `server/vendor/` and `web/vendor/` are generated
  copies. Never edit them; `npm run house-style:sync` refreshes the first.
- `check:conventions` runs the two house checkers `--warn-only`: their
  findings are the Base UI, Tailwind and server structure work still to do.

## Hard rules

- **No secrets.** Never write a password, API key or token into the corpus or
  the repo. The Google Books key and seed values live in `.env` (gitignored);
  name a secret by its file and key, never by its value.
- **Never call the Google Books API from a check or a test.**
- **Placeholder contact.** The Open Library `User-Agent` needs a contact
  address. Use `johndoe@example.com` until the owner's mail is live.
- **No CI.** Don't add GitHub Actions, runners or other GitHub-specific
  automation.
- **No pushes.** Commit locally on `main`. The owner pushes.
- **Deploys, git hooks and `npm link` are owner steps.** Write the exact
  commands down and hand them over.

## brief-board

Brief progress goes on brief-board. Run `brief-board guide` before you
start or resume a brief, and follow it.
