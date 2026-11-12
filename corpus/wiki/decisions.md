---
summary: Locked calls for Shelfmark, each with date, rejected alternatives and reason. Physical books only (ebooks stay in Atrium); a web app with a PWA on React, Fastify and SQLite; one user, deployed on the VPS with its own login and Sign in with Ward; English interface; the familiar table app in the Covers variant, light; three places (Library, Add a book, Wishlist; two until 2026-11-10); one row per physical copy; no loans; Google Books needs the owner's free API key; covers live in SQLite; Romanian books are looked up in three library catalogs and the CIP lists before Google, politely; the camera reads only on a press; Base UI under the menus, panels, dialog and switches. Research recommendations live on the concept pages until the owner confirms them; only lightweight tests (nothing boots the app).
updated: 2026-11-12
---

# Decisions

Each entry passed three tests: hard to reverse, surprising without context, and
a real trade-off. Changing one needs an explicit revisit and a `log.md` entry.
Recommendations on other pages (scanner library, export library, client-side
filtering) are **not** decisions until the owner confirms
them; [open-questions.md](open-questions.md) tracks what still needs an answer.

## Physical books only; ebooks stay in Atrium
_2026-10-14_. Shelfmark catalogs printed books on the owner's shelves. It never
stores or reads a book file. The owner asked for "what physical books do I
own". Rejected: adding a physical-books section to Atrium (`atrium`), which
is built around uploaded files, readers and per-profile reading progress; a
catalog of objects shares almost none of that, and would bend Atrium's single
media grid around items with no file. **Revisited 2026-10-23:** there is no link
from a book to its Atrium copy either. The owner keeps the two apps independent
for now and may merge them once both are mature; that is the owner's call, and
they will say when. Until then, no feature reaches from one app into the other.

## A web app with a PWA, on React + Fastify + SQLite
_2026-10-14_. The owner chose the stack: a React PWA for the phone and laptop,
a Fastify API, SQLite for storage. It matches the estate's house stack (Satchel,
`satchel`), so the layout, auth library and deploy pattern are reused.
Rejected: a native app, which would scan more easily (no browser camera
quirks, see [scanning.md](scanning.md)) but means a second codebase and an
app-store or sideload step for one user. Rejected: an existing service
(Libib, CLZ Books), because the owner asked for their own application.

## One user, deployed on the VPS with its own login
_2026-10-14_. The owner answered: Shelfmark is for the owner alone, and it runs
on the shared VPS like Satchel (HTTPS through Caddy, deployed by
`vps-deploy`), with Shelfmark's own login and "Sign in with Ward" as the
second way in (the estate rule in `wzd_auth`, decisions-oidc). Rejected:
home network only, which still needs a local certificate for the phone camera
and loses the "do I own this?" check in a bookshop. Rejected: household
accounts and view-only guests, which would put an owner or role on every row
and screen for people who are not asking for it. Because there is one user,
the schema has no per-user data beyond the auth tables. Adding people later is
a revisit of this entry.

## English interface
_2026-10-14_. All interface copy is English; book data stays in the book's own
language. Rejected: Romanian, and both with a switch, which would route every
string in every brief through translations. Diacritics-insensitive search and
Romanian collation still apply to the data ([library-table.md](library-table.md)).

## The UI is the familiar table app, in the Covers variant
_2026-10-14_. The owner chose the category standard, a familiar table app
played straight, over three themed directions from impeccable's direction
round (seed `ac946dc9`): Dictionary (a DEX page), Ledger (an inventory
register) and Departures (a split-flap board). Then, from three light variants
of the standard calibrated on real products (Calm after Notion, Grid after
Airtable, Covers after Apple's own apps), the owner chose **Covers**: the cover
leads, the chrome recedes, one teal accent, light. Rejected: the themed
directions, which make the owner learn a metaphor before finding a book (the
same call the owner made for showcase); Calm, whose coloured tags get busy at
library scale; Grid, which hides covers. Mock-ups and tokens:
[design.md](design.md).

_2026-11-12_, brief 07 (revisit of "light, no dark theme"): the owner's call of 2026-11-10 gives every app a Light / Dark / System switch. Light stays the choice on a first visit, even where the system prefers dark; the choice is kept on the device (`shelfmark.theme` in `localStorage`, as the Library's prefs are), so it is a `RadioGroup` in the account menu's Theme dialog (the base-ui skill's rule 16 over the brief's guarded `ToggleGroup`, which is for a picker that saves to the server). Every colour is `light-dark(light, dark)`; the dark set is a first pass for the redesign to refine, and the camera view stays dark in both. The "light" above is the first-visit default, not a ban.

## Two places only: Library and Add a book (three since 2026-11-10: Wishlist)
_2026-10-14_. The owner asked for no Loans tab and no Settings tab unless it
has content. The account items (password, Sign in with Ward, backup download,
sign out) live in a menu on the account button instead. The wishlist is a
second collection inside Library, not a third place. Rejected: a Settings page
holding four links, and a Loans tab. A new top-level place needs an
explicit revisit of this entry.

