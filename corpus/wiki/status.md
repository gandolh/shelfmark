---
summary: Snapshot as of 2026-11-04, per area; the Covers, typeset redesign (brief 09) built on local main 2026-11-13, web only, not deployed. v1 built 2026-10-14/15; Romanian catalogs and the CIP index 2026-10-17; the scanning changes to 2026-10-21; Base UI and the v1.x set 2026-10-23; change the username 2026-10-24; pages in the Library 2026-11-02 (pushed); ten a page, the page's tick box, the full width and a header card 2026-11-04 (built, not deployed); the toolbar on the card and "Export library" in the account menu 2026-11-04 (built, not deployed). Deployed 2026-10-24 and pushed. What waits on the owner (a lookup check, the phone checks on the scanner and the camera readout, the CIP photos, the owner-setup checks).
updated: 2026-11-13
---

# Status

_2026-11-04_. Pushed through `306793a` (2026-11-03), which includes brief
01, [pages in the Library](../briefs/done/01-library-pages.md). Deployed on
2026-10-24 with everything through the change of username; the owner's
2026-11-04 screenshots were of the live Library. Brief numbering restarted
at 01 on 2026-11-02 (see [log.md](../log.md)). Brief 02,
[ten a page, the page's tick box, the full width, a header card](../briefs/done/02-library-page-and-width.md),
was built on 2026-11-04 on local `main`, not pushed and not deployed, and so
was brief 03, [the toolbar in groups](../briefs/done/03-library-toolbar-groups.md),
the owner's pick of its alternatives. Brief 04,
[Wishlist, with recommendations](../briefs/done/04-wishlist-with-recommendations.md), was filed on
2026-11-09 and rewritten on 2026-11-10 after the owner's grilling (the third
place is Wishlist); briefs 05-08 (the house style harness, Base UI by the conventions, the web app to
Tailwind, the server in feature folders), filed on 2026-11-10 from the owner's
estate calls of 2026-11-09. The product calls are in
[decisions.md](decisions.md), the look in [design.md](design.md) and
`DESIGN.md`, and the run's rulings in [log.md](../log.md).

## By area

- **The redesign, "Covers, typeset"** (2026-11-13, brief 09). Tokens, the shell, the Library, a book and Add a book in the new look, the other screens restyled by the tokens; Public Sans and Literata self-hosted; Playwright (`web/e2e/`) checks focus rings, reduced motion, 390 px overflow and targets, and the themes. Built on local `main`, not pushed, not deployed (web client only: `node cli.ts shelfmark deploy`). See [DESIGN.md](../../DESIGN.md) and [decisions.md](decisions.md).

- **Wishlist and recommendations** (2026-11-11, brief 04). Wishlist is the third place; Library holds owned books only; the Claude import path, the dedup and the three tables are built on local `main`, not deployed. The spike of TasteDive and an embedding ranker is not run: it needs the owner's real library and verdict ([recommendations.md](recommendations.md), [todo](../todos/blocked/recommendations-spike.md)).

- **The server in feature folders** (2026-11-12, brief 08). `server.ts` / `app.ts` / `config.ts`, `plugins/` and `features/<name>/`, a response schema on every route but the two byte routes, `check-structure` strict; built on local `main`, not pushed and not deployed. Owner steps: the deploy and the container checks in [the brief](../briefs/done/08-the-server-in-the-code-structure.md).

- **A stop aborts lookups** (2026-11-13, brief 10). A `preClose` hook aborts every outbound lookup in flight (fetches, Z39.50 sockets, queue pauses); the route answers 503. Built on local `main`, not deployed (`node cli.ts shelfmark server`). The recommendations feature's Open Library calls and the CIP refresh have no signal yet.

- **House style** (2026-11-11). Prettier at 120, house ESLint, knip, dependency-cruiser, `npm run check` and `check:fast`, the root `CLAUDE.md` and `.claude/rules/`; built on local `main`, not deployed ([decisions.md](decisions.md)).

- **v1** (2026-10-14/15). The book store and API, ISBN utilities, the app
  shell, the lookup and covers, the camera scanner, accounts and sign-in, the
  Library, Add a book, the book page, export and backup, the PWA, the design
  finish and the deploy; a three-finder review and two fix rounds
  ([architecture.md](architecture.md), [features.md](features.md)).
- **Romanian books** (2026-10-17). Three library catalogs over Z39.50 and the
  CIP index from the national bibliography PDFs
  ([metadata-lookup.md](metadata-lookup.md)).
- **Scanning** (2026-10-17 to 2026-10-21). One lookup per ISBN, scan on a
  press, the first read wins, read until the ISBN is found, a sharper camera
  and the `?camera` readout ([scanning.md](scanning.md)).
