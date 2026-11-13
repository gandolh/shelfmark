---
summary: How Shelfmark's look was chosen and why (owner, 2026-10-14). The familiar table app played straight, in the Covers variant (calibrated on Apple's own apps; the cover leads, chrome recedes, one teal accent, light). The original token table, the three-place navigation (Library, Add a book, Wishlist; two places until 2026-11-10) with an account menu instead of Settings, the library table and covers grid, the Add a book flow and its three scan outcomes, the mock-ups, and the 2026-10-15 finish review. The Library's header card, full width and toolbar (2026-11-04). The system as built is DESIGN.md at the repo root. Read before any UI brief.
updated: 2026-11-13
---

# Design

**The design system as built is [DESIGN.md](../../DESIGN.md)** at the repo
root (with its sidecar `.impeccable/design.json`), written on 2026-10-15
from the shipped UI; its tokens equal
the `@theme` block of [index.css](../../web/src/styles/index.css). Build against DESIGN.md. This
page keeps how the look was chosen, what the owner decided, and the finish
review. Where the two disagree, DESIGN.md and the code win.

Chosen on 2026-10-14 through two rounds on the design canvas (private artifact,
<https://claude.ai/artifact/CqxmMKHrx4wgk4wZkF6C7D>):

1. **Direction round** (impeccable, seed `ac946dc9`): Dictionary (the roll),
   Ledger (impeccable's pick), Departures (split-flap challenger) and the
   standard. The owner chose **the standard**: a familiar table app, played
   straight.
2. **Variant round** (design-md-library references): Calm (after Notion), Grid
   (after Airtable), Covers (after Apple's own apps). The owner chose
   **Covers**.

The canvas page "The standard: variants" holds the chosen artboards:
`Covers-Desktop`, `Covers-Library`, `Covers-Add`. The scan outcomes they don't
show are on the other variants' Add screens (`Calm-Add`: found;
`Grid-Add`: not found), to be redrawn in this world. Why it won and what lost
is in [decisions.md](decisions.md).

## The one borrowed move

From the Apple reference: **the object leads, the chrome recedes.** The cover
is the only thing with a shadow; controls are flat fills on a quiet ground;
one interactive colour; no decorative gradients. Only the relationships are
borrowed. The values below are Shelfmark's own, and nothing ships Apple's
palette, type or marks.

## Tokens

| Token | Value | Use |
|---|---|---|
| `ground` | `#F5F5F3` | page background (neutral off-white) |
| `surface` | `#FFFFFF` | table container, menus, sheets |
| `control` | `#E6E6E2` | segmented controls, secondary buttons |
| `field` | `#E9E9E6` | search field |
| `hairline` | `#E2E2DF` | top bar and tab bar borders |
| `divider` | `#ECECE9` | table row dividers |
| `ink` | `#1B1B1D` | primary text |
| `ink-2` | `#45454A` | secondary text |
| `muted` | `#5F5F65` | captions, counts (5.6:1 on `ground`) |
| `accent` | `#0E6E8C` | the one interactive colour: primary button, links, active tab, "Reading" |
| `accent-press` | `#0A4F65` | pressed, link hover |
| `accent-tint` | `#DCEDF2` | open menu button, selected menu row (`#EDF5F8`) |

- **Type (2026-11-13):** Public Sans (`font-sans`) for the controls and
  Literata (`font-book`) for page titles, section heads, a book's title in a
  row and the wordmark, both self-hosted. Sizes 12 14 16 20 32 (28 title on a
  phone), body 16, tabular figures only for the Year column, the pager and the
  ISBN field. _History: the system stack, page title 34 px / 700 / -0.02em,
  body 15 px, until the Covers, typeset redesign._
- **Radii:** covers 3 px; controls 8 px; segmented tracks 10 px; pill buttons
  full; table container 16 px; floating sheet 20 px.
- **Elevation:** covers `0 6px 14px rgba(27,27,29,.22), 0 1px 2px
  rgba(27,27,29,.2)`; menus and the scan sheet `0 16px 40px
  rgba(27,27,29,.18)`. Nothing else casts a shadow.
- **Theme:** light on a first visit, with a Light / Dark / System choice since
  2026-11-12 (see [decisions.md](decisions.md)). The camera view is dark in both
  because it is a camera.

## Navigation

Three places: **Library**, **Add a book** and **Wishlist** (two until
2026-11-10; see [decisions.md](decisions.md)).

- Desktop: a top bar in three columns: wordmark left, the three places as a
  segmented control in the centre, search and the account button right.
- Phone: a three-tab bar at the bottom.
- **No Settings tab.** The account button opens a menu with: change username
  (its detail is the name signed in, since 2026-10-24), change password, Sign in
  with Ward (linked or not), import a CSV, stats, download a backup (the
  database file), "Export library" (since 2026-11-04), sign out.
- **No loans** at all (owner, 2026-10-14).
- **Wishlist** is a place (since 2026-11-10, built 2026-11-11): the wished-for
  books as covers, an Add a book button that lands in the wishlist, then the
  recommendations ([recommendations.md](recommendations.md)). Library holds
  the owned books only; the Owned / Wishlist tabs went.

## Library

- Title, count and sort ("14 books, newest first"); on the right, as first
  drawn, a **Table / Covers** switch, Filter, Export and the accent "Add a
  book" pill. Since 2026-11-04 the right holds only the switch and the list
  tools (below).
- **Table** (desktop default): one white rounded container; the first column
  is the book itself, cover (46×69) plus title over author; then publisher,
  year, shelf, status, added. More columns come from the column picker. Status
  is plain text; "Reading" is accent and semibold.
- **Covers** (phone default): a three-column grid of covers with a two-line
  title and the author underneath.
- Filtering by any column follows [library-table.md](library-table.md): Filter
  opens a column list, then that column's filter; active filters show as
  removable chips under the toolbar. The mock-up shows only the button; the
  chip row is the build's to draw in this world.
- Export: since 2026-11-04 one place, "Export library" in the account
  menu, as Excel (.xlsx) or CSV, always every book whatever the Library
  shows (the owner's call). The toolbar's Export menu ("This view" and
  "Every book, every field") is gone ([export.md](export.md)).
- Pages (2026-11-02): the pager under the list; DESIGN.md's Library bullets
  hold its look ([library-table.md](library-table.md)).
- **Full width and a header card** (owner, 2026-11-04, from a 1920 px
  screenshot where the table scrolled sideways with empty space either
  side). On the desktop the Library runs the window's width less the 40 px
  gutters; every other page keeps the 1180 px column. The title, caption and
  toolbar sit on a white card like the table's container (`surface`, 16 px
  radius, flat); on a phone the Views row stays on the ground under it. On a
  phone the card runs edge to edge with its lower corners rounded, so the
  toolbar row keeps the width it had.
- **The toolbar** (owner, 2026-11-04, [brief 03](../briefs/done/03-library-toolbar-groups.md)).
  The owner wanted the row of like grey pills visually separated. Of four
  alternatives the owner took A (spaced groups) and changed it: "A, with Views/Filter/Columns
  moved to the end as icons like D; Add a book removed since the top bar has
  it; Export in the account dropdown". So the card holds the Table / Covers
  switch, a hairline rule, then Views, Filter and Columns as quiet
  icon-and-text tool buttons in ink-2. On a phone "Filter and sort" ends the
  row in the same look, and Views (the same look) ends the tabs row.
  Not taken: B (one joined button group), C (two rows in the card), and
  the rest of D (an icon-only view switch).
- The "Select all" band above the list (2026-11-04) wears the selected
  row's faint teal wash with the action as accent text.

## Add a book

- One screen with a segmented switch: **Scan**, **Type ISBN**, **By hand**.
  The scanner never navigates while the camera runs
  ([scanning.md](scanning.md)).
- The camera fills the screen; the result floats over it in a white 20 px
  sheet with the cover, then the action. Three outcomes:
  - **Found:** confirm the book, then pick shelf and status with chips.
    Primary action: "Save and scan the next one".
  - **Not found:** say which sources were tried, then show a short form
    (title required; author, publisher, year optional; shelf). Offer "take a
    photo of the front" when there is no cover.
  - **Not owned yet** (wishlist on): a found book can go to the wishlist
    instead: "Add to wishlist" sits next to "Save to a shelf". A scanned book
    already on the wishlist offers "I bought it".
  - **Already owned:** "Already in your library" with shelf and date added.
    Primary action: "Scan the next one"; then "Add another copy", "Open the
    book".
- "Not this book" or "Discard this scan" sits apart from the primary action.

## Open design work for the build (done)

What the mock-ups left open, as the v1 briefs drew it (DESIGN.md has the detail):

- A **no-cover placeholder** in this world. Free databases miss most Romanian
  covers ([metadata-lookup.md](metadata-lookup.md)), so it is common: a
  typographic cover (title and author on one of eight tints picked from the
  title), not a grey box.
- The book page, the filter chip row, empty and loading states, and the
  account menu. The Owned / Wishlist tabs shipped on 2026-10-23 and went on 2026-11-11 when Wishlist became a place.
- `DESIGN.md`, written from the built UI on 2026-10-15 (below).

## Finish review (2026-10-15)

Impeccable's finish reviewer, run fresh over desktop (1440) and phone (390)
captures with 40 seeded books, against this page and the mock-ups'
measurements (code-led build, no approved comp). Detector: no findings.

- Round 1, `fix`, seven material fixes: the phone Library toolbar became one
  quiet row (Export as accent text, Columns moved inside "Filter and sort");
  the book page's fact values lost the browser's 40 px `dd` indent and its
  header actions now end at the cards' edge; the desktop Add a book mode
  switch moved from the far right into the content column; the Year column
  widened to 80 px so its sorted header fits; the offline notice no longer
  collides with the login heading; the app icon was redrawn (books on a
  shelf, one leaning) because the old three spines read as a bar chart.
- Verdict pass: all seven resolved, `ship`.
- Judged fine as built: the 260 px book-page cover ("the cover leads"), and
  the three chip styles (toggle, tag, filter chip), which read as one family.
- Answered 2026-11-13 (the redesign): at 72 px and under a no-cover placeholder shows the title's first letter. Was left for the owner: whether the 46×69 table placeholder should drop its
  title and author for a simpler mark (real covers are just as unreadable at
  that size, and a miniature keeps a book the same in Table and Covers);
  whether the desktop Add result should show a larger cover than the phone
  sheet's 60×90; and a look at the Sign in with Ward states, which the review
  could not capture without Ward configured.

## Covers, typeset (2026-11-13)

The redesign built for brief 09 is recorded in [DESIGN.md](../../DESIGN.md) (its last section) and the decision in [decisions.md](decisions.md). The tokens are in `web/src/styles/index.css`; `e2e/` holds the browser checks.
