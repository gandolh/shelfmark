---
summary: How Shelfmark's menus, panels, dialogs, tabs and toggles sit on Base UI since 2026-10-23. What each hand-built widget became, the four behaviours that needed explicit code (the desktop panel's focus trap, items that open something, a click on a mode tab, Esc a control already used), what stayed as it was, and the cost.
updated: 2026-11-11
---

# Overlays and widgets

The call is in [decisions.md](decisions.md). `@base-ui/react` is pinned at
1.9.0 in `web/package.json`; the CSS keys off Base UI's attributes, and props
stayed the same except `ModeSwitch`, which lost `panelId` and `modeTabId`
because Base UI's ids replace them. The code wins where this page and it
disagree.

## What each became

Base UI is imported only under a `ui/` folder (the base-ui skill's rule 3):
`web/src/components/ui/` for what is shared, `web/src/library/ui/` for the
Filter and Columns panel, which only the Library uses. `scripts/conventions.json`
lists `**/ui` as the places.

- `Dialog` (`web/src/components/ui/Dialog.tsx`): the one modal frame (a panel in the
  middle on the desktop, the floating sheet on a phone) for the Views dialogs,
  the four bulk dialogs, Change password, Change username and the Wishlist's
  Claude import. It holds the Escape guard, the initial focus (first
  `[data-autofocus]`, else the first field, else the footer's first button),
  focus back to what opened it and a `Title`. A form dialog ignores a press on
  the backdrop (`disablePointerDismissal`); while `pending` (a save or a delete
  running) it ignores Esc too. The decisions are plain functions in
  `dialog-logic.ts`, with unit tests.
- `Menu` (`web/src/components/ui/Menu.tsx`): Base UI `Menu`.
- `Panel` (`web/src/library/ui/Panel.tsx`): a modal `Popover` on the desktop and a
  `Dialog` sheet on a phone; its header's `Title` names it.
- `Tabs` (`web/src/components/ui/Tabs.tsx`): the Add page's mode tabs, with the mouse
  down guard inside `Tab`.
- `ToggleGroup` (`web/src/components/ui/ToggleGroup.tsx`): the rating and the shelf
  chips. They set a value the form saves later, so pressing the chosen one again
  clears it ("Not rated" is a value).
- `RadioGroup` (`web/src/components/ui/RadioGroup.tsx`): `SegmentedControl` (the
  Library's Table / Covers, the sort direction, the filter operators, Import's
  Save into): one Tab stop, the arrows move and choose, one always chosen
  (base-ui rule 16; nothing is saved to the server, so not a `ToggleGroup`). Styled
  on `data-checked`.
- `Toggle`: the camera's torch button.
- `Collapsible`: Change cover.
- `Toast` (`web/src/components/ui/Toast.tsx`): the update prompt, `timeout: 0`, with
  Reload as its action. It never reloads on its own.

The two delete confirms (a saved view, selected books) stay dialogs on the
wrapper, not `AlertDialog`; the inline "Delete? Yes / No" confirms stay inline
(owner, 2026-11-10). Native checkboxes, radios, selects, text inputs and
`<datalist>`s stay native.

## Behaviours that needed code

- **The desktop panel's focus trap.** Base UI traps focus in a modal popover
  only when it has a `Popover.Close` part, so `Panel` tells `PanelHeader`
  through context to render Done as `Popover.Close` on the desktop.
- **Menu items that open something** run from the menu's `finalFocus`, after
  focus is back on the button. Change password records the account button and
  returns focus there through the `Dialog`'s `finalFocus` (its `returnFocus`
  takes the element or a getter).
- **A click on a mode tab.** With `activateOnFocus`, a mouse press switched the
  mode while still focusing the tab, and the press then left focus on the tab.
  The `Tab` wrapper calls `preventDefault` on `mousedown`, so a click switches without focusing
  the tab and focus moves into the form; ← → Home End still switch at once.
- **Esc a control inside already used** doesn't close a panel or the dialog.

Code that looked for a style class now looks for a data attribute
(`data-chip-remove`, `data-panel-scroll`, `data-panel-back`, `data-topbar`), so
the Tailwind move can delete the classes.

## Not moved

The re-lookup button in `BookPage` sits in the page header, away from
`RelookupDiff`, and only opens (and re-runs); a `Collapsible.Root` would have
to wrap the whole page and its trigger would toggle.

## Cost and differences

The main chunk grew from 156.57 to 212.69 kB gzip. A menu opened by mouse no
longer highlights its first item, and the phone sheet's list sits one pixel
higher.
