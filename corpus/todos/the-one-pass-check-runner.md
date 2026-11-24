---
title: The one-pass check runner and the ESLint scripts option
created: 2026-11-24
status: open
tags: [harness]
---

# The one-pass check runner and the ESLint scripts option

On 2026-11-23 the estate's other app repos got a `scripts/check.mjs` runner for `npm run check` (every step runs even
after one fails, one line per step, the whole log kept in `node_modules/.cache/check/last.log`), Prettier's check
with its own cache location and `depcruise --cache`. Shelfmark was mid-brief then and was left out. It also needs
`scripts` in its house-style ESLint `scripts` option, because the runner prints. The skills library's
check-speed page of 2026-11-23 has the details; wicket's or almanac's `scripts/check.mjs` is the model.
