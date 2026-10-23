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
