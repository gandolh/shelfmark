# Task 06: Base UI by the conventions

**Depends on:**

- In Shelfmark: brief 05, for the gate, the formatter and `.claude/rules/web.md`; brief 04 (Wishlist), which removes the Library's collection tabs and adds the Wishlist page and its Import dialog before this brief's wrappers exist.
- In the owner's skills library:
  - brief 02, *A base-ui skill, styled with Tailwind*: rules 1-13, the references and `check-base-ui.mjs`;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: the checker runs `--warn-only` until brief 07 here is done.
- The owner's grilling of 2026-11-10: Q15 (Base UI only under `ui/`), Q16 (where native controls stay), Q58 (inline confirms stay; form dialogs set `disablePointerDismissal`), Q41 and Q57 (filters and pickers), Q59 (wrappers stay in `components/ui/`), Q60 (tests for wrappers that hold logic), and Q40 (a phone navigation panel, which Shelfmark does not have).

**Runs after:** 04 and 05. **Runs before:** 07. This brief changes structure and behaviour; brief 07 then changes only styling, so its before and after screenshots compare like with like.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

Shelfmark moved its menus, panels, dialogs, tabs and toggles onto Base UI on 2026-10-23 ([wiki/overlays.md](../../wiki/overlays.md)). It is close to the conventions in behaviour and far from them in structure: there is no `ui/` folder and no `Dialog` wrapper, so three files each rebuild the same dialog. This brief closes the gaps below. It does not move styling to Tailwind (brief 07).

### The pin (verified 2026-11-10)

- `web/package.json:14` pins `"@base-ui/react": "1.9.0"`.
- `package-lock.json:1570` resolves it at 1.9.0, with `@base-ui/utils` 0.5.0 (`package-lock.json:1608`).
- `grep -rn "OTPFieldPreview\|otp-field\|sanitizeValue" web server shared docs` finds nothing.

**No bump brief is needed.** Every part this brief uses (`alert-dialog`, `toast`, `toggle-group`, `tabs`, `collapsible`) is in the 1.9.0 package's `exports`, checked by installing it in a scratch copy.

### The audit against rules 1-13 (2026-11-10)

| Rule | Violations | Where |
|---|---|---|
| 1. Exact pin | 0 | |
| 2. Subpath imports | 0 | All 10 import lines are subpaths: `dialog` ×3, `popover`, `menu`, `tabs` ×2, `toggle`, `toggle-group`, `collapsible`. |
| 3. Base UI only under a `ui/` folder | **10 lines in 8 files** | `web/src/components/SegmentedControl.tsx:1-2`, `web/src/components/Menu.tsx:1`, `web/src/book/CoverPanel.tsx:2`, `web/src/library/ViewDialog.tsx:1`, `web/src/library/Panel.tsx:1-2`, `web/src/add/AddBookPage.tsx:1`, `web/src/add/ModeSwitch.tsx:1`, `web/src/account/AccountDialog.tsx:1`. There is no `ui/` directory at all. |
| 4. Tailwind on the parts | all of them | `.menu*`, `.library-dialog*`, `.account-dialog*`, `.library-panel*`, `.segmented*`, `.add-modes`, `.book-coverpanel`. **Brief 07's work.** |
| 5-7. One stylesheet, tokens, motion | all of them | **Brief 07's work.** Inline `style` props: 10 compute geometry or pass a CSS variable and stay (`CoverImage.tsx:46, 64`, `BookTable.tsx:415, 428, 441, 461`, `CoversGrid.tsx:208, 220`, `CipReader.tsx:94, 232`); `web/src/scanner/ScannerDemo.tsx` has 11 static ones (a dev-only page), which brief 07 turns into utilities. |
| 8. Floating parts portalled, z from tokens | 0 | Every Base UI popup goes through a `Portal` (`Menu.tsx:67`, `Panel.tsx:71, 98`, `ViewDialog.tsx:42`, `AccountDialog.tsx:87`). z-indexes are `--z-bar` / `--z-float`, plus nine local `z-index: 1` or `2` inside one component each (`book.css:615`, `library.css:770, 965, 1001`, `add.css:171, 206, 245, 710, 1106`) and two offsets (`add.css:41`, `shell.css:33`). |
| 9. A trigger around a component uses `render` | 0 | `Popover.Close render={done}` (`Panel.tsx:140`), `Collapsible.Trigger render={<Button …/>}` (`CoverPanel.tsx:56`). `Menu.Trigger` (`Menu.tsx:53`) wraps spans and icons. |
| 10. `Select.Root` with `items` | 0 | No Base UI `Select`. The two native `<select>`s (`web/src/library/FilterPanel.tsx:241`, `web/src/import/ImportPage.tsx:167`) stay native by decision. |
| 11. No `window.confirm`, `alert`, `prompt` | 0 | |
| 12. Dialogs | **4 findings**, one part unaudited | See below. |
| 13. Base UI over hand-built widgets | **6** | See below. |

