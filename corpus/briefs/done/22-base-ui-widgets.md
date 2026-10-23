# Task 22: Base UI for the menus, panels, dialog and switches

## Context

On 2026-10-23 the owner asked for Base UI (`@base-ui/react`) in the apps that
still hand-build their interactive widgets, to match their other apps
(atrium, imbatranimOS, sports-app, trips, ro-housing, public-resource-map,
newspapper). Base UI is headless: it supplies focus handling, keyboard
behaviour, positioning and ARIA, and Shelfmark keeps its own CSS and
design.md tokens. TanStack Table stays, because Base UI has no table.

The hand-built widgets:

- `web/src/components/Menu.tsx` (238 lines): the WAI-ARIA menu button with
  sections, type-ahead and a portalled, self-positioned list. Used by
  `web/src/layout/AccountMenu.tsx` and `web/src/export/ExportMenu.tsx`.
- `web/src/library/Panel.tsx`: the Filter and Columns panels. This is a
  modal `<dialog>` that sits as a white panel under its button on the desktop
  (no dimming) and as a bottom sheet over a dimmed page on a phone.
  `PanelHeader` and `useFocusOnChange` are used by `FilterPanel` and
  `ColumnPicker`.
- `web/src/account/ChangePassword.tsx`: a native `<dialog>` with
  `showModal`.
- `web/src/add/ModeSwitch.tsx`: Scan / Type ISBN / By hand, as tabs with
  hand-written ← → Home End handling. The panel it controls is rendered by
  `AddBookPage` (`panelId`).
- `web/src/components/SegmentedControl.tsx`: one of a few, as `aria-pressed`
  buttons.
- Disclosures: `web/src/book/CoverPanel.tsx` ("Change cover") and
  `web/src/book/BookPage.tsx` (the re-lookup), each a button with `aria-expanded`.

`web/src/components/Sheet.tsx` is a non-modal section with no behaviour, so it
stays.

## Files you OWN

```
web/src/components/{Menu,SegmentedControl}.tsx  web/src/library/Panel.tsx
web/src/library/{Toolbar,FilterChips}.tsx (only the panel triggers)
web/src/account/ChangePassword.tsx  web/src/add/{ModeSwitch,AddBookPage}.tsx
web/src/book/{CoverPanel,BookPage}.tsx (only the disclosures)
web/src/styles/** and the feature CSS rules for these widgets
web/package.json (dependencies only)  package-lock.json
corpus/wiki/{decisions,status}.md
```

## Files you must NOT touch

`shared/`, `server/`, `web/src/scanner/**` (camera and decoding),
`web/src/library/BookTable.tsx` and the TanStack Table setup, `web/src/sw.ts`, `web/src/pwa/**`.

## What to do

1. Add `"@base-ui/react": "1.9.0"` to `web/package.json` dependencies,
   pinned exactly like the rest, then run `npm install` from the root.
2. **Menu → Base UI `Menu`.** Keep `MenuProps`/`MenuSection`. Sections
   become `Menu.Group` + `Menu.GroupLabel`, or a `Menu.Separator` when
   unlabelled. `align` maps to the positioner. Delete the hand-written keys,
   type-ahead and placement. Base UI does all three.
3. **Panel.** On the desktop use a modal `Popover` anchored to its button
   (`modal`, no backdrop, outside press closes). On a phone use a `Dialog`
   styled as the bottom sheet with a dimmed `Backdrop`. Choose with the
   `desktop` prop that `Panel` already takes. Keep `PanelProps`,
   `PanelHeader` and `useFocusOnChange`, and keep "changes apply as made,
   Done only closes".
4. **ChangePassword → `Dialog`.** Map `[data-autofocus]` to `initialFocus`,
   and keep the desktop/phone layouts.
5. **ModeSwitch → `Tabs`.** Lift `Tabs.Root` into `AddBookPage` so that
   `Tabs.Panel` wraps the panel, and drop `panelId`/`modeTabId` if Base UI's
   own ids replace them. Keep switching as React state (never a route) and
   keep `disabled` and the over-camera look.
6. **SegmentedControl → `ToggleGroup`** (single value, never empty). Keep
   its props and the 44 px targets. The top bar's link version
   (`web/src/layout/TopBar.tsx`) stays links.
7. **Disclosures → `Collapsible`** in `CoverPanel` and the re-lookup in
   `BookPage`. Keep the `aria-live` region outside the panel, as it is
   today.
