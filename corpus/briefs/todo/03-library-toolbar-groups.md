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
   made-up books, in one artifact:
   <https://claude.ai/code/artifact/PENDING>
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
