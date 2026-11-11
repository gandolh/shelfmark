---
title: The Table / Covers switch is a RadioGroup
created: 2026-11-12
status: open
tags: [web, base-ui]
---

# The Table / Covers switch is a RadioGroup

Brief 06 kept the Library's Table / Covers `SegmentedControl` on Base UI's `ToggleGroup`, as its own text said. The choice is kept only on the device and switches how one list is shown, and the base-ui skill's rule 16 makes such a control a `RadioGroup`: one Tab stop, arrow keys move and choose, one item always chosen, announced as a radio group. The skill wins over a brief's text.

## What to do

- A `RadioGroup` wrapper in `web/src/components/ui/`, and the `SegmentedControl` on it, with the same look (style on `data-checked`, not `data-pressed`).
- Check by role in the browser: one Tab stop, arrows choose, the chosen view survives a reload.
- Fits before or with brief 07 (Tailwind), which then styles the wrapper once.