8. **Styles.** Point selectors at Base UI's attributes (`data-open`,
   `data-side`, `data-highlighted`, `data-pressed`, `data-selected`,
   `data-panel-open`, `data-starting-style`, `data-ending-style`). Keep the
   look the same.
9. Native checkboxes (ColumnPicker, FilterPanel, EditForm, RelookupDiff),
   radios (EditForm, StatusPicker) and the `<select>` in FilterPanel stay
   native.
10. Add a `decisions.md` entry: Base UI for overlays and composite widgets,
    dated 2026-10-23, the owner's call to match their other apps. Rejected:
    keeping the hand-built components, and shadcn (it brings Tailwind).
    Update `status.md`.

## Acceptance

- `npm run typecheck && npm run lint && npm run test && npm run build` pass.
- Browser check against the dev server, at 1440 px and 390 px:
  - **account and export menus**: arrow keys, type-ahead, Escape back to
    the button;
  - **Filter panel**: under its button on the desktop and a sheet on the
    phone; focus is trapped and Done closes;
  - **Columns panel**, the same checks;
  - **change password**;
  - **Add**: the tabs with ← → Home End, with the camera page never
    navigating;
  - a **segmented control**;
  - **Change cover**.
  Take before/after screenshots. They should match.
- No `showModal` and no hand-written menu or tab keyboard code is left.
- `bash corpus/lint.sh` passes.

## Outcome (2026-10-23)

Done. `@base-ui/react` 1.9.0 is pinned in `web/package.json`. Each widget
moved:

- `Menu` → `Menu`;
- `Panel` → a modal `Popover` on the desktop and a `Dialog` sheet on a phone;
- `ChangePassword` → `Dialog`;
- `ModeSwitch` → `Tabs`, with `Tabs.Root` and `Tabs.Panel` in `AddBookPage`;
- `SegmentedControl` → `ToggleGroup`;
- Change cover → `Collapsible`.

Props are unchanged, except `ModeSwitch`, which lost `panelId` and
`modeTabId` because Base UI's ids replace them. No `showModal` and no
hand-written menu or tab key code is left. The CSS keys off Base UI's
attributes. `aria-pressed` and `aria-selected` were already the selectors, so
the segmented look needed no change.

Four behaviours needed explicit code:

- **The desktop panel's focus trap.** Base UI traps focus in a modal popover
  only when it has a `Popover.Close` part. Without one, Tab walked out into
  the page. `Panel` tells `PanelHeader` through context to render Done as
  `Popover.Close` on the desktop.
- **Menu items that open something.** A chosen item runs from the menu's
  `finalFocus`, after focus is back on the button. So Change password records
  the account button and returns focus there, through the dialog's
  `finalFocus`, instead of a manual `.focus()`.
- **Clicking a mode tab.** With `activateOnFocus`, a mouse press switched the
  mode while it was still focusing the tab. The new form took focus, and the
  press then left it on the tab. Tabs now `preventDefault` on `mousedown`, so
  a click switches without focusing the tab, and focus moves into the form as
  before. ← → Home End still switch at once.
- **An Esc a control inside already used** doesn't close a panel or the
  dialog.

**The re-lookup button in `BookPage` was not moved to `Collapsible`.** It sits
in the page header, away from `RelookupDiff`, and it only opens (and re-runs);
the panel closes itself. A `Collapsible.Root` would have to wrap the whole
`Page`, and its trigger would toggle.

Checked: typecheck, lint, 633 tests and the build. The main chunk grows from
156.57 to 212.69 kB gzip. In Chromium at 1440 and 390 px, against a scratch
account with five hand-entered books, the same scripted steps ran before and
after:

- the account and export menus: ↓, End, Home, type-ahead, and Esc back to the
  button;
- the Filter panel and its Status step: focus held both ways, Done and Esc
  return to the button, an outside press closes it without reaching what was
  under it, and a chip reopens it with focus going back to the chip;
- the Columns panel;
- the phone sheet: Tab held, and a backdrop press closes it;
- Change password: Tab held, and a backdrop press or Esc returns focus to
  Account;
- the mode tabs by click and by ← → Home End, with the address unchanged;
- Table/Covers by keys and by pressing the chosen one again;
- Change cover, with the live note outside the panel.

The screenshots match, except that a menu opened by mouse no longer
highlights its first item. The phone sheet's list also sits one pixel
higher. brief-board is down, so nothing was posted there.
