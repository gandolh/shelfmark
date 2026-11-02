---
summary: Snapshot as of 2026-11-02, per area. v1 built 2026-10-14/15; Romanian catalogs and the CIP index 2026-10-17; the scanning changes to 2026-10-21; Base UI and the v1.x set 2026-10-23; change the username 2026-10-24; pages in the Library 2026-11-02 (built, not deployed). Deployed 2026-10-24 and pushed. What waits on the owner (a lookup check, the phone checks on the scanner and the camera readout, the CIP photos, the owner-setup checks).
updated: 2026-11-02
---

# Status

_2026-11-02_. Everything is on `main` and pushed through `29bdad1`
(2026-11-01). Deployed on 2026-10-24 with everything through the change of
username. Brief numbering restarted at 01 on 2026-11-02 (see
[log.md](../log.md)). Brief 01,
[pages in the Library](../briefs/done/01-library-pages.md), was built on
2026-11-02 on local `main`, not pushed and not deployed; no brief waits. The product calls are in
[decisions.md](decisions.md), the look in [design.md](design.md) and
`DESIGN.md`, and the run's rulings in [log.md](../log.md).

## By area

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
- **Widgets** (2026-10-23). Base UI under the menus, panels, dialog and
  switches ([overlays.md](overlays.md)).
- **v1.x** (2026-10-23). Wishlist, offline "do I own this?", the offline scan
  queue, bulk edit from the table, saved views, CSV import, stats, a CIP
  block read from a photo ([cip-photo.md](cip-photo.md)), a subtitle field on
  the by-hand form.
- **Change the username** (2026-10-24), on ward-auth 0.4.0.
- **Pages in the Library** (2026-11-02). The table and the covers show 50
  books a page by default, with a pager under the list; the header's box and
  the "This view" export still cover every page
  ([library-table.md](library-table.md)). Web only; not deployed.

## Next (owner)

1. **Deploy the pages** (web only, no server change), from `vps-deploy`:
   `node cli.ts shelfmark deploy`. Then on the Android phone: the pager at
   the end of the covers above the tab bar, Next and Previous, "50 per page",
   and Back from a book on page 3. Say whether the header's box should tick
   only the page instead (it ticks every page now).
2. The Google Books key is in the deploy secrets, and the Romanian
   measurement ran on 2026-10-17 (Google found none of 80;
   [metadata-lookup.md](metadata-lookup.md)).
3. **Deployed 2026-10-24** with everything since v1 (the owner ran it; the deploy
   mirrors the local tree, so the unpushed commits went too). Checked read-only
   the same day: the container runs ward-auth 0.4.0 and the web release has
   Change username. The first CIP refresh found 82 issues and 0 to import.
   The container reaches all three libraries on port 9991, but BCU
   Timișoara took 5.2 s to connect, against a 10 s budget per library.
   Left for the owner: look up `9786068044873` in the app (it should say the
   Romanian Academy Library), and the phone checks below.
4. The checks no agent could run here, listed in owner-setup: the scanner on
   an Android phone and an iPhone, the PWA install, the local Ward round trip
   (needs Docker Desktop's WSL integration), the exports opened in Excel. The container build was checked locally
   on 2026-10-17, poppler-utils included.
5. **Phone checks on the scanner** (after the deploy):
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
6. **The CIP photo:** a few real photos of copyright pages, re-read with
   `web/src/ocr/fixtures/record.ts`, and a walk on the phone; the fixtures so far are
   renders ([cip-photo.md](cip-photo.md)).

## Todos

None open. The Atrium link and the pinned bulk bar were dropped on
2026-10-23 (their todos record why).