**Rule 12's findings:**

1. **Three copies of one dialog.** `DialogFrame` (`web/src/library/ViewDialog.tsx:32-58`, used by the Views dialogs and the four bulk dialogs), `AccountDialog` (`web/src/account/AccountDialog.tsx:75-107`, used by Change password and Change username) and `Panel`'s phone branch (`web/src/library/Panel.tsx:96-111`). Each repeats the Escape guard (`ViewDialog.tsx:39`, `AccountDialog.tsx:84`, `Panel.tsx:31, 61`) and `initialFocus`.
2. **`initialFocus` ends in `?? true`** (`ViewDialog.tsx:47`, `AccountDialog.tsx:92`, `Panel.tsx:63`): the first `[data-autofocus]`, else Base UI's first tabbable. The house order's last step, the footer's first button, is missing.
3. **No `disablePointerDismissal` anywhere** (`grep -rn disablePointerDismissal web/src` is empty). Six dialogs people type into close on a backdrop press: `NameDialog` (`ViewDialog.tsx:100`), `ShelfDialog`, `AddTagsDialog`, `RemoveTagsDialog` (`web/src/library/BulkDialogs.tsx:57, 179, 241`), Change password and Change username. The two confirms, `DeleteViewDialog` (`ViewDialog.tsx:176`) and `DeleteBooksDialog` (`BulkDialogs.tsx:311`), disable their buttons while `pending` but still close on Esc or a backdrop press, mid-request.
4. **`Panel` has no `Title`** on either branch (`Panel.tsx:84, 102` use `aria-label`; the heading is a plain `<h2>` in `PanelHeader`, line 139). `DialogFrame` and `AccountDialog` do have one.
5. **Not audited:** whether every icon-only button has an `aria-label`. Step 1 checks it, and lists any that lack one.

**Rule 13's six**, with what Shelfmark's decisions keep native left out. Two drop out after the owner's answers: item 1 (brief 04 removes the collection tabs) and item 5 (inline confirms stay, and the two delete dialogs stay dialogs, Q58). Four remain: items 2, 3, 4 and 6.

1. **Collection tabs**, `web/src/library/LibraryPage.tsx:379-397` (`CollectionTabs`): two `aria-pressed` buttons in a `role="group"`. **Gone**: brief 04 moves the wishlist to its own place. If this brief ran first, Q41 would apply: a filter that switches what a list shows uses `RadioGroup`.
2. **The rating**, `web/src/book/RatingField.tsx:40-51`: five `aria-pressed` buttons, five tab stops. Pressing the chosen star clears it, which is what a deselectable `ToggleGroup` does, with one tab stop and arrow keys. It sets a form value that Save writes; it is not a picker that saves on each choice, so Q57's guard and "one item always stays pressed" don't apply, and clearing stays ("Not rated" is a value).
3. **Shelf chips**, `web/src/add/ShelfPicker.tsx:70-85`: `aria-pressed` buttons, choosing again clears. A `ToggleGroup` (also a form value, not a saving picker). The "new shelf" text field and its `<datalist>` stay native.
4. **The torch button**, `web/src/add/AddBookPage.tsx:348`: one `aria-pressed` button, a `Toggle`.
5. **The two delete confirms** (finding 3): **stay dialogs** (Q58: no move to `AlertDialog`). They go onto the `Dialog` wrapper and ignore Esc and a backdrop press while their action runs.
6. **The update prompt**, `web/src/pwa/UpdatePrompt.tsx:16-25`: a hand-built `role="status"` card with a Reload action, never timed out. It becomes a Base UI `Toast` with `timeout: 0`, which keeps its live region.

