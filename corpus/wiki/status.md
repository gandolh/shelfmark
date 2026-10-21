---
summary: Snapshot as of 2026-10-15. v1 is built - all 14 briefs done, reviewed and committed on main (515 tests), pushed, not deployed. Briefs 15-16 (Romanian library catalogs, the CIP index) 17-20 (one lookup per ISBN, scan on a press, the first read wins) written and built 2026-10-17/18 (618 tests), not deployed. Brief 21 (a press reads until it finds the ISBN; a sharper camera and a camera readout) written 2026-10-20, built 2026-10-21 (633 tests), not deployed. What waits on the owner (Google key, deploy, phone and Ward checks), one line per brief, and the todos left by tier.
updated: 2026-10-21
---

# Status

_2026-10-15_. v1 is built. All 14 briefs were built on 2026-10-14 and
2026-10-15 with `plan-split-dispatch`, one commit per brief on `main`,
followed by a three-finder review and two fix rounds, then impeccable's
design finish ([DESIGN.md](../../DESIGN.md)). 515 tests pass; typecheck,
lint and build are clean. `main` is pushed to the GitHub repo
gandolh/shelfmark, and so is `../wzd_auth`'s local seed entry (`55cf336`).
`../vps-deploy` has no remote; its Shelfmark stack (`1c5438b`) is a local
commit, which is where the deploy runs from. Nothing is deployed. The README
and `docs/` follow the readme-docs standard since 2026-10-16. The
product calls are in [decisions.md](decisions.md), the look in
[design.md](design.md), and the run's rulings in [log.md](../log.md).

## Next (owner)

1. The Google Books key is in the deploy secrets, and the Romanian
   measurement ran on 2026-10-17 (Google found none of 80;
   [metadata-lookup.md](metadata-lookup.md)).
2. Redeploy to ship briefs 15 to 21, then run the two checks in
   owner-setup's "Romanian lookups after a deploy": the libraries over port
   9991, and the first CIP refresh in the logs. The phone checks of briefs 18
   to 21 are in their outcomes. Brief 21's `?camera` readout numbers, sent
   from the owner's phone, decide whether the picture needs more work.
3. The checks no agent could run here, listed in owner-setup: the scanner on
   an Android phone and an iPhone (briefs 07, 09), the PWA install (12), the
   local Ward round trip (06, needs Docker Desktop's WSL integration), the
   exports opened in Excel (11). The container build (14) was checked locally
   on 2026-10-17, poppler-utils included.
4. After v1 ships, promote the v1.x todos below; the wishlist is first in
   line, since the Library already leaves room for its Owned / Wishlist tabs.

## Briefs

| # | Brief | Wave | State |
|---|---|---|---|
| 01 | [Workspace scaffold](../briefs/done/01-workspace-scaffold.md) | 1 | done |
| 02 | [Book store and API](../briefs/done/02-book-store-and-api.md) | 2 | done |
| 03 | [ISBN utilities](../briefs/done/03-isbn-utilities.md) | 2 | done |
| 04 | [App shell, tokens, books client](../briefs/done/04-app-shell-and-tokens.md) | 3 | done |
| 05 | [Lookup and covers](../briefs/done/05-lookup-and-covers.md) | 3 | done |
| 07 | [Camera scanner](../briefs/done/07-camera-scanner.md) | 3 | done |
| 06 | [Accounts and sign-in](../briefs/done/06-accounts-and-sign-in.md) | 4 | done |
| 08 | [Library page](../briefs/done/08-library-page.md) | 4 | done |
| 09 | [Add a book page](../briefs/done/09-add-a-book-page.md) | 4 | done |
| 10 | [Book page](../briefs/done/10-book-page.md) | 5 | done |
| 11 | [Export and backup](../briefs/done/11-export-and-backup.md) | 5 | done |
| 12 | [PWA](../briefs/done/12-pwa.md) | 5 | done |
| 13 | [Design finish and DESIGN.md](../briefs/done/13-design-finish.md) | 6 | done |
| 14 | [Deploy](../briefs/done/14-deploy.md) | 6 | done |
| 15 | [Romanian library catalogs](../briefs/done/15-library-catalogs.md) | 7 | done |
| 16 | [The CIP index](../briefs/done/16-cip-index.md) | 8 | done |
| 17 | [Confirmed reads and live rescans](../briefs/superseded/17-confirmed-reads.md) | 9 | superseded by 19 and 20 |
| 18 | [One lookup per ISBN](../briefs/done/18-one-lookup-per-isbn.md) | 10 | done; the settle undone by 19 |
| 19 | [Scan on a press](../briefs/done/19-scan-on-a-press.md) | 11 | done |
| 20 | [The first read wins](../briefs/done/20-first-read-wins.md) | 12 | done |
| 21 | [Read until the ISBN, and a sharper camera](../briefs/done/21-read-until-found.md) | 13 | done |

Waves run in order; briefs inside a wave can run in parallel. Wave 3 splits
the web foundation from the server lookup and the scanner; accounts wait for
the shell (wave 4) so the login page is in the design's world, and every route
test then moves to a signed-in session in one place.

## Todos left, by tier

| Tier | Todo |
|---|---|
| v1.x | [bulk-edit](../todos/bulk-edit.md) |
| v1.x | [offline-owned-check](../todos/offline-owned-check.md) |
| v1.x | [offline-scan-queue](../todos/offline-scan-queue.md) |
| v1.x | [csv-import](../todos/csv-import.md) |
| v1.x | [wishlist](../todos/wishlist.md) |
| v1.x | [saved-views](../todos/saved-views.md) |
| later | [stats-page](../todos/stats-page.md) |
| later | [cip-photo-capture](../todos/cip-photo-capture.md) |
| later | [atrium-link](../todos/atrium-link.md) |

Every v1 todo is promoted (see the briefs above). The v1.x todos are promoted
after v1 ships, so their briefs can point at real code.
