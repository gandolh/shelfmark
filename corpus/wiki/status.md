---
summary: Snapshot as of 2026-10-14. Feature research filed, product questions answered (one user, on the VPS, English UI), UI chosen (the familiar table app, Covers variant), one row per copy, no loans, wishlist wanted, Google Books key accepted; no code and no briefs yet. Lists the captured todos by tier and the next steps (create the Google key, then write the v1 briefs).
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
[architecture.md](architecture.md). Git is initialised on `main` with no
commits and no remote; the owner creates the remote later.

## Next

1. Owner step: create the Google Books API key (steps in the
   [metadata-lookup-and-covers](../todos/metadata-lookup-and-covers.md) todo).
2. Answer the last open question, an existing list to import
   ([open-questions.md](open-questions.md)).
3. Promote the v1 todos to briefs, in the order below. UI briefs follow
   [design.md](design.md); every brief uses [glossary.md](glossary.md).

## Briefs

None yet.

## Todos, by tier

| Tier | Todo |
|---|---|
| v1 | [scaffold-workspaces](../todos/scaffold-workspaces.md) |
| v1 | [book-store-and-api](../todos/book-store-and-api.md) |
| v1 | [metadata-lookup-and-covers](../todos/metadata-lookup-and-covers.md) |
| v1 | [camera-scanner](../todos/camera-scanner.md) |
| v1 | [add-by-isbn-or-by-hand](../todos/add-by-isbn-or-by-hand.md) |
| v1 | [library-table](../todos/library-table.md) |
| v1 | [book-page](../todos/book-page.md) |
| v1 | [export-csv-xlsx-and-backup](../todos/export-csv-xlsx-and-backup.md) |
| v1 | [pwa-shell](../todos/pwa-shell.md) |
| v1 | [accounts-and-sign-in](../todos/accounts-and-sign-in.md) |
| v1 | [deploy](../todos/deploy.md) |
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

The v1 rows are in a sensible build order: scaffold, store, lookup, then the
two ways to add a book, then the table and book page, then export, PWA,
accounts and deploy.
