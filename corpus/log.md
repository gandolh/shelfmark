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
The remote is the GitHub repo gandolh/shelfmark (set 2026-10-14). Gate
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
  [brief 07's outcome](briefs/done/07-camera-scanner.md)); the Google
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
  committed in `../wzd_auth`. The live Ward round trip waits for Docker.

## [2026-10-15] build | Wave 5, the deploy and the review gate

Briefs 10, 11, 12 built side by side, then 14 (the deploy, prepared only;
committed in `../vps-deploy` too). Then three review finders (server
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
caught up: `main` is pushed, `../wzd_auth`'s `55cf336` too, and
`../vps-deploy` has no remote.

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
[z3950-library-source](todos/z3950-library-source.md).

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
Outcome in [brief 15](briefs/done/15-library-catalogs.md).

## [2026-10-17] build | Brief 16: the CIP index

Built inline. The national library's CIP lists are now a lookup source after
the library catalogs, held in their own `cip.db` (a departure from the brief,
to keep the owner's backup small) and refreshed weekly at the polite pace.
Against the real site, two issues imported (2,951 and 3,000 records), and a
2026 book no library holds came from the index without asking Google. The
image build was checked once the owner started Docker: the same 3,000
records inside it, healthy. 610
tests. Outcome in [brief 16](briefs/done/16-cip-index.md).

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
[brief 17](briefs/superseded/17-confirmed-reads.md).

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
is fixed. 639 tests. Outcome in [brief 18](briefs/done/18-one-lookup-per-isbn.md).

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
[brief 19](briefs/done/19-scan-on-a-press.md).

## [2026-10-18] revisit + build | Brief 20: the first read wins

The owner said a press doesn't need two agreeing reads: if the ISBN looks
wrong, they press again. A press now takes the first code it reads, and the
ISBN still wins over a sticker. The decision "The camera reads only on a
press" is updated to match. 618 tests. Outcome in
[brief 20](briefs/done/20-first-read-wins.md).

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
[brief 21](briefs/done/21-read-until-found.md).

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
[brief 21](briefs/done/21-read-until-found.md).

## [2026-10-23] todo | Brief 22 filed: Base UI for the widgets

The owner asked for Base UI in the apps that still hand-build their widgets.
[Brief 22](briefs/done/22-base-ui-widgets.md) moves the menu, the Filter and
Columns panels, Change password, the Add tabs, the segmented control and two
disclosures to Base UI. TanStack Table and the native inputs stay.

## [2026-10-23] done | Brief 22: Base UI for the widgets

[Brief 22](briefs/done/22-base-ui-widgets.md) is built. The menus, the
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
[23](briefs/todo/23-wishlist.md) the wishlist as Owned / Wishlist tabs and "I bought
it" (the `collection` column and `wishlisted` lookups already exist);
[24](briefs/todo/24-offline-owned-check.md) an IndexedDB copy of the owned ISBNs answers
a scan with no signal; [25](briefs/todo/25-offline-scan-queue.md) offline scans wait and
are looked up one at a time when back online, through the server's queues;
[26](briefs/todo/26-bulk-edit.md) row selection and one `POST /api/books/bulk`
transaction; [27](briefs/todo/27-saved-views.md) named views stored on the server;
[28](briefs/todo/28-csv-import.md) CSV import with encoding detection, from the account
menu, lookups only for ISBN-only rows. The three "later" todos wait on the owner: the
stats page needs a home that keeps "Two places only", the CIP photo needs OCR or Claude
chosen, and the Atrium link needs a shape.

## [2026-10-23] decision | Stats open from the account menu; brief 29

Asked where stats should live under "Two places only", the owner chose an item in the
account menu, over a button over the Library table or a third tab. The rule stands.
[Brief 29](briefs/todo/29-stats.md) counts owned books in the browser, with no server
route, and links each count to Library with that filter.
