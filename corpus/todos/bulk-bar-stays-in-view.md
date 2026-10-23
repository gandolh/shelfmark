---
title: The bulk bar stays in view while rows are selected
created: 2026-10-23
status: dropped
tags: [v1.x]
---

Dropped 2026-10-23: the owner chose to leave the bar where it is, over pinning it under
the top bar or putting it in place of the phone's bottom nav. Scrolling back up is the
accepted price.

# The bulk bar stays in view while rows are selected

Found in the browser walk of brief 26 on 2026-10-23. The bulk bar takes the
toolbar's place, above the Owned / Wishlist tabs, and scrolls away with it. On
the desktop table, ticking rows further down the list leaves "3 selected" and
its actions off screen, with only the sticky table header in view. To act, the
owner scrolls back to the top. In a library of a few thousand books that is the
usual case, not an edge case.

Mail clients keep the selection bar in view. Here that means the bar sticks
under the top bar while anything is selected, and the table header
(`--library-sticky-top` in `web/src/library/library.css`) moves down by the
bar's height. On a phone the covers grid has no sticky header, so the bar just
sticks at the top. It is a layout call, so it waits for the owner rather than a
review fix.
