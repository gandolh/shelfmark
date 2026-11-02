---
summary: How Shelfmark's menus, panels, dialogs, tabs and toggles sit on Base UI since 2026-10-23. What each hand-built widget became, the four behaviours that needed explicit code (the desktop panel's focus trap, items that open something, a click on a mode tab, Esc a control already used), what stayed as it was, and the cost.
updated: 2026-11-02
---

# Overlays and widgets

The call is in [decisions.md](decisions.md). `@base-ui/react` is pinned at
1.9.0 in `web/package.json`; the CSS keys off Base UI's attributes, and props
stayed the same except `ModeSwitch`, which lost `panelId` and `modeTabId`
because Base UI's ids replace them. The code wins where this page and it
disagree.

## What each became

- `Menu` (`web/src/components/Menu.tsx`): Base UI `Menu`.
- `Panel` (`web/src/library/Panel.tsx`): a modal `Popover` on the desktop and a
  `Dialog` sheet on a phone.
- `ChangePassword`: `Dialog`.
- `ModeSwitch`: `Tabs`, with `Tabs.Root` and `Tabs.Panel` in `AddBookPage`.
- `SegmentedControl`: `ToggleGroup`. `aria-pressed` and `aria-selected` were
  already the selectors, so the look needed no change.
- Change cover: `Collapsible`.

## Behaviours that needed code

- **The desktop panel's focus trap.** Base UI traps focus in a modal popover
  only when it has a `Popover.Close` part, so `Panel` tells `PanelHeader`
  through context to render Done as `Popover.Close` on the desktop.
- **Menu items that open something** run from the menu's `finalFocus`, after
  focus is back on the button. Change password records the account button and
  returns focus there through the dialog's `finalFocus`.
- **A click on a mode tab.** With `activateOnFocus`, a mouse press switched the
  mode while still focusing the tab, and the press then left focus on the tab.
  Tabs `preventDefault` on `mousedown`, so a click switches without focusing
  the tab and focus moves into the form; ← → Home End still switch at once.
- **Esc a control inside already used** doesn't close a panel or the dialog.

## Not moved

The re-lookup button in `BookPage` sits in the page header, away from
`RelookupDiff`, and only opens (and re-runs); a `Collapsible.Root` would have
to wrap the whole page and its trigger would toggle.

## Cost and differences

The main chunk grew from 156.57 to 212.69 kB gzip. A menu opened by mouse no
longer highlights its first item, and the phone sheet's list sits one pixel
higher.
