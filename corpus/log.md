# Log

## [2026-10-14] ingest | Corpus bootstrapped with the feature research

The owner asked for an app that catalogs their physical books: scan an ISBN or
barcode, save to SQLite, a sortable table with a filter on any column, export
to Excel/CSV, a PWA on React + Fastify + SQLite. Research covered comparable
apps (Libib, BookBuddy, CLZ Books, LibraryThing), live tests of Open Library,
Google Books and the BNR catalog, browser barcode support and the iOS PWA
camera bugs, and current npm versions. Filed as
[wiki/features.md](wiki/features.md), [wiki/metadata-lookup.md](wiki/metadata-lookup.md),
[wiki/scanning.md](wiki/scanning.md), [wiki/library-table.md](wiki/library-table.md),
[wiki/export.md](wiki/export.md), [wiki/data-model.md](wiki/data-model.md) and
[wiki/architecture.md](wiki/architecture.md); two decisions locked from the
owner's own framing; 21 todos captured by tier. Main finding: Open Library
found 23/25 English ISBNs but only 5/25 and 3/25 Romanian ones, and keyless
Google Books calls fail with 429.

## [2026-10-14] decision | One user, on the VPS, English interface; PRODUCT.md written

The owner answered the impeccable init interview: Shelfmark is for the owner
alone, deployed on the VPS like Satchel with its own login and Sign in with
Ward, with an English interface. Recorded in
[wiki/decisions.md](wiki/decisions.md); the two questions left
[wiki/open-questions.md](wiki/open-questions.md). `PRODUCT.md` at the repo root
is impeccable's product record for the design work. Direction round seeded
(`ac946dc9`); mock-ups go to the owner on the design canvas.

## [2026-10-14] decision | UI chosen: the familiar table app, Covers variant