_Revisited 2026-11-10_. Shelfmark now has **three places**: Library, Add a
book and **Wishlist**. The reason is the owner's request for book
recommendations and for a place to keep the books they hear about
([the brief](../briefs/done/04-wishlist-with-recommendations.md)). The
wishlist moves out of Library, which keeps the owned books; Wishlist holds the
wished-for books and the recommendations, and has its own Add a book button.
The account items still live in the menu, and a further top-level place still
needs an explicit revisit. Built 2026-11-11 (brief 04): the Library's
Owned / Wishlist tabs are gone, and `/library?collection=wishlist` redirects to
Wishlist.

## One row per physical copy
_2026-10-14_. The owner confirmed the recommendation: a row in `books` is one
physical copy on a shelf, and its shelf, condition and acquisition belong to
it. Owning two copies of a book means two rows; ISBN is indexed but not unique.
Rejected: an `editions` table plus a `copies` table, which doubles the join and
the edit screens for a case that hardly happens. See
[data-model.md](data-model.md).

## No loans
_2026-10-14_. The owner dropped loans entirely: no Loans tab, no "Lend"
action, no `loans` table, no "on loan" column. Rejected: loans as a small
book-page action, recommended for "who has my book?", which the owner does not
need. Adding loans later is a revisit of this entry and of the two-places
entry above.

## Google Books needs the owner's free API key
_2026-10-14_. The owner accepts a Google Cloud API key only because no free
keyless service covers Romanian books. Measured on 2026-10-14 against 40
ISBNs from each of two national-library CIP lists: Open Library 4/40 and 1/40,
K10plus 1/40, BnF 1/40, DNB and the Library of Congress 0; Jisc refuses
scripts; the national library's own CIP catalog sits behind a CAPTCHA, which
the app must not work around. The key lives in `.env` as
`GOOGLE_BOOKS_API_KEY`. Details in [metadata-lookup.md](metadata-lookup.md).

## Covers live in SQLite
_2026-10-14, while writing the briefs_. Cover images are BLOBs in a `covers`
table with `ON DELETE CASCADE`, not files in `data/covers/`. Deleting a book
deletes its cover in the same transaction, and the backup is the database file
alone. Rejected: a covers folder (the first design), which needs its own
clean-up on delete and a zip to back up. At a few thousand covers of
30-100 KB the database stays well under a gigabyte.

## Romanian books: library catalogs and the CIP lists before Google
_2026-10-17_. A lookup asks Open Library, then three Romanian library catalogs
over Z39.50 (the Romanian Academy Library, BCU Cluj, BCU Timișoara), then a
local index of the national library's CIP lists, and Google Books last. Each
later source is asked only while no earlier one has found a title, so Google
is no longer asked just for a missing cover. The owner wants the Google key
used as little as possible, and on 2026-10-17 Google found none of 80 recent
Romanian trade books. The libraries found 33 of 40 books from 2012-2015, and
the CIP lists cover the newest books, which libraries catalogue a year or so
late. The libraries are asked politely: one request at a time per library,
a random 5-10 s pause between requests, every answer cached. The owner is
grateful for their work. There's no email for now, but the owner may contact
them later about working together. Rejected: scraping
bookshop sites or Goodreads (against their terms, fragile; the owner said no
again on 2026-10-17), ISBNdb (paid), the national library's catalog (CAPTCHA,
and its Z39.50 port did not answer). Measurements in
[metadata-lookup.md](metadata-lookup.md).

## The camera reads only on a press
_2026-10-18_. Scan mode shows the live camera and a *Scan the barcode*
button. The camera decodes nothing and sends no lookup until it is pressed.
A press takes the first code it reads, and reads until it reads one
([scanning.md](scanning.md)). *Stop reading* ends it, and so does a minute
with nothing read, which is for the battery. Until 2026-10-18, the same day, it
waited for two agreeing reads; now the owner presses again when an ISBN
looks wrong. Until 2026-10-21 (2026-10-21) a press read for at most 3 s. On a
real phone the tap moves the camera and it refocuses, so the window often
ran out before the barcode was sharp.
The owner asked for the press after 2026-10-17 had made continuous
reading safer. They want nothing read or sent without a deliberate act,
which also spares the libraries and the Google key the calls of a misread or
a book the camera only passed over.
Rejected: continuous reading (2026-10-15 and 2026-10-17; no tap per book, but every book
in view is read and looked up), with or without a replaceable
result and a 600 ms wait before a lookup (both tried 2026-10-17). The cost is one tap per
book.

## Base UI under the menus, panels, dialog and switches
_2026-10-23_, the owner's call, to match their other apps (atrium,
imbatranimOS, sports-app, trips and others). The menus, the Filter and
Columns panels, Change password, the Add page's mode tabs, the segmented
controls and Change cover sit on `@base-ui/react` (pinned 1.9.0), styled by
Shelfmark's own CSS and DESIGN.md's tokens (the 2026-10-23 work).
Base UI owns focus, keys, placement and ARIA. It costs about 56 kB gzip on the
main chunk. TanStack Table stays, since Base UI has no table, and native
checkboxes, radios and selects stay native. Rejected: keeping the hand-built
widgets, and shadcn, which brings Tailwind.

