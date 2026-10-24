---
title: Change the username
created: 2026-10-24
status: promoted
tags: [v1.x]
---

Promoted 2026-10-24 into [brief 32](../briefs/done/32-change-username.md).

# Change the username

The owner asked on 2026-10-24 for a way to change their username. Today the
only way to pick one is the seed, and nothing renames a user afterwards.
Shelfmark's accounts come from the vendored ward-auth library, which owns
`auth_users` and had no rename.

**Owner's call, 2026-10-24:** the rename goes in ward-auth, not in Shelfmark.
It shipped there as 0.4.0 (Ward's brief 37: `renameUser`, `POST /auth/username`,
`useRenameUser`), and Shelfmark vendors that. Rejected: Shelfmark writing
`auth_users` itself with the library's exported folding, which is faster but
ties Shelfmark to a table layout a later upgrade could change.
