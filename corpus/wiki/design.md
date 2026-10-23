---
summary: How Shelfmark's look was chosen and why (owner, 2026-10-14). The familiar table app played straight, in the Covers variant (calibrated on Apple's own apps; the cover leads, chrome recedes, one teal accent, light). The original token table, the two-place navigation (Library, Add a book) with an account menu instead of Settings, the library table and covers grid, the Add a book flow and its three scan outcomes, the mock-ups, and the 2026-10-15 finish review. The system as built is DESIGN.md at the repo root. Read before any UI brief.
updated: 2026-10-23
---

# Design

**The design system as built is [DESIGN.md](../../DESIGN.md)** at the repo
root (with its sidecar `.impeccable/design.json`), written on 2026-10-15 by
brief 13 from the shipped UI; its tokens equal
[tokens.css](../../web/src/styles/tokens.css). Build against DESIGN.md. This
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

- **Type:** the system stack (`system-ui, -apple-system, 'Segoe UI',
  sans-serif`). Page title 34 px / 700 / -0.02em (32 px on the phone); row
  title 16 px / 600; body 15 px; meta 14 px; labels 12 px / 600; tabular
  figures for years and counts.
- **Radii:** covers 3 px; controls 8 px; segmented tracks 10 px; pill buttons
  full; table container 16 px; floating sheet 20 px.
- **Elevation:** covers `0 6px 14px rgba(27,27,29,.22), 0 1px 2px
  rgba(27,27,29,.2)`; menus and the scan sheet `0 16px 40px
  rgba(27,27,29,.18)`. Nothing else casts a shadow.
- **Theme:** light. The camera view is dark because it is a camera. No dark
  theme is planned.

## Navigation

Two places only: **Library** and **Add a book**.

- Desktop: a top bar in three columns: wordmark left, the two places as a
  segmented control in the centre, search and the account button right.
- Phone: a two-tab bar at the bottom.
- **No Settings tab.** The account button opens a menu with: change password,
  Sign in with Ward (linked or not), download a backup (the database file),
  sign out.
- **No loans** at all (owner, 2026-10-14).
- The **wishlist** is not a place: Library has two collections, Owned and
  Wishlist, as text tabs under the page title ("Owned 14 · Wishlist 3").

## Library

- Title, count and sort ("14 books, newest first"); on the right a
  **Table / Covers** switch, Filter, Export and the accent "Add a book" pill.
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
- Export menu: "What you see now" and "Every book, every field", each as Excel
  (.xlsx) or CSV ([export.md](export.md)).

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
  account menu. The Owned / Wishlist tabs shipped with brief 23 (2026-10-23).
- `DESIGN.md`, written from the built UI by brief 13 (below).

## Finish review (2026-10-15, brief 13)

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
- Left for the owner: whether the 46×69 table placeholder should drop its
  title and author for a simpler mark (real covers are just as unreadable at
  that size, and a miniature keeps a book the same in Table and Covers);
  whether the desktop Add result should show a larger cover than the phone
  sheet's 60×90; and a look at the Sign in with Ward states, which the review
  could not capture without Ward configured.
