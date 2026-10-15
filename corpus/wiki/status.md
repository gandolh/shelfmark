---
summary: Snapshot as of 2026-10-15. v1 is built - all 14 briefs done, reviewed and committed on main (515 tests), not pushed and not deployed. What waits on the owner (push, Google key, deploy, phone and Ward checks), one line per brief, and the todos left by tier.
updated: 2026-10-15
---

# Status

_2026-10-15_. v1 is built. All 14 briefs were built on 2026-10-14 and
2026-10-15 with `plan-split-dispatch`, one commit per brief on `main`,
followed by a three-finder review and two fix rounds, then impeccable's
design finish ([DESIGN.md](../../DESIGN.md)). 515 tests pass; typecheck,
lint and build are clean. Nothing is pushed or deployed. The remote is the
GitHub repo gandolh/shelfmark (set 2026-10-14); the owner pushes. The
product calls are in [decisions.md](decisions.md), the look in
[design.md](design.md), and the run's rulings in [log.md](../log.md).

## Next (owner)

1. Push `main` (Shelfmark), plus the commits made today in `../vps-deploy`
   (the Shelfmark stack) and `../wzd_auth` (the local seed entry).
2. Create the Google Books API key and put it in `.env` as
   `GOOGLE_BOOKS_API_KEY`; then run the Romanian measurement in
   [brief 05](../briefs/done/05-lookup-and-covers.md)'s outcome.
3. Deploy, following [docs/owner-setup.md](../../docs/owner-setup.md).
4. The checks no agent could run here, listed in owner-setup: the scanner on
   an Android phone and an iPhone (briefs 07, 09), the PWA install (12), the
   local Ward round trip (06, needs Docker Desktop's WSL integration), the
   exports opened in Excel (11), the container build (14).
5. After v1 ships, promote the v1.x todos below; the wishlist is first in
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
| later | [cip-bibliography-index](../todos/cip-bibliography-index.md) |
| later | [atrium-link](../todos/atrium-link.md) |

Every v1 todo is promoted (see the briefs above). The v1.x todos are promoted
after v1 ships, so their briefs can point at real code.
