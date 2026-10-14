---
summary: Snapshot as of 2026-10-14. Feature research filed, product questions answered (one user, on the VPS, English UI), UI chosen (the familiar table app, Covers variant), one row per copy, no loans, wishlist wanted, Google Books key accepted; 14 v1 briefs written in 6 waves; no code yet. One line per brief, the waves, and the todos left by tier.
updated: 2026-10-14
---

# Status

_2026-10-14_. The repo holds the corpus and `PRODUCT.md`. The owner answered
the product questions (one user, deployed on the VPS, English interface; one
row per copy, no loans, a wishlist, Google Books with a free key; the name
stays Shelfmark) and
chose the UI after two mock-up rounds: the familiar table app in its Covers
variant, light, with two places (Library, Add a book); see
[design.md](design.md) and [decisions.md](decisions.md). The research is filed in
[features.md](features.md), [metadata-lookup.md](metadata-lookup.md),
[scanning.md](scanning.md), [library-table.md](library-table.md),
[export.md](export.md), [data-model.md](data-model.md) and
[architecture.md](architecture.md). The remote is the
GitHub repo gandolh/shelfmark (set 2026-10-14); the owner pushes. Building
started 2026-10-14.

## Next

1. Owner step before brief 05: create the Google Books API key (steps in
   [brief 05](../briefs/todo/05-lookup-and-covers.md)).
2. Build the briefs wave by wave (`plan-split-dispatch`), with a typecheck,
   lint and test gate between waves.

## Briefs

| # | Brief | Wave | State |
|---|---|---|---|
| 01 | [Workspace scaffold](../briefs/done/01-workspace-scaffold.md) | 1 | done |
| 02 | [Book store and API](../briefs/todo/02-book-store-and-api.md) | 2 | todo |
| 03 | [ISBN utilities](../briefs/todo/03-isbn-utilities.md) | 2 | todo |
| 04 | [App shell, tokens, books client](../briefs/todo/04-app-shell-and-tokens.md) | 3 | todo |
| 05 | [Lookup and covers](../briefs/todo/05-lookup-and-covers.md) | 3 | todo (needs the Google key) |
| 07 | [Camera scanner](../briefs/todo/07-camera-scanner.md) | 3 | todo |
| 06 | [Accounts and sign-in](../briefs/todo/06-accounts-and-sign-in.md) | 4 | todo |
| 08 | [Library page](../briefs/todo/08-library-page.md) | 4 | todo |
| 09 | [Add a book page](../briefs/todo/09-add-a-book-page.md) | 4 | todo |
| 10 | [Book page](../briefs/todo/10-book-page.md) | 5 | todo |
| 11 | [Export and backup](../briefs/todo/11-export-and-backup.md) | 5 | todo |
| 12 | [PWA](../briefs/todo/12-pwa.md) | 5 | todo |
| 13 | [Design finish and DESIGN.md](../briefs/todo/13-design-finish.md) | 6 | todo |
| 14 | [Deploy](../briefs/todo/14-deploy.md) | 6 | todo (the deploy itself is the owner's) |

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