- **Widgets** (2026-10-23; by the conventions 2026-11-11). Base UI under the
  menus, panels, dialogs, tabs, toggles and the update prompt, imported only
  under `ui/` folders; built, not deployed ([overlays.md](overlays.md)).
- **Tailwind and the theme** (2026-11-12). The web app is on Tailwind 4: one stylesheet,
  `web/src/styles/index.css`, holds the tokens as `@theme`; no other CSS file. A Light / Dark /
  System choice (account menu, Theme) is kept on the device; light on a first visit. The dark set
  is a first pass for the redesign. Built, not deployed.
- **v1.x** (2026-10-23). Wishlist, offline "do I own this?", the offline scan
  queue, bulk edit from the table, saved views, CSV import, stats, a CIP
  block read from a photo ([cip-photo.md](cip-photo.md)), a subtitle field on
  the by-hand form.
- **Change the username** (2026-10-24), on ward-auth 0.4.0.
- **Pages in the Library** (2026-11-02). The table and the covers show one
  page at a time, with a pager under the list
  ([library-table.md](library-table.md)).
- **Ten a page, the page's tick box, the full width, a header card**
  (2026-11-04). 10, 25, 50 or 100 a page, 10 by default; the header's box
  ticks the page and a band offers "Select all"; a bulk change never reaches
  a book off the page otherwise; the Library fills the desktop window under
  a white header card; the phone's sort picker sits under "Sort by" again.
  Web only; not deployed.
- **The toolbar in groups** (2026-11-04). The card holds the Table / Covers
  switch and, behind a thin rule, Views, Filter and Columns as quiet
  icon-and-text buttons; Add a book and Export left it. "Export library" in
  the account menu writes every book as Excel or CSV
  ([export.md](export.md)); the filtered "This view" export is gone. Web
  only; not deployed.

## Next (owner)

1. **Deploy briefs 02 and 03** (web only, no server change), from
   `vps-deploy`: `node cli.ts shelfmark deploy`. It also brings brief 01's
   pages if they weren't live yet. Then on the Android phone: the white
   header card with Covers / Table and "Filter and sort", Views on the tabs
   row, "10 per page", a long press in Covers and the band's "Select all 10
   on this page" then "Select all", the sort picker under "Sort by", and
   "Export library" in the account menu (open the file). On the desktop at
   full width: the table with no sideways scroll.
2. **Say whether "Export library" should be one row**
   ([open-questions.md](open-questions.md)).
3. The Google Books key is in the deploy secrets, and the Romanian
   measurement ran on 2026-10-17 (Google found none of 80;
   [metadata-lookup.md](metadata-lookup.md)).
4. **Deployed 2026-10-24** with everything since v1 (the owner ran it; the deploy
   mirrors the local tree, so the unpushed commits went too). Checked read-only
   the same day: the container runs ward-auth 0.4.0 and the web release has
   Change username. The first CIP refresh found 82 issues and 0 to import.
   The container reaches all three libraries on port 9991, but BCU
   Timișoara took 5.2 s to connect, against a 10 s budget per library.
   Left for the owner: look up `9786068044873` in the app (it should say the
   Romanian Academy Library), and the phone checks below.
5. The checks no agent could run here, listed in owner-setup: the scanner on
   an Android phone and an iPhone, the PWA install, the local Ward round trip
   (needs Docker Desktop's WSL integration), the exports opened in Excel. The container build was checked locally
   on 2026-10-17, poppler-utils included.
6. **Phone checks on the scanner** (after the deploy):
   - Scan a book, scan another, then the first again: it shows at once, and
     the server log has no second `lookup` line for it.
   - Nothing beeps until you tap *Scan the barcode*. Bring a book in: it reads
     once the barcode is sharp, with no "nothing read" message in between,
     and stops there; *Stop reading* stops it. With a result open the button
     is gone; *Not this book* brings it back.
   - On Android, a "2×" chip under the torch: check whether 2× reads better
     than 1× from about 20 cm. On an iPhone a chip may show too; say if 2×
     looks worse there.
   - In the browser (not the installed app), open Add a book with `?camera` at
     the end of the address and send the readout's four lines: resolution,
     zoom range, focus modes, decode time. Over 150 ms is the cue to crop the
     frame.
7. **The CIP photo:** a few real photos of copyright pages, re-read with
   `web/src/ocr/fixtures/record.ts`, and a walk on the phone; the fixtures so far are
   renders ([cip-photo.md](cip-photo.md)).

## Todos

None open. The Atrium link and the pinned bulk bar were dropped on
2026-10-23 (their todos record why).