**Considered and left:**

- **Native by [wiki/decisions.md](../../wiki/decisions.md), "Base UI under the menus…" (2026-10-23): "native checkboxes, radios and selects stay native" (Q16).** Checkboxes: `BookTable.tsx:151, 180`, `FilterPanel.tsx:385`, `ColumnPicker.tsx:112, 162`, `BulkDialogs.tsx:274`, `EditForm.tsx:227`, `RelookupDiff.tsx:99`, `ImportPage.tsx:357`. Radios: `EditForm.tsx:55`, `BulkDialogs.tsx:104, 121, 134`, `StatusPicker.tsx:39`. Selects: the two above.
- **`<datalist>` inputs** (`ShelfPicker.tsx`, `TagsField.tsx:62-78`): 1.9.0 has `combobox` and `autocomplete`, but the decision does not name datalists. See decision 3.
- **No Base UI equivalent:** the table's and covers grid's roving keys (`BookTable.tsx:353`, `CoversGrid.tsx:125`) and the column resize handle (`BookTable.tsx:524-540`, `role="separator"`).
- **Not widgets:** the top bar's and tab bar's links (`aria-current`), `Sheet` (a non-modal result card), the Re-lookup and Buy-it disclosures ([wiki/overlays.md](../../wiki/overlays.md), "Not moved").
- **Inline confirms**, `web/src/book/DeleteBook.tsx:50-66` and `web/src/book/CoverPanel.tsx:106-118`: a question that opens in the page, with focus moved to it and buttons disabled while busy. They stay (decided 2026-11-10, owner, Q58).
- **The phone navigation** (Q40's Drawer): Shelfmark's phone navigation is the bottom tab bar, with no menu panel, so nothing moves to `Drawer`. The phone Filter and Columns panel is a floating sheet dialog, not navigation, and stays on `Dialog`.

**Styling classes used as behaviour hooks** (brief 07 deletes the classes, so this brief swaps them for refs or `data-` attributes): `.library-chip__remove` (`web/src/library/FilterChips.tsx:30`), `.library-panel__scroll :is(button, input, select)` (`Panel.tsx:156`, and `FilterPanel.tsx:149`), `.topbar` (`LibraryPage.tsx:164`).

## Owner decisions (defaults this brief builds)

1. **Base UI only under `ui/`** (decided 2026-11-10, technical call, Q15 and Q59). Shared wrappers go in `web/src/components/ui/` (they stay there in a feature-folder repo); `Panel`, which only the Library uses, goes in `web/src/library/ui/` (rule 3's own "a feature's own `ui/` folder").
2. **A backdrop press on a form dialog** (decided 2026-11-10, owner, Q58). A dialog that holds a form sets `disablePointerDismissal`: it closes with Cancel, the X or Esc, and a stray press no longer loses typed text. This changes what happens today (a backdrop press closes them). The Import dialog that brief 04 adds is one of them. The two delete confirms also ignore Esc and a backdrop press while their action runs.
3. **Which rule-13 leftovers move** (decided 2026-11-10: owner for the confirms, Q58; technical call for the rest, Q41 and Q57). The rating, the shelf chips, the torch and the update prompt move. The inline "Delete? Yes / No" confirms stay inline, and the two delete dialogs stay dialogs (no `AlertDialog`). `<datalist>` stays native (a default: Q16 names text, date and time inputs and the phone `<select>`, not datalists).
4. **Native controls** (decided 2026-11-10, technical call, Q16): native text, date and time inputs, native checkboxes, radios and selects, and a native `<select>` on phones, stay native.
5. **Tests** (decided 2026-11-10, technical call, Q60; the owner's "only lightweight tests" stands): no DOM library. Pure functions are unit-tested; flows are walked in a browser.

## The wrapper set

| File | What it is | From |
|---|---|---|
| `web/src/components/ui/Dialog.tsx` | One modal frame: centred on the desktop, the floating sheet on a phone. Props `title`, `onClose`, `returnFocus`, `dismissOnBackdrop` (default false, so `disablePointerDismissal` is set), `pending` (ignores Esc and a backdrop press while true), `children`; it reads `useIsDesktop` itself. Holds the Escape guard, the house `initialFocus`, `finalFocus`, `Title`. | `DialogFrame` and `AccountDialog`, merged |
| `web/src/components/ui/Menu.tsx` | Base UI `Menu`, props unchanged (`finalFocus` running the chosen item stays) | `web/src/components/Menu.tsx`, moved |
| `web/src/components/ui/Tabs.tsx` | `Tabs.Root`, `List`, `Tab`, `Panel`; the mouse-down guard stays | the two `Tabs` files in `web/src/add/` |
| `web/src/components/ui/ToggleGroup.tsx` | `ToggleGroup` + `Toggle`, single and deselectable | `SegmentedControl.tsx`'s core; used by the rating and shelf chips |
| `web/src/components/ui/Collapsible.tsx` | `Collapsible` with `render` triggers | `CoverPanel.tsx` |
| `web/src/components/ui/Toast.tsx` | `Toast` with `createToastManager()`, `timeout: 0` for the update prompt | `UpdatePrompt.tsx` |
| `web/src/library/ui/Panel.tsx` | the Filter and Columns panel: modal `Popover` on the desktop, the `Dialog` wrapper on a phone, with a `Title` | `web/src/library/Panel.tsx`, moved |

`SegmentedControl` stays in `web/src/components/` (it is a look) but builds on the `ToggleGroup` wrapper. `Button`, `Link`, `Sheet`, `CoverImage` stay.

## Files you OWN

- `web/src/components/ui/**` and `web/src/library/ui/**` (new), the files moved into them, and every import of those, including the Wishlist page's (`web/src/wishlist/`, from brief 04).
- `web/src/library/ViewDialog.tsx`, `BulkDialogs.tsx`, `LibraryPage.tsx`, `FilterPanel.tsx`, `FilterChips.tsx`; `web/src/account/AccountDialog.tsx`, `ChangePassword.tsx`, `ChangeUsername.tsx`; `web/src/book/RatingField.tsx`, `CoverPanel.tsx`; `web/src/add/AddBookPage.tsx`, `ModeSwitch.tsx`, `ShelfPicker.tsx`; `web/src/pwa/UpdatePrompt.tsx`.
- The existing CSS rules for markup this brief changes: rename or move a selector, never restyle.
- Tests for the pure parts (below).
- `scripts/conventions.json`.
- Corpus: [wiki/overlays.md](../../wiki/overlays.md), [wiki/decisions.md](../../wiki/decisions.md) (the Base UI entry gains the 2026-11-09 conventions line), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `server/`, `shared/`, `web/package.json` (nothing new is needed).
- Styling beyond renaming a selector. No Tailwind here.
- The four behaviours [wiki/overlays.md](../../wiki/overlays.md) records (the desktop panel's focus trap through `Popover.Close`, menu items run from `finalFocus`, the mode tab's `mousedown`, Esc a control already used). They move with their wrappers unchanged.
- The native controls, `BookTable` and `CoversGrid` keys, `TagsField`.

## What to do

One commit per step; `npm run check` passes after each, with `check-base-ui` at `--warn-only`.

**Testing note.** `vitest` runs in `node` with no DOM library, and [wiki/decisions.md](../../wiki/decisions.md), "Only lightweight tests", keeps it that way. So the decisions that can be pure functions are: `closeAllowed(details, { pending, dismissOnBackdrop })` for the Escape guard and dismissal, and the `initialFocus` order. They live in the `Dialog` wrapper as exported functions with unit tests. The rest is checked by the same scripted browser walk before and after (step 1, step 8), kept out of git.

1. **Before.** Run `check-base-ui` strict and record counts by rule (expect rule 3 at 10 lines). Take Playwright screenshots at 1280 × 800 and 390 × 844 of: the Views menu, the name dialog, the delete-view confirm, the Filter and Columns panels (popover on the desktop, sheet on a phone), each bulk dialog, the account menu, Change password and Change username, the Add page's three modes, the Wishlist page and its Import dialog, the cover panel open, the rating, the shelf chips, the torch, the update prompt. Brief 07's method has the bring-up.
2. **the `Dialog` wrapper.** Merge `DialogFrame` and `AccountDialog`, with `closeAllowed` and the `initialFocus` order (first `[data-autofocus]`, else the first field, else the footer's first button) and their tests. Point the Views, bulk and account dialogs at it. Rule 12's findings 1-2 close.
3. **The two delete confirms on `Dialog`** with `pending`: `DeleteViewDialog` and `DeleteBooksDialog`. Keep "Keep it" / "Keep them", the failure line, the "Deleting…" label, focus back to the Views button or the bulk bar. No `AlertDialog` (Q58).
4. **Move `Menu`, `Panel`, add `Tabs`, `Collapsible`, `ToggleGroup`** (`git mv`, imports updated). `Panel` gains its `Title`. Replace the three class-name hooks with refs or `data-` attributes. Rule 3 reaches 0.
5. **Rule 13, one commit each:** rating, shelf chips, torch, then `Toast` for the update prompt. Keep: the rating's "press again clears" and its hint, the shelf chips' behaviour with the text field (`close()` on choosing), the update prompt's Reload never firing by itself ([wiki/scanning.md](../../wiki/scanning.md)).
6. **Pointer dismissal.** Form dialogs set `disablePointerDismissal` through the wrapper's default, the Wishlist's Import dialog included. Check by hand that a backdrop press on Change password with typed text does nothing, and Esc still closes.
7. **`scripts/conventions.json`** with the exceptions the checker needs (`ScannerDemo.tsx`'s inline styles until brief 07).
8. **After.** Same screenshots; list every difference with its reason. `check-base-ui` strict: rules 1, 2, 3, 9, 10, 11 report 0. Update the corpus pages.

## Acceptance

- [ ] `grep -rn "@base-ui/react" web/src --include=*.ts --include=*.tsx | grep -v "/ui/"` prints nothing.
- [ ] `check-base-ui` strict reports 0 for rules 1, 2, 3, 9, 10, 11. Rules 4-7 counts are in the outcome note for brief 07.
- [ ] `npx vitest run web/src/components/ui` passes: `closeAllowed` ignores an Esc that a field already used, ignores any close while `pending`, ignores a backdrop press unless `dismissOnBackdrop`, and the `initialFocus` order is as listed.
- [ ] Every `Dialog.Popup` and `Popover.Popup` has a `Title`: `grep -rn "Popup" web/src --include=*.tsx` lists only files under `ui/`, and each has a title part.
- [ ] The browser walk shows: the delete confirms ignore Esc and backdrop while running; a backdrop press leaves a form dialog open; the rating and shelf chips are one tab stop with arrow keys; the update prompt appears and Reload works.
- [ ] The screenshots show no visible change to layout or colour at 1280 and 390 px (Q19, close enough: a few pixels of drift need not be fixed or listed); any other difference is listed and explained.
- [ ] `npm run check` passes and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 07 styles `web/src/components/ui/` and `web/src/library/ui/` with Tailwind and merges the `library-dialog*` and `account-dialog*` families, which this brief leaves as two sets of rules on one component.
- Brief 04 (Wishlist) runs before this brief, so this brief moves the Wishlist page's menus and dialogs onto the wrappers, and its Import dialog sets `disablePointerDismissal`. The Library's collection tabs no longer exist by then.
- The Light / Dark / System switch (Q18) is built in brief 07, where theming lives.
- `check-base-ui`'s rule 9 heuristic may flag `Popover.Close render={done}`'s neighbours falsely; report it to the skill, not here.