Impeccable direction round (seed `ac946dc9`) on the design canvas: Dictionary,
Ledger, Departures and the standard; the owner chose the standard. Then three
light variants calibrated with design-md-library (Calm after Notion, Grid after
Airtable, Covers after Apple's own apps); the owner chose Covers. The owner
also cut navigation to Library and Add a book (no Loans tab, account items in
a menu instead of Settings) and asked for a light theme. New page
[wiki/design.md](wiki/design.md); two entries in
[wiki/decisions.md](wiki/decisions.md); loans moved to an open question;
`PRODUCT.md` brand commitments updated.

## [2026-10-14] decision | One row per copy, no loans, a wishlist, the Google key; name kept

The owner answered the open questions: one row per physical copy; loans
dropped entirely (the loans todo is deleted); the wishlist is wanted (moved to
v1.x as a second collection inside Library); the name stays Shelfmark (over
Armarium, Alcove and Keep). The Google Books key was accepted on condition
that no free service covers Romanian books, so that was measured first: 40
ISBNs from each of the March 2019 and April 2026 CIP bibliographies against
Open Library, K10plus, BnF, DNB and the Library of Congress found 5/40 and
1/40 at best, and the national library's CIP catalog sits behind a CAPTCHA.
Recorded in [wiki/decisions.md](wiki/decisions.md) and
[wiki/metadata-lookup.md](wiki/metadata-lookup.md); new
[wiki/glossary.md](wiki/glossary.md) (book, collection, shelf, status, lookup,
draft, CIP; the `location` column is now `shelf`); new later todo
cip-bibliography-index.

## [2026-10-14] ingest | No existing list to import

The owner has no spreadsheet, Goodreads or Libib list, so CSV import stays in
v1.x and every book enters by scan, ISBN or hand. No open questions remain.

## [2026-10-14] todo | Briefs 01-14 filed for v1, in six waves

Fourteen briefs in `briefs/todo/`: scaffold; store and API; ISBN utilities;
app shell and tokens; lookup and covers; camera scanner; accounts; Library
page; Add a book page; book page; export and backup; PWA; impeccable's design
finish and DESIGN.md; deploy. Eleven v1 todos are marked promoted; the ISBN
utilities, app shell and design finish briefs had no todo. Writing them settled
two things, recorded in [wiki/decisions.md](wiki/decisions.md) and the data
model: covers live in SQLite (the backup is one `.db` file, no zip) and there
is no `isbn10` column. Ports fixed: dev 8808/5176, production 8796. Waves and
states in [wiki/status.md](wiki/status.md).

## [2026-10-15] build | Waves 1-3 built: briefs 01, 02, 03, 04, 05, 07

Built with `plan-split-dispatch`, one commit per brief on `main`, not pushed.
The remote is the GitHub repo `<owner>/shelfmark` (set 2026-10-14). Gate
between waves: typecheck, lint, tests (280 after wave 3), build. Rulings worth
keeping:

- Dependencies are installed by the controller before a wave, never by
  parallel agents, so two `npm install`s never race on the lockfile.
- Brief 05's SSRF allowlist also accepts `archive.org` and
  `iaNNNNNN.us.archive.org`, as redirect targets only: every Open Library
  cover redirects there, so the brief's three hosts alone would refuse them all.
- Brief 07's `.wasm` is a `?url` import, not a copy step in `vite.config.ts`;
  it reaches the build once a production page imports the scanner (brief 09).
  `zxing-wasm` 3.1.3 is now a direct dependency so it can't drift from the
  ponyfill.
- Wave 4 runs as 08 and 09 first, then 06 alone: 06 puts every route behind a
  session, and the page agents' live checks would start failing midway.
- The design canvas (claude.ai artifact) could not be read after the session
  restarted under another account; its Covers artboards were transcribed for
  the page agents from an earlier read.
- Owner checks waiting: the scanner on an Android phone and an iPhone (steps in
  brief 07's outcome); the Google
  measurement once `GOOGLE_BOOKS_API_KEY` is in `.env`.

## [2026-10-15] build | Wave 4 built: briefs 08, 09, then 06

The Library page and the Add a book page were built side by side, then
accounts alone; 465 tests after the wave. Rulings:

- Brief 09 moved "Found in Open Library" under the meta line, against the
  Calm-Add mock-up, after impeccable's finish reviewer called it a kicker.
  The Covers world redraws that artboard anyway.
- Brief 06 vendors Ward's library twice (`server/vendor/ward`,
  `web/vendor/ward` for the React hooks), as Satchel does, and rewrites
  `Origin` in the Vite dev proxy for `npm run dev:https` on a phone, because
  the library's login compares `Origin` to the fixed PUBLIC_ORIGIN inside the
  vendored bundle. Production has no Vite.
- Satchel's seed has the same hidden-prompt bug Shelfmark's had (the
  `_writeToOutput` trick throws on Node 24's `readline/promises`); not fixed
  there.
- Shelfmark's entry in Ward's local `seed.mjs` and its README row are
  committed in `wzd_auth`. The live Ward round trip waits for Docker.

## [2026-10-15] build | Wave 5, the deploy and the review gate

Briefs 10, 11, 12 built side by side, then 14 (the deploy, prepared only;
committed in `vps-deploy` too). Then three review finders (server
security, web integration, conventions) and two fix rounds; 515 tests.

Fixed from the review: covers keyed by `Book.coverUpdatedAt` instead of an
in-memory version (a replaced cover stayed stale after a reload, and a
reused id showed a deleted book's cover); the book page's wishlist option
removed (the book vanished from the Library with no way back until the v1.x
wishlist); the scanner re-reading the book just saved; the Library stuck on
loading after a stray 401; a prototype key from Open Library poisoning a
cached draft; a 500 when a book is deleted mid cover download; the backup
copy left in WAL mode; cached covers kept after sign-out; the README's local
run missing the seed step. The server finder found the auth guard, the
SSRF guard, uploads and the backup sound under probes.

Accepted, not fixed (Minor): a CSV ISBN opens in Excel as a number (the XLSX
keeps it as text); `STATUS_LABELS`, `bookId` and the `AlertIcon`/`Icon`
wrappers exist in two places; `ManualForm` writes `aria-invalid="false"`;
comments still name brief numbers; the 513 kB main chunk (React and zod
dominate; lazy pages would save little); the auth library's 401 body is
`{ error: "unauthorized" }`, not the app's envelope; `refreshBooks` is
exported and unused; the 3,000-book timing test (best of three, 100 ms) can
still fail on a heavily loaded machine; every app in the estate shares one
origin, so script injected into another app passes the Origin check
(architectural). The vps-deploy constructs can't set cache headers for
`sw.js` and `index.html`; ETag revalidation covers it.

## [2026-10-15] build | Brief 13, the design finish; v1 built

impeccable's finish reviewer passed the app after one fix round of seven
items (phone toolbar, book page alignment, desktop Add switch, Year header,
offline notice, icon); `DESIGN.md` and `.impeccable/design.json` record the
built system. All 14 v1 briefs are in `briefs/done/`. Nothing is pushed or
deployed; [status.md](wiki/status.md) lists what waits on the owner. Left
open from the review for the owner to decide: whether the table's 46×69
placeholder should be a simpler mark, the desktop Add result's small cover,
and the not-found copy ("No match for …"), which came from the Grid-Add
mock-up and uses a word the glossary avoids.

## [2026-10-16] docs | README and docs/ to the readme-docs standard

The README is now a landing page: one-liner, the Covers view as the hero,
status, what it does and leaves out, four screenshots, how it works, run it
locally, layout, docs, license (none yet). New in `docs/`: `README.md` (the
index), `getting-started.md` (the README's old run section, the env vars, and
`npm run dev:https` for scanning from a phone), `architecture.md`, and
`images/` with `shots.md` and `demo-seed.mjs`; owner-setup now points at
getting-started for local development. The images come from a throwaway
clone with a made-up `demo` account and 27 classics with no cover files. The
scanner and the "Already in your library" card were not captured (no camera;
the card pulls the publisher's cover from Open Library). [status.md](wiki/status.md)
caught up: `main` is pushed, `wzd_auth`'s `55cf336` too, and
`vps-deploy` has no remote.

## [2026-10-17] research | Romanian lookups: Google misses, three library catalogs answer

The owner's Google key found none of the Romanian books they tried, e.g.
9786064031365. Google has no record of that ISBN, and its API was degraded
that day (503s; `isbn:` queries empty even for *The Hobbit*). Open Library
and the keyed Google run found 0 of 80 trade books from 2024 and 2026. The
book was in the February 2026 CIP list. Three library catalogs answer ISBN
searches over Z39.50 and found 33 of 40 trade books from 2012-2015. The owner
rejected scraping again, said yes to the CIP index, and asked that the Google
key be used as little as possible. Findings in
[metadata-lookup.md](wiki/metadata-lookup.md), new todo
z3950-library-source.

## [2026-10-17] plan | Briefs 15 and 16: library catalogs and the CIP index

The owner approved the lookup order (Open Library, three library catalogs,
the CIP index, then Google only when nothing has a title) and asked for the
plan in writing before any code. Recorded as a decision, two glossary terms
(*Library catalog*, *CIP index*) and two briefs. Rules from the owner: one
request at a time per server, a random 5-10 s pause between requests, every
answer cached, and the libraries' work acknowledged; no email to them for
now. Checked live before writing: one `@or` query covers the ISBN-13 and
ISBN-10, no library sends records with the search reply, and BCU Cluj sends
UNIMARC content labelled USMARC.

## [2026-10-17] build | Brief 15: the library catalogs

Built inline (no subagents). Lookups ask the Romanian Academy Library, BCU Cluj
and BCU Timișoara over Z39.50 after Open Library and before Google Books, and
each source is asked only while nothing has a title. Checked against the real
servers: three Romanian books found, Google never asked. BCU Timișoara
sometimes misses the 10 s deadline; that is an uncached error. 563 tests.
Outcome in brief 15.

## [2026-10-17] build | Brief 16: the CIP index

Built inline. The national library's CIP lists are now a lookup source after
the library catalogs, held in their own `cip.db` (a departure from the brief,
to keep the owner's backup small) and refreshed weekly at the polite pace.
Against the real site, two issues imported (2,951 and 3,000 records), and a
2026 book no library holds came from the index without asking Google. The
image build was checked once the owner started Docker: the same 3,000
records inside it, healthy. 610
tests. Outcome in brief 16.

## [2026-10-17] build | Brief 17: confirmed reads and live rescans

The owner reported that the camera sometimes reads wrong digits. They asked
for it to keep reading, so that repositioning the book corrects the result,
at a slow pace that doesn't feel laggy (they suggested about 2 s). Built
inline after the brief was written:

- A code fires once two reads agree, which filters out the misreads the
  check digit misses.
- It stays quiet while in view.
- A result sheet the camera opened stays loose until the owner touches it,
  and a different ISBN replaces it.
- The pace is 250 ms looking, 1 s watching, and 150 ms to confirm. 1 s
  rather than 2 s, so a correction lands in about a second.

Checked in headless Chrome with a fake camera. 629 tests. Outcome in
brief 17.

## [2026-10-17] build | Brief 18: one lookup per ISBN

The owner asked for no outside calls when an ISBN is the same as before, and
for the ISBNs tried to be kept, with a debounce. The server's lookup cache
already answers a repeated ISBN with no outside call. Three gaps remained:

- Two lookups of one ISBN at the same time: the server now runs one per ISBN.
- A camera lookup sent the moment its ISBN was confirmed: it now waits 600
  ms first, so a corrected misread is never sent.
- A request even for an answer the page just had: the Add page now keeps
  each visit's answers.

The browser check found the scanner skipping reads during the settle; that
is fixed. 639 tests. Outcome in brief 18.

## [2026-10-18] decision + build | Brief 19: scan on a press

The owner asked for a button instead of automatic scanning: the read and the
lookup only on a press. Recorded as the decision "The camera reads only on a
press". The camera still shows, so the owner can aim. *Scan the barcode*
reads until two reads agree, for up to 3 s; "No barcode read" after that,
with nothing sent.

This undoes brief 17's replaceable result and read pace, and brief 18's
600 ms wait. Kept from them: two agreeing reads, the page's memo, and one
lookup per ISBN on the server. The glossary drops *Loose sheet*. Checked in
headless Chrome with a fake camera: no reads between presses, two reads and
one lookup per press. 624 tests. Outcome in
brief 19.

## [2026-10-18] revisit + build | Brief 20: the first read wins

The owner said a press doesn't need two agreeing reads: if the ISBN looks
wrong, they press again. A press now takes the first code it reads, and the
ISBN still wins over a sticker. The decision "The camera reads only on a
press" is updated to match. 618 tests. Outcome in
brief 20.

## [2026-10-20] todo | Brief 21: read until the ISBN, and a sharper camera

The owner reported that a press often reads nothing, while the old
continuous scanner read well. The likely cause is brief 19's 3 s window: on
a real phone the tap moves the camera, and it refocuses. They asked for a
press that reads until it finds the ISBN, then stops. They also asked
whether the soft picture is Shelfmark's or the browser's. The research is in
[scanning.md](wiki/scanning.md), "Camera quality": we ask for only 1280×720,
with no focus or zoom; iPhones switch lenses by themselves near a book;
Chrome on Android lets a page set focus and zoom. Brief 21 drops the 3 s
deadline, adds *Stop reading* and a 60 s limit, asks for 1080p, adds focus
and a 2× zoom where the camera offers them, and adds a `?camera` readout so
the owner's phone can settle the question. Spec in
brief 21.

## [2026-10-21] revisit + build | Brief 21: read until the ISBN, and a sharper camera

A press of *Scan the barcode* now reads until it reads a code, with no 3 s
deadline. While it reads, the button says *Stop reading*. A minute with
nothing read stops it, for the battery, with "Nothing read for a minute". A
sticker read first now waits 1 s for an ISBN, not 450 ms. The decision "The
camera reads only on a press" is updated: its "for at most 3 s" is gone.

The camera now asks for 1920×1080, sets continuous focus when the camera
lists it, and shows a 1× / 2× zoom chip (starting at 2×) when the camera
zooms to 2. `?camera` on the Add page shows the camera's numbers, for the
owner's phone to settle whether the soft picture is the stream or the lens.

Checked in headless Chrome with a fake camera: a press over a blank picture
read the book at about 8 s and sent one lookup; *Stop reading* stopped the
reads; a blank-only camera stopped at 60 s. 633 tests. Outcome in
brief 21.

## [2026-10-23] todo | Brief 22 filed: Base UI for the widgets

The owner asked for Base UI in the apps that still hand-build their widgets.
Brief 22 moves the menu, the Filter and
Columns panels, Change password, the Add tabs, the segmented control and two
disclosures to Base UI. TanStack Table and the native inputs stay.

## [2026-10-23] done | Brief 22: Base UI for the widgets

Brief 22 is built. The menus, the
Filter/Columns panels (a modal Popover on the desktop, a Dialog sheet on a
phone), Change password, the mode tabs, the segmented controls and Change
cover are on Base UI.

Four things needed code:

- Done is the popover's close part, which Base UI requires before it traps
  focus;
- menu items run from `finalFocus`;
- mode tabs don't take focus on a mouse press;
- an Esc a control already used is left alone.

The re-lookup stays a plain button. Checked: 633 tests, typecheck, lint,
build (+56 kB gzip), and before/after shots at 1440 and 390 px. The decision
is in [decisions.md](wiki/decisions.md).

## [2026-10-23] todo | Briefs 23–28: the v1.x todos

All six v1.x todos are now briefs, one wave each, in this order:
23 the wishlist as Owned / Wishlist tabs and "I bought
it" (the `collection` column and `wishlisted` lookups already exist);
24 an IndexedDB copy of the owned ISBNs answers
a scan with no signal; 25 offline scans wait and
are looked up one at a time when back online, through the server's queues;
26 row selection and one `POST /api/books/bulk`
transaction; 27 named views stored on the server;
28 CSV import with encoding detection, from the account
menu, lookups only for ISBN-only rows. The three "later" todos wait on the owner: the
stats page needs a home that keeps "Two places only", the CIP photo needs OCR or Claude
chosen, and the Atrium link needs a shape.

## [2026-10-23] decision | Stats open from the account menu; brief 29

Asked where stats should live under "Two places only", the owner chose an item in the
account menu, over a button over the Library table or a third tab. The rule stands.
Brief 29 counts owned books in the browser, with no server
route, and links each count to Library with that filter.

## [2026-10-23] decision | The CIP photo is read by OCR in the browser; brief 30

Asked what reads a photo of a book's CIP block, the owner chose Tesseract in the browser,
over Claude on the server or dropping the feature: free, private and offline. Brief 30
moves `readDescription` from the CIP list parser into `shared/` so the browser reads the
OCR text with the same tested code, and serves Tesseract and its Romanian data from the
app's own origin.

## [2026-10-23] decision | Revisit: no Atrium link; the apps stay independent

The owner dropped the Atrium link todo: Shelfmark and Atrium are independent products for
now, and may be merged once both are mature, when the owner says so. "Physical books only"
in [decisions.md](wiki/decisions.md) no longer allows a link to an Atrium copy, and
features.md lists it under Out. No todos are left.

## [2026-10-23] done | Brief 23, the wishlist

Library got Owned / Wishlist tabs, the scan sheet "Add to wishlist" and "I bought it" (scan
sheet and book page, one PATCH to owned with a shelf and today's `acquiredOn`). No migration.
Brief 23 has the outcome; features.md, library-table.md,
data-model.md and design.md caught up.

## [2026-10-23] done | Brief 24, offline "do I own this?"

The page keeps `{ isbn13, title, shelf, collection }` for every book in IndexedDB, rewritten
whole whenever the library list loads or changes, and a scan whose lookup gets no answer
(a `network` error) is answered from it: already on a shelf, on the wishlist, or not in the
library, as of the copy's date, said plainly to be the offline answer. Sign out clears it.
The service worker and the server are untouched. Brief 24
has the outcome; features.md and scanning.md caught up.

## [2026-10-23] done | Brief 25, offline scan queue

An offline scan of a book not in the copy can be queued ("Look it up later", with a shelf) in
a second IndexedDB store; the queue survives a reload and shows as "Waiting to look up (N)"
on Add a book. Online (app start and the `online` event) the ISBNs are looked up one at a
time through `POST /api/lookup`, and each opens as the usual sheet to confirm; nothing found
opens the by-hand form with the ISBN filled. Sign out clears it. The service worker, the
server and `books/store.ts` are untouched. Brief 25
has the outcome; features.md and scanning.md caught up.

## [2026-10-23] done | Brief 28, CSV import

"Import a CSV" in the account menu opens an import screen (route `import`, under Library; not a
third place). The file's encoding is detected (UTF-8, then windows-1250, then windows-1252,
UTF-16 by its mark) and named; Goodreads, LibraryThing, Libib and Shelfmark-export headers map
themselves, any other file gets a mapping step. The preview flags rows already in the library,
repeated, with an invalid ISBN or needing a lookup, and rows can be unticked. Optional lookups
run one at a time with a Stop button; ticked rows are saved one `POST /api/books` at a time into
Owned or Wishlist, with saved / skipped / failed counts. No server change, no new dependency.
Brief 28 has the outcome; features.md and import.md caught up.

## [2026-10-23] done | Brief 29, Stats

"Stats" in the account menu opens a stats screen (route `stats`, under Library; not a third
place). Owned books only, counted in the browser: totals, ranked top-10 lists of authors,
languages, shelves (by room), status and decades, and money spent per year per currency with a
footnote for books missing a price or date. Each count sets one Library filter through the
existing `setFilter` and opens Library on Owned; no change to `web/src/library/`. No server
change. Brief 29 has the outcome; features.md caught up.

## [2026-10-23] done | Brief 27: saved views

Named views of the Library (tab, filters, sort, columns) stored on the server in
`saved_views` (migration 3) behind `/api/views`, applied from a Views menu.
Brief 27 has the outcome. Built in a worktree and
cherry-picked as `2b422c7`. Gates on its base: typecheck, lint, build, 778 tests (the
"3,000 books in under 100 ms" timing test flakes under load and passed alone).

## [2026-10-23] resume | Paused for quota: briefs 26 and 30 left

Done today: 23 wishlist, 24 offline owned check, 25 offline scan queue, 27 saved views,
28 CSV import, 29 stats (all committed on `main`, not deployed).

**In the working tree, uncommitted: brief 30 (CIP photo), stopped mid-way.** The parser
move is done and green: `readDescription`, `romanian` and the ISBN pattern now live in
`shared/src/cip.ts` (exported as `cip` from `shared/src/index.ts`), the server imports
them back, `shared/src/cip.test.ts` is new. `web/package.json` and `package-lock.json`
were being changed for Tesseract.js when it stopped: check them before going on. Left:
the OCR worker in `web/src/ocr/`, serving Tesseract and the `ron` data from the app, the
service worker's runtime cache, the button on the manual form, fixtures, closeout.

**Not started: brief 26 (bulk edit).** Its agent was stopped before writing anything.
Run it on top of brief 27; its prompt should carry 27's Toolbar / LibraryPage layout
(Views after the Table/Covers control on the desktop; on a phone at the end of the tabs
row) and say not to add the checkbox column to `LIBRARY_COLUMN_IDS`.

**Wiki folds owed for 27:** `data-model.md` (the `saved_views` table, why `name_key`),
`library-table.md` ("Layout memory": views are on the server now; where the menu sits),
`features.md` (saved views shipped), and one line in `export.md` (the backup includes
views). Root `DESIGN.md`'s toolbar lines need the phone placement.

**Review owed** for 23–30 once 26 and 30 land: no browser walk yet for the wishlist sheet,
the offline answers and queue (IndexedDB never ran in a browser), CSV import or stats.
Known small items: the filter panel and column picker still list the wishlist-hidden
columns; a stale comment in `web/src/library/columns.ts`; `conflict: 409` belongs in
`server/src/errors.ts`; the timing test in `server/src/routes/books.test.ts` flakes under
load; status.md's "waves run one at a time" line is out of date (pairs ran in parallel).

## [2026-10-23] done | Brief 30: reading the CIP block from a photo

"Read the CIP block" on the by-hand form: a photo of the copyright page (a box around the
block optional), Tesseract.js 7.0.0 with the `ron` data in a worker, the description found in
the OCR text and read with the list parser, now in `shared/src/cip.ts`. It fills only empty
fields and marks them to check; the OCR text stays under a disclosure to fix and fill again,
or to copy when there is no "Descrierea CIP" heading. Every Tesseract file is served from the
app under `ocr/<name>-<hash>/` (no CDN), not precached, and cached by the service worker on
first use: 4.8 MB a device. Sauvola thresholds, since the default lost words under a shadow.
Brief 30 has the outcome, [cip-photo.md](wiki/cip-photo.md)
the detail; features.md, scanning.md, metadata-lookup.md and the glossary caught up.

Gates: typecheck, lint, build, 800 tests (the "3,000 books in under 100 ms" timing test
failed under the full run and passed alone). Owed to the review: real camera photos for the
fixtures (the five are renders of real descriptions), a phone walk (iOS Safari: the photo
input, the box drag, whether its service worker serves the Tesseract worker's requests
offline), and the network panel during a read.

## [2026-10-23] done | Brief 26: bulk edit from the table

Select rows (a box per row and a header box over the rows on show; a long press in the
covers), then move them to a shelf, set their status, add or remove tags, or delete them,
from a bulk bar that stands in for the toolbar until Clear. Each change is one
`POST /api/books/bulk` transaction; an unknown id is a `400` and nothing changes; a shelf
change skips wishlist books and says how many. Brief 26 has
the outcome. Built in a worktree on branch `brief-26` from `6ae6a2e`, code commit `fe7d22a`,
cherry-picked onto `main` as `f6ed569`. Gates: typecheck, lint, build, 818 tests (the
"3,000 books in under 100 ms" timing test flaked under load and passed alone).

The wiki folds owed for brief 27 are in: `data-model.md` (`saved_views`, why `name_key`),
`library-table.md` (layout memory, where Views sits, plus selection and the bulk bar),
`features.md` (saved views and bulk edit shipped), `export.md` (the backup holds views;
`backup.ts` copies the whole database). Root `DESIGN.md` has Views on both layouts, the
Owned / Wishlist tabs (its "not built" line was stale) and the bulk bar. Still owed: the
browser walk for 26 (both layouts, the long press on a real phone), with the review of 23–30.

## [2026-10-23] review | Briefs 23–30, in the browser

Walked on the dev server with a scratch database and a throwaway account (desktop
1280 px and phone 390 px, headless Chrome): CSV import (a 40-row Goodreads file, all
saved), stats (counts and the "no price or date" footnote), bulk edit (tags matched
case-insensitively and added once; a search-scoped select-all moved only the 7 rows on
show; delete named the count and said there is no undo; a simulated long press on a
cover selected it on the phone and the bar turned into Actions and Clear), the CIP
reader on a fixture photo (all five fields filled and marked), the offline answer
("Already on Hall · A1" from IndexedDB with the network off), the scan queue (queued
offline, looked up by itself on reconnect), and "I bought it" on a wishlist book.
Merged `main` passed typecheck, lint, build and 838 of 839 tests; the timing test
failed under load and passed alone (852 ms of test time).

Fixed in the review: the Filter panel, its sort list and the column picker no longer
list the four columns a wishlist book never fills; `conflict: 409` is in
`server/src/errors.ts` and the views route throws it; the Move and Remove tags dialogs'
counts are heard as "Bedroom · B1, 5 books" and "signed, on all"; the queue's line
says "Ready to confirm (N)" once every scan is answered; a stale comment in
`columns.ts`; status.md's waves line. Two todos filed:
[bulk-bar-stays-in-view](todos/bulk-bar-stays-in-view.md) (the bar scrolls off when
ticking rows further down) and subtitle-on-the-by-hand-form.

Still owed, needing a real phone or the owner: the long press with iOS and Android's
own menus, the photo picker and box drag, real camera photos for the CIP fixtures,
whether iOS Safari's service worker answers the Tesseract worker's requests offline,
and the timing test that fails under a parallel load.

## [2026-10-23] decision | The bulk bar stays put; the subtitle gets a field

Asked about the review's two todos. The bulk bar keeps scrolling with the page:
the owner chose that over pinning it under the top bar, or in place of the phone's
bottom nav, and the todo [bulk-bar-stays-in-view](todos/bulk-bar-stays-in-view.md) is
dropped. The subtitle gets an optional field under Title on the by-hand form, filled
from the CIP block and marked to check, over saving it unseen or leaving it to Edit:
brief 31. Writing it found that a
lookup draft's subtitle is today saved as a hidden detail from "Edit details", so 31
moves it into the field as well.

## [2026-10-23] done | Brief 31: a subtitle field on the by-hand form

An optional Subtitle field under Title on the by-hand form. "Read the CIP block" fills and
marks it like the others, and "Edit details" on a found book shows the draft's subtitle in it
instead of saving it unseen. On the way, the reader takes an author's name off the end of the
title part when the OCR lost the " / " before it (fixture `2-popa`). Checked with typecheck,
lint, build, 840 tests and a browser read of `2-popa.jpg` at 390 px; the saved book had the
subtitle. Brief 31. Built inline.

The timing test passed in the full run on an idle machine (load 0.64): its earlier failures
came from the trips agent building alongside, so it stays as it is.

## [2026-10-24] done | Brief 32: change the username

The owner asked for a way to change their username. The vendored ward-auth had no
rename, so the owner chose to put it in the library rather than have Shelfmark write
`auth_users` itself. It was built in `wzd_auth` as ward-auth 0.4.0 (its brief 37,
commit `22251c4`), then re-vendored here. "Change username" now sits at the top of
the account menu with the signed-in name as its detail. It opens a one-field dialog
in the shell it now shares with Change password (`account/AccountDialog.tsx`). The
id and every session stay. On the way, both dialogs' Done buttons got focus, which
had fallen to the panel after a save. owner-setup says to give the seed the new name
after a rename, since the seed matches by name. Checked: typecheck, lint, build,
tests, and a browser walk at 1280 and 390 px on a scratch database.
Brief 32. Built inline.

## [2026-10-24] decision | Only lightweight tests

The owner asked to drop the heavy tests and keep the lightweight ones, then chose
to drop every test that boots the app: `app.test.ts`, `seed.test.ts`, the route
tests for books, covers, lookup, views and backup, and their harness
`testing/testApp.ts`. They held about 130 tests and 36 of the suite's 39 seconds.
The 3,000-book timing test among them had failed twice that day under load and
passed alone. `npm test` now runs 715 tests in about 3 s. Rejected: dropping only
the timing and seed tests, and an opt-in `test:heavy` script. The routes, the
guard, sign-in and the seed are now checked by hand.
[decisions.md](wiki/decisions.md) has the entry.

## [2026-10-24] deploy | Briefs 15–32 live

The owner deployed. The deploy mirrors the local tree, so the commits not yet
pushed went too. Checked read-only over SSH: the API container restarted
healthy with ward-auth 0.4.0, and the current web release has Change username.
The new container's first CIP refresh found 82 issues on the site and 0 to
import, so the index on the data volume is complete. From inside the container,
all three libraries accepted a connection on port 9991: the Academy in 168 ms,
BCU Cluj in 134 ms, and BCU Timișoara in 5.2 s, against the lookup's 10 s per
library. The in-app lookup of `9786068044873` and the phone checks stay with the
owner.

## [2026-10-31] maintenance | README: deployed, the v1.x features, and new images

A README refresh pass with the readme-docs standard. The README still said version 1 was not deployed and described the library as it was on 2026-10-16. It now says briefs 15-32 went live on 2026-10-24 and lists what briefs 23-31 added: saved views, bulk edits from the table, the wishlist, CSV import, stats, the offline "do I own this?" check, queued offline scans, and reading the CIP block from a photo. All five images were taken again from `docs/images/demo-seed.mjs` on a scratch `DATA_DIR`. The table shot now shows three rows ticked and the bulk-edit bar instead of the Export menu, and the add-a-book shot shows the CIP offer; the catalogs were unreachable from the workspace, so its note says they didn't answer. Checked: `npm ci`, the seed, `npm run dev` on port 5176 and the demo seed. `shots.md` records the Playwright capture.

## [2026-11-02] maintenance | Briefs reset

Part of an estate-wide reset. The thirty-one done briefs and the superseded
17 are folded into the wiki and deleted, with the twenty-three todos they were
promoted from; the two dropped todos (the Atrium link, the pinned bulk bar)
stay as the record of those calls. Brief numbering restarts at 01. The old
briefs read like the grilling that fed the first corpus. The last commit that
held them is `ad0fb1a`: read one with
`git show ad0fb1a:corpus/briefs/done/21-read-until-found.md`. Brief numbers in
the entries above refer to that set.

New page: [overlays.md](wiki/overlays.md), the Base UI move. The other pages
cite dates instead of brief numbers. [status.md](wiki/status.md) is a per-area
snapshot; the phone checks on the scanner and the camera readout, which lived
only in old outcome notes, are now in its "Next (owner)". Code comments no
longer cite brief numbers.


## [2026-11-02] todo | Brief 01 — Pages in the Library

The owner asked for pagination on the books. [Brief 01](briefs/done/01-library-pages.md)
pages the Library in the browser, over the list the client already holds; the
server and the books store are unchanged, since server-side paging stays
rejected ([library-table.md](wiki/library-table.md)). 50 books per page by
default (25 to 200, a pref per layout), the page kept for the session beside
the filters, and the header's box and ", N not shown" keep today's meaning.
That last call is the one to confirm when the brief is grilled.

## [2026-11-02] build | Brief 01 — Pages in the Library

[Brief 01](briefs/done/01-library-pages.md) built in `1a9f484`, on local
`main`, not deployed. The table and the covers show one page of the list the
client holds, 50 by default, with a pager under it; the server and the books
store are unchanged. The page is kept with the tab, search, filters, sort and
size it was turned on, and forgotten when any of them changes. The header's
box and the export still cover every page; whether the box should tick only
the page is the owner's call, not grilled. The pager stays (range and "Per
page" only) when a size over 50 puts more than 50 books on one page, so the
size can go back down. A focus bug at the page's edge was fixed on the way.
Checked with the typecheck, lint, 70 unit tests and a browser walk on a
scratch database, desktop and a Pixel 7 profile. [library-table.md](wiki/library-table.md),
[export.md](wiki/export.md), [design.md](wiki/design.md), `DESIGN.md` and
[status.md](wiki/status.md) say what was built.

## [2026-11-04] todo | Briefs 02 and 03 — the Library after a look at it live

The owner looked at the live Library (a 1920 px desktop screenshot of 665
books, and Covers' "Filter and sort" sheet on the phone) and settled two
briefs in a grill. [Brief 02](briefs/done/02-library-page-and-width.md): 10,
25, 50 or 100 books a page, 10 by default; the header's tick box ticks the
page, with a Gmail-style line offering every page, and a bulk change never
reaches a book off the page unless the owner chose "Select all"; the Library
fills the window on the desktop; its title row sits on a white card; and the
phone's sort picker that floated over the filter rows (two rules sharing
`.library-select`). [Brief 03](briefs/done/03-library-toolbar-groups.md):
the toolbar's buttons in groups instead of one row of identical pills; a
design step with alternatives first, then the owner's pick, then the build.

## [2026-11-04] build | Brief 02 — Ten a page, the page's tick box, the full width, a header card

[Brief 02](briefs/done/02-library-page-and-width.md) built on local `main`,
not deployed. "Per page" offers 10, 25, 50 and 100, 10 by default; a saved
200 reads as 10. The header's box ticks the page; a band above the list
offers every book ("Select all"), then Clear. A bulk change reaches only the
ticked books on the page unless the owner chose "Select all", and the
selection is let go when the page, the sort, a filter, the search, the tab,
the size or a saved view changes ("Select all" outlives a turn). That
reverses the 2026-10-23 rule that the selection survives filtering and
searching; whether it should outlive a filter again is in
[open-questions.md](wiki/open-questions.md). ", N not shown" is gone. The
Library fills the window on the desktop; its header sits on a white card
(edge to edge on a phone, so the toolbar row keeps its width). The phone's
sort picker floated over the filter rows because the table's tick-box
label shared `.library-select`; it is `.library-tick` now. Checked with the
typecheck, lint, 129 unit tests and a browser look on a scratch database
at 1920, 1280, 412, 390 and 360 px. [library-table.md](wiki/library-table.md),
[design.md](wiki/design.md), `DESIGN.md` and [status.md](wiki/status.md)
say what was built. The README images show the old header; a retake is
noted in `docs/images/shots.md`.

## [2026-11-04] design | Brief 03 — the toolbar's alternatives

[Brief 03](briefs/done/03-library-toolbar-groups.md)'s design step: four
groupings of the Library toolbar on the new header card, at desktop and
phone widths, with Shelfmark's tokens and made-up books, in one private
design canvas linked from the brief. A spaces the groups with dividers; B
joins Views, Filter and Columns in one button group; C splits the card
into a row of library actions (Export, Add a book) and a row of list
controls; D makes the tools quiet icon-and-text buttons with Add a book the
only filled control. Nothing is built; the brief stays in `todo/` until the
owner picks.

## [2026-11-04] build | Brief 03 — the toolbar in groups

The owner answered the same day. Toolbar: option A, changed: "A, with
Views/Filter/Columns moved to the end as icons like D; Add a book removed
since the top bar has it; Export in the account dropdown". Export: always
the whole library. Ticks: keep clearing on a sort, filter, search, tab
change and page turn, as built; the open question is closed.

[Brief 03](briefs/done/03-library-toolbar-groups.md) built on local `main`,
not deployed. The header card holds the Table / Covers switch, a hairline
rule, then Views, Filter and Columns as quiet icon-and-text buttons; on a
phone the row is the switch and "Filter and sort". Add a book and Export
left the card. The account menu gained an "Export library" section (Excel
or CSV, every book of both collections with a Collection column first);
the Library's Export menu and its filtered "This view" export are gone,
with the code only they used. Keeping both formats under one heading is a
call made beyond the owner's "one item"; it is in
[open-questions.md](wiki/open-questions.md). Checked with the typecheck,
lint, 140 unit tests and a browser look at 1920, 1280 and 390 px.
[design.md](wiki/design.md), `DESIGN.md`, [export.md](wiki/export.md),
[library-table.md](wiki/library-table.md), [features.md](wiki/features.md),
[status.md](wiki/status.md), the README and owner-setup say what changed.
Two done briefs got link fixes only: brief 02's link to brief 03, and brief
01's link to the removed `ExportMenu.tsx`, now plain text.

## [2026-11-04] decision | "Export library" keeps both formats

The owner answered the question brief 03 left: the account menu's "Export library" keeps its two
choices, Excel and CSV, rather than one row. CSV is what "Import a CSV" reads back. The question is
deleted from [open-questions.md](wiki/open-questions.md); [export.md](wiki/export.md) already
describes it as built.

## [2026-11-09] todo | Brief 04: book recommendations

The owner asked for a page of recommendations drawn from the library that
never repeats a book already in the database. Research for the brief:

- Open Library's search source: its sorts, and the series fields that make
  "next in a series" possible;
- the Romanian catalogs' author search;
- the hallucination record of language-model recommendations;
- lantern's suggestion scoring.

The defaults it builds:

- catalogs only;
- a refresh on a press;
- a third place in the navigation, which revisits "Two places only".

These wait on the owner's grilling on 2026-11-10. See the
[brief](briefs/done/04-wishlist-with-recommendations.md).

## [2026-11-10] todo | Briefs 05-08: the owner's estate calls of 2026-11-09 applied to Shelfmark

The owner decided on 2026-11-09, for every web app: Base UI 1.9.0 pinned
exactly, Tailwind v4 for the whole app, and the researched conventions
enforced in each repo. Four briefs, in order:

- [05 the house style and the quality harness](briefs/done/05-the-house-style-harness.md);
- [06 Base UI by the conventions](briefs/todo/06-base-ui-by-the-conventions.md);
- [07 the web app to Tailwind](briefs/todo/07-the-web-app-to-tailwind.md);
- [08 the server in the code structure](briefs/todo/08-the-server-in-the-code-structure.md).

No bump brief: `web/package.json` pins 1.9.0 and the lockfile resolves 1.9.0.
Measured on a scratch copy (nothing in the repo changed). The numbers that
differ from the estate drafts:

- Prettier width 130 is the least churn: 391 lines in 98 files, and the 13
  JSON fixtures must be ignored.
- `no-non-null-assertion` finds 123 (the estate default assumed about 9).
- The provider's serializer throws on `savedViewSchema`'s transform
  (`shared/src/views.ts:174`), reproduced on zod 4.5.4 and provider 1.0.3.
- `tokens.css` has 86 properties (the draft said 98); 14 keyframes are 7
  distinct animations; the app is one CSS chunk, 76.7 kB raw, 13.4 kB gzip.
- `npm test` fails on a fresh checkout until `shared/dist` is built.

The defaults wait on the owner's grilling of 2026-11-10. Brief 04
(recommendations) is unchanged; whichever lands second adopts the first's
styling and layout.

## [2026-11-10] decision | Brief 04 rewritten as Wishlist; "Two places only" revisited; briefs 05-08 revised; brief 09 added

The owner's grilling of 2026-11-10 (Q36) changed brief 04. The third place in
the navigation is **Wishlist**; it takes the wishlist out of Library and holds
the wished-for books plus the recommendations, with an Add a book button. Where
the picks come from, in order: a spike on the owner's real library of TasteDive
and a small embedding model (all-MiniLM-L6-v2, about 23 MB, run in Node);
otherwise a download of the library with a prompt for Claude and an Import
button for the JSON it returns; and that path stays as a second source if the
spike works. The file is now
[04-wishlist-with-recommendations.md](briefs/done/04-wishlist-with-recommendations.md).

**Revisit:** [decisions.md](wiki/decisions.md) now says "Two places only" was
revisited on 2026-11-10: three places, Library, Add a book and Wishlist, for
the owner's request. The old entry stays. The wishlist wording elsewhere
(design.md, DESIGN.md, PRODUCT.md, import.md) changes when brief 04 is built.

Briefs 05-08 were revised to the owner's and the technical calls: house-style
vendored (05), Prettier width 120 with its one-off cost (628 lines in 140
files), `!` an error in source and a warning in tests, the 7 switch findings
to 0 with `considerDefaultExhaustiveForUnions`; Base UI by the conventions
(06) keeps the inline confirms and the two delete dialogs as dialogs, sets
`disablePointerDismissal` on form dialogs and drops the collection tabs the
Wishlist removes; Tailwind (07) gains the Light / Dark / System switch, moves
the 15 px root onto `body` and takes "close enough" parity; the server (08)
renames the entry and the Dockerfile `CMD` in one commit, keeps "nothing
boots the app" (tests without `inject()`), and puts the transform-free
saved-view output schema in the views feature. Order: 05, 04, 06, 07, 09, with
08 apart from 06 and 07. Brief 09, [a redesign with Hallmark, on the estate
board](briefs/todo/09-a-redesign-with-hallmark-on-the-estate-board.md), covers
Library, Add a book, Wishlist and the rest.

## [2026-11-11] build | The house style and the quality harness

House-style 1.0.0 vendored, Prettier at 120 (one reformat commit, bundle compare: 142 files changed, 5 differ in minified output, all JSX text split by `{" "}` or hex lowercased in `tokens.css`; fixtures untouched), the two tsconfig flags added to the base file (not extended, because of the Dockerfile), the house ESLint config (0 errors, 85 warnings: 80 `!` in tests, 5 `process.env` reads), knip and dependency-cruiser in `check:conventions`, the two checkers `--warn-only` (base-ui 23 findings, structure 31 errors and 11 warnings), `pretest`, `check:fast`, the root `CLAUDE.md` and `.claude/rules/`. Measured: `npm run check` 43 s, `check:fast` 7 s warm with one changed file. Before: ESLint untyped, 0 findings; after the typed house rules: 123 `!` (43 source, 80 test), 9 type assertions, 2 misused promises, 1 floating promise, 3 vitest, 1 console, all fixed except the 80 test `!` warnings.

## [2026-11-11] build | Wishlist is a third place; recommendations by Claude import

Brief 04 built without its spike. Wishlist joins Library and Add a book (the "Two places only" entry in `decisions.md` keeps its 2026-10-14 text and carries the 2026-11-10 revisit, now marked built); the Library lost its Owned / Wishlist tabs, a saved Wishlist tab reads as Owned, and `/library?collection=wishlist` redirects. The Wishlist page shows the wished-for books, an Add a book button that saves into the wishlist (`/wishlist/add`), and Recommendations: download the library CSV, copy the prompt, import Claude's JSON. Each pick is checked in Open Library and never shown if not found; the dedup (ISBN, work key, title key, dismissal) runs on import and on every read. Migration 4 adds `recommendations`, `recommendation_dismissals` and `catalog_query_cache`. Not done: the TasteDive and embedding spike (needs the owner's library and judgment, filed as a todo), the profile and Refresh with it, and the capped title search for library books with no cached work key. Tests are unit tests with no network; the two Open Library answers are shaped from the documented fields, not recorded. Typecheck, lint, tests, build, conventions pass; no screenshots taken.
