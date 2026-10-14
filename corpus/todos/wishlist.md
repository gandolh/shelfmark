---
title: Wishlist
created: 2026-10-14
status: open
tags: [v1.x]
---

# Wishlist

Books the owner wants but doesn't own. Library gets two collections, Owned and
Wishlist, as tabs under the page title; the same table, covers, filters and
export work on both. When a scanned book is not owned, the confirm sheet offers
"Add to wishlist" next to "Save to a shelf"; scanning a wishlisted book offers
"I bought it", which asks for a shelf and moves it to Owned.

## Context

The owner wants it (2026-10-14). Never a third place in the navigation
([decisions.md](../wiki/decisions.md)). Storage: `collection = 'wishlist'` rows
in `books` ([data-model.md](../wiki/data-model.md)); look in
[design.md](../wiki/design.md). Pairs with
[offline-owned-check](offline-owned-check.md): in a bookshop, "not owned" is
the moment to wishlist.