_2026-11-12_, brief 07 (revisit): "styled by Shelfmark's own CSS and DESIGN.md's tokens" no longer holds. The owner's call of 2026-11-09 is that Base UI is styled with Tailwind 4, and the web app moved to it: one stylesheet, `web/src/styles/index.css`, holds the tokens as `@theme`, DESIGN.md's names in Tailwind's namespaces. shadcn stays rejected for its own reason: Base UI is used directly, behind Shelfmark's wrappers, without a styled kit on top. The first entry's text is kept above as written.

_2026-11-11_, brief 06: the 2026-11-09 conventions (the base-ui skill) are
built. Base UI is imported only under `ui/` folders, behind a `Dialog`, `Menu`,
`Tabs`, `Collapsible`, `ToggleGroup` and `Toast` wrapper and the Library's
`Panel`. A form dialog no longer closes on a backdrop press. The rating, the
shelf chips, the torch and the update prompt moved onto Base UI; inline
confirms and `<datalist>`s stay as they were. Details in
[overlays.md](overlays.md).

## Only lightweight tests
_2026-10-24_, the owner's call. `npm test` holds unit tests only: nothing
boots the whole app, signs in with a real scrypt hash, or starts a child
process. The seven files that did were deleted (`app.test.ts`, `seed.test.ts`,
and the route tests for books, covers, lookup, views and backup), with their
harness `server/src/testing/testApp.ts`. They held about 130 of 844 tests and
about 36 of the 39 seconds, and the 3,000-book timing test failed whenever the
machine was busy. The suite now runs in about 3 s. What went untested: the
routes' HTTP shapes, the auth guard over every route, sign-in and the seed
script, so check those by hand or in a browser walk. Ward's routes keep their
own tests in ward-auth. Rejected: dropping only the timing and seed tests, and
moving the seven behind an opt-in `npm run test:heavy`. A new test that boots
the app needs an explicit revisit of this entry.

## The house style, formatted and checked
_2026-11-11_. Shelfmark follows the estate's house style (`house-style` 1.0.0), formatted by Prettier at width 120 and checked by ESLint, knip and dependency-cruiser through `npm run check`. The configs are a vendored copy under `vendor/house-style/`, refreshed by `npm run house-style:sync`: the Docker `deps` stage has no `git`, so a git dependency would need it in every build, and a copy needs nothing. The reformat was one commit (140+ files, whitespace and wrapping only; recorded fixtures, Markdown and the Ward copies stay out of Prettier). The house compiler flags (`verbatimModuleSyntax`, `erasableSyntaxOnly`) sit in `tsconfig.base.json` itself, not in an extended file, because the Dockerfile copies only that file before it compiles the server; the Dockerfile is untouched. `exactOptionalPropertyTypes` waits for its count (63 web errors). `!` is an error in source and a warning in tests. The environment-read rule and dependency-cruiser's `no-circular` are warnings for now, and the two convention checkers run `--warn-only`, until the server and web work lowers their findings. Rejected: width 130 (less churn here, but the estate takes one width), a git or tarball dependency, formatting Markdown. The deploy build still runs `npm ci` and `npx tsc -b server` only; `npm run check` and the Stop hook are the gate.

## The server in feature folders, typed by zod
_2026-11-12_. Shelfmark's server follows the estate's `code-structure` skill. `server.ts` is the only file that listens and `config.ts` the only reader of the environment (`loadEnvFile`, `resolveDataDir`, `loadSeedConfig`, so a file that moves can't quietly stop reading `.env`). `buildApp` registers the error plugin, the JSON body plugin and the zod compilers, then sign-in, then the features by name: health, books, lookup, covers, backup, views and recommendations, each `server/src/features/<name>/` with an `index.ts` and its own options type. Every route declares its input and a response schema through `@fastify/type-provider-zod`; the cover image and the backup file are bytes and declare none. The error body stays `{ error: { code, message } }`, with one pure `mapError` (tested without Fastify), Fastify's own 4xx passing through and a thrown message never sent. Lookup and the CIP index are one feature, as the brief's default, because they import each other; the recommendations use its helpers through `server/src/features/lookup/index.ts`. The saved views answer with `savedViewOutputSchema` (the state already read), because zod can't encode through the `.transform()` in `savedViewSchema`, which the web keeps. "Only lightweight tests" stands: nothing calls `inject()`; response schemas are tested through `serializerCompiler`, the error mapping through `mapError`, the cover guard and download with `fakeFetch`. The timeouts: `requestTimeout` 30 s, `keepAliveTimeout` 125 s (above Caddy's two minutes), and `connectionTimeout` 130 s, not the 10 s the brief proposed: a lookup is silent for as long as its sources take, and Node cuts a silent socket (shown at 1 s on a 2.5 s route). `trustProxy` is loopback plus `AUTH_TRUSTED_PROXIES`; Ward's lockout reads its own list. zod is 4.6.7 (GHSA-mrhx-c7xc-m3w5). Rejected: the layer split `routes/` + `store/`, `@fastify/autoload`, TypeBox, and a `lib/` split of the lookup/CIP helpers.
