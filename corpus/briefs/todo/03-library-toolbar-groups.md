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
[brief 02](../done/02-library-page-and-width.md), which must be built first.

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

## Files you OWN (step 3)

- [Toolbar.tsx](../../../web/src/library/Toolbar.tsx),
  [library.css](../../../web/src/library/library.css) (the toolbar rules).
- [ViewsMenu.tsx](../../../web/src/library/ViewsMenu.tsx) and
  [ExportMenu.tsx](../../../web/src/export/ExportMenu.tsx): their trigger's
  look only.
- `DESIGN.md`: the Library toolbar bullets.

## Files you must NOT touch

- What the controls do: the panels, menus and dialogs behind them stay.
- [tokens.css](../../../web/src/styles/tokens.css): no new hue. A divider,
  a gap or a tone from the existing tokens is the most a group gets.
- The bulk bar, unless the pick draws it.

## Acceptance (step 3)

- The built toolbar matches the picked alternative at the desktop and phone
  widths, keyboard order unchanged (left to right), every phone target 44 px.
- `npm run typecheck` and `npm run lint` pass; a short browser look at
  1280 px, 1920 px and a phone width.
- `DESIGN.md` describes the toolbar as built.
