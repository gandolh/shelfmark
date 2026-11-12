# Task 03 — The Library toolbar in groups

## Context

The owner asked on 2026-11-04 for the Library toolbar's buttons to be
visually separated. Today, on the desktop, Table / Covers, Views, Filter,
Columns, Export and Add a book read as one row of identical grey pills; only
Add a book differs, in the accent
([Toolbar.tsx](../../../web/src/library/Toolbar.tsx)). The phone's toolbar
is one quiet row (Covers / Table, then "Filter and sort" and "Export" as
accent text), and Views ends the Owned / Wishlist row.

The toolbar sits on the header card from
[brief 02](02-library-page-and-width.md), which must be built first.

The owner prefers familiar, conventional UI over metaphor: a metaphor-heavy
design for another app was rejected as hard to navigate. Group by what the
buttons do: the view switch (Table / Covers), the list tools (Views, Filter,
Columns), Export, and the one primary action (Add a book).

## Steps

1. **Design (done 2026-11-04).** Four alternatives on the header card, at
   desktop width and at phone width, with Shelfmark's real tokens and
   made-up books, in one private design canvas (page "Options"; today's
   toolbar is the first row, for comparison):
   <https://claude.ai/artifact/PojzgG7Ksm5yQgLBYnqbe5>
   - **A. Spaced groups.** The same buttons, with wider gaps and a thin
     divider between the view switch, the list tools and Export; Add a book
     the accent pill. Phone: today's row with dividers. The smallest change.
   - **B. One button group.** Views, Filter and Columns joined in one grey
     group with hairlines between them; the view switch gains icons; Export
     a plain icon-and-text button; Add a book the pill with a plus. Phone:
     a two-icon view switch, Views and "Filter and sort" joined, Export as
     an icon; Views leaves the tabs row.
   - **C. Two rows.** Export and Add a book beside the title, as actions on
     the library; under a divider inside the card, the view switch on the
     left and Views, Filter, Columns as quiet icon-and-text buttons on the
     right. Phone: Export as an icon by the account button, Views joins
     "Filter and sort" in the toolbar row, and the tabs row holds only the
     tabs.
   - **D. Quiet tools with icons.** One row: the view switch as two icons,
     Views, Filter, Columns and Export as unfilled icon-and-text buttons in
     ink-2 with a divider before Export, Add a book the only filled control.
     Phone: the same quiet style, Views stays at the end of the tabs.
2. **The owner picks one.** Stop here until the owner has chosen. Record the
   pick and its date in this brief.
3. **Build the pick.** Only then, and only what the pick draws.

## The pick (owner, 2026-11-04)

Option A, changed. In the owner's words: "A, with Views/Filter/Columns moved
to the end as icons like D; Add a book removed since the top bar has it;
Export in the account dropdown".

- The card's toolbar holds only the Table / Covers switch and, at the end
  behind A's thin rule, Views, Filter and Columns with D's look (unfilled
  icon-and-text buttons).
- Add a book leaves the card: the top bar (the tab bar on a phone) already
  has it.
- Export moves to the account menu. The owner's follow-up the same day:
  **always the whole library**. One entry, "Export library", writes every
  book whatever the Library shows, in the same file format as the old
  export; the filtered "This view · N books" export goes, with anything only
  it used.
- Phone: the same idea. No Add a book or Export in the card; "Filter and
  sort" keeps working as now.
- Ticks keep clearing on a sort, filter, search, tab change and page turn,
  as brief 02 built them (the owner's answer to that open question).

The pick widens the files below: the account menu
([AccountMenu.tsx](../../../web/src/layout/AccountMenu.tsx)), the export
code under `web/src/export/` and the view's export-only column list in
[view.ts](../../../web/src/library/view.ts).

## Files you OWN (step 3)

- [Toolbar.tsx](../../../web/src/library/Toolbar.tsx),
  `library.css` (removed 2026-11-12) (the toolbar rules).
- [ViewsMenu.tsx](../../../web/src/library/ViewsMenu.tsx) and
  `ExportMenu.tsx` (removed by the pick): their trigger's look only.
- `DESIGN.md`: the Library toolbar bullets.

## Files you must NOT touch

- What the controls do: the panels, menus and dialogs behind them stay.
- `tokens.css` (removed 2026-11-12): no new hue. A divider,
  a gap or a tone from the existing tokens is the most a group gets.
- The bulk bar, unless the pick draws it.

## Acceptance (step 3)

- The built toolbar matches the picked alternative at the desktop and phone
  widths, keyboard order unchanged (left to right), every phone target 44 px.
- `npm run typecheck` and `npm run lint` pass; a short browser look at
  1280 px, 1920 px and a phone width.
- `DESIGN.md` describes the toolbar as built.

## Outcome (2026-11-04)

Built on local `main`, not pushed, not deployed.

- **Toolbar** ([Toolbar.tsx](../../../web/src/library/Toolbar.tsx)):
  desktop is the Table / Covers switch, a 1 px hairline rule 22 px tall with
  16 px either side, then Views, Filter ("Filter and sort" in Covers) and
  Columns (in the table) as `.library-tool` buttons: a 16 px line icon and
  the label in ink-2 on nothing, the control fill on hover, the teal wash
  while open. The phone row is the switch and "Filter and sort" (sliders
  icon) at its end. Views (bookmark icon and a down chevron) has the same
  look in both places; on a phone it still ends the tabs row. The icons are
  new in `library/icons.tsx`. The loading state's lone "Add a book" in the
  card is gone too.
- **Export** ([exportLibrary.ts](../../../web/src/export/exportLibrary.ts),
  [AccountMenu.tsx](../../../web/src/layout/AccountMenu.tsx)): the account
  menu has an "Export library" section after "Download a backup", with
  "Excel workbook (.xlsx)" and "CSV". It writes every book, owned and
  wishlist, with a Collection column first, then every column
  (`libraryTable` in `fields.ts`). The export code loads only when chosen.
  Removed as only the filtered export used them: `ExportMenu.tsx`,
  `viewTable`, `everythingTable`, `exportColumns`, `visibleColumns`, and
  `LibraryView.columns` with `ViewState.columnOrder` / `columnVisibility`.

Calls made beyond the pick:

- "Export library" is a menu section with the two formats under it, not a
  single row, so the export keeps both of today's formats. Whether it should
  be one row is in [open-questions.md](../../wiki/open-questions.md).
- The export adds a Collection column ("Owned" / "Wishlist") first, since
  it now holds both collections. CSV import ignores that column.
- On the phone's tabs row, Views takes its baseline from its label rather
  than its icon (padding instead of a min-height keeps the 44 px target), so
  it reads on the line of "Owned".

Checks: `npm run typecheck`, `npm run lint`, and the unit tests in
`web/src/library/` and `web/src/export/` (12 files, 140 tests; `csv` and
`xlsx` tests moved to the whole-library table, `view` tests lost the
removed column helpers). Nothing called Google Books or any catalog.

Browser look on the same scratch `DATA_DIR` (126 owned, 6 wishlist made-up
books): at 1920 px and 1280 px the card holds only the switch, the rule
and the three tools, with nothing sideways; "Filter and sort" in Covers
opens with the wash; at 390 px the phone row is the switch and "Filter and
sort", Views sits on the tabs' baseline (44 px), and the account menu shows
"Export library"; its CSV held a header and 132 rows starting "Collection,
Title, Author".

Owner: deploy the web app from `vps-deploy` with
`node cli.ts shelfmark deploy` (it carries brief 02 as well), then on the
Android phone check the toolbar row, Views on the tabs row and "Export
library" in the account menu.
