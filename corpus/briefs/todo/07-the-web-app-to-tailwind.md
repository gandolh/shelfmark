# Task 07: The web app to Tailwind

**Depends on:**

- In Shelfmark:
  - brief 05, for the gate, the formatter and the `.claude/rules/web.md` this brief extends;
  - brief 06, which puts the Base UI wrappers in `web/src/components/ui/` and `web/src/library/ui/` and settles their markup, so each part is styled once, in its final place.
- In the owner's skills library:
  - brief 02, *A base-ui skill, styled with Tailwind*: rules 4-8, the `tailwind.md` reference and the method in `migrating-from-plain-css.md`;
  - brief 27: the `better-tailwindcss` lint;
  - brief 05, *Shelfmark's web app to Tailwind*, the estate draft this brief replaces.
- The owner's grilling of 2026-11-10: Q17 (token names), Q18 (dark mode), Q19 (visual parity), Q20 (order), and the new question in decision 4.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner's call of 2026-11-09: Base UI is styled with Tailwind v4 and whole apps move to Tailwind. Shelfmark's web app is plain CSS on tokens. This brief moves all of it to Tailwind 4.3.5 with the looks unchanged. Where it disagrees with the estate draft, this brief was measured against the code on 2026-11-10.

### Corrections to the estate draft

- **Tokens.** `web/src/styles/tokens.css` defines **86** custom properties, not 98 (all 86 are read somewhere). Twelve more names are defined locally in four other files (28 definitions): `--tint-bg` and `--tint-ink` (`components.css`, 8 rules each), `--library-sticky-top`, `--library-row-hover`, `--text-result-title`, `--text-sheet-heading`, `--text-isbn`, `--add-top-room`, `--cover-width`, `--book-cover-width`, `--book-main-width`, `--book-gap`.
- **Keyframes.** 14 `@keyframes`, but **7 distinct** animations. Four names are the same slide-up (`sheet-in` in `components.css:356`, `account-sheet-in`, and `library-sheet-in` twice in `library.css:379, 1546`), three are the same 8 px rise (`library-dialog-in`, `add-rise`, `account-dialog-in`), two are the same 4 px drop (`library-panel-in`, `menu-in`), two are the same fade-in (`gate-wait-in`, `library-skeleton-in`). The others are `library-pulse`, `add-progress` and `scanner-hit`. So `@theme` gets 7 `--animate-*` entries.
- **Dark mode.** None. `web/src/styles/base.css:7` forces `color-scheme: light` and `web/index.html:6` carries `<meta name="color-scheme" content="light">`. No `@custom-variant dark`.
- **No vendor CSS.** Nothing imports a stylesheet from `node_modules`, and Base UI ships none. So Almanac's cascade-layer problem (unlayered vendor CSS beating Tailwind) does not arise.
- **One chunk already.** Only the dev scanner page is `lazy` (`web/src/layout/AppShell.tsx:38`), so all 13 stylesheets load as one file. Built on 2026-11-10 (`npm run build -w @shelfmark/web` on the scratch copy): `dist/assets/index-DXpbJbSG.css` is **76,724 bytes, 13,379 gzip** (`gzip -9`), and `index-_YiNvoDe.js` 785,704 bytes, 240,918 gzip. There is no first-paint decision to make.
- **No colour literal outside `tokens.css`.** `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" web/src` finds none outside it and the tests ([DESIGN.md](../../../DESIGN.md), "The Token-Only Rule"). The brief keeps that true.

### The stylesheets today

Thirteen files, **5,474 lines**, all under `web/src/`. Between them: about 435 distinct class names in selectors, 667 `className` attributes in 54 `.tsx` files, 13 `@media` blocks, 1 `@container`, 14 `@keyframes`, 17 lines mentioning `transition`, 4 `!important` (all in the reduced-motion rule, `base.css:154-157`), 732 `px` values, 11 `em`s and 4 `rem`s.

| File | Lines | Imported by | What it styles |
|---|---|---|---|
| `web/src/library/library.css` | 1,602 | `LibraryPage` | Toolbar (9), collection tabs (192), filter chips (251), Filter and Columns panels (330), table (749), covers (1056), pager (1172), messages and skeletons (1282), phone (1403), Views and bulk dialogs (1490). Six keyframes. |
| `web/src/add/add.css` | 1,128 | `AddBookPage`, **and `web/src/book/EditForm.tsx`** | The mode switch and session line, the camera stage, the result sheet, actions, labels, hints and errors (518), the ISBN field (567), the by-hand form (678), chips (774), the cover photo (898), the CIP read (949). |
| `web/src/book/book.css` | 631 | `BookPage` | The page columns, cards, facts, cover panel, re-lookup, delete, missing, the edit form. |
| `web/src/styles/components.css` | 502 | `main.tsx` | Button, SegmentedControl, Menu, Sheet, CoverImage (the typographic cover, in `cqi` units, `container: cover / inline-size` at line 384). |
| `web/src/styles/shell.css` | 436 | `main.tsx` | Top bar, search, account button, tab bar, page frame. No `@media`: the phone layout is `.shell--phone` set from JS. |
| `web/src/auth/auth.css` | 235 | `LoginPage`, `AuthGate`, **`ViewDialog`, `AccountDialog`** | The gate and login, **and the app's shared field and error styles** (`.auth-field*`, `.auth-error*`), used by four files outside `auth/`. |
| `web/src/import/import.css` | 196 | `ImportPage` | |
| `web/src/styles/base.css` | 159 | `main.tsx` | `:root` (**15 px**, line 9), box sizing, margins, control inheritance, focus ring, links, scrollbars, `.visually-hidden`, reduced motion. |
| `web/src/scanner/CameraScanner.css` | 144 | `CameraScanner` | Its rules are overridden by `add.css:176`, "two classes so these win … whatever order the sheets load in". |
| `web/src/styles/tokens.css` | 132 | `main.tsx` | The 86 tokens. |
| `web/src/account/account.css` | 132 | `AccountDialog` | The dialog (it styles `.library-panel__title` too, line 77). |
| `web/src/stats/stats.css` | 116 | `StatsPage` | |
| `web/src/pwa/pwa.css` | 61 | `UpdatePrompt`, `OfflineNotice` | |

Cross-file sharing is the main ordering constraint: 15 distinct `add-*` classes are used by six files in `web/src/book/` (`add-hint` ×9, `add-label` ×5, `add-field--year`, `add-error`, `add-choice`, `add-input`, `add-chip*`…), and `auth-field__error`, `auth-error`, `auth-error__text` by four files in `library/` and `account/`.

### The token mapping plan

`tokens.css` by line, mapped to Tailwind 4.3.5's namespaces, values unchanged. DESIGN.md's front matter already uses the colour, radius and size names, so the mapping keeps DESIGN.md's names.

| Group (`tokens.css` lines) | Count | In `@theme` | Utility example |
|---|---|---|---|
| Colour (13-25) | 13 | `--color-<same name>` | `bg-ground`, `text-ink-2` |
| Derived (29-39) | 9 | `--color-<same>`, their `color-mix(in srgb …)` values kept | `bg-segment-hover` |
| Cover tints (48-63) | 16 | `--color-cover-N-bg`, `--color-cover-N-ink` | |
| Font (67) | 1 | `--font-sans`, replaces Tailwind's | `font-sans` |
| Type sizes (69-79) | 11 | `--text-<same>` | `text-body`, `text-label` |
| Weights (81-83) | 3 | `--font-weight-<suffix>` | `font-semibold` |
| Tracking, leading (85-86, 88-90) | 5 | `--tracking-*`, `--leading-*` (`--leading-tight` replaces Tailwind's) | `tracking-title` |
| Radii (94-103) | 10 | `--radius-<same>` | `rounded-control` |
| Shadows (107-108) | 2 | `--shadow-<same>` | `shadow-float` |
| Sizes (112-121) | 10 | `--size-*` (`touch`), `--height-*` (`control`, `topbar`, `tabbar`), `--width-page`, `--spacing-gutter-*` | `h-control`, `max-w-page` |
| Motion (125-128) | 4 | `--ease-out` (replaces Tailwind's); the durations stay plain variables | `ease-out duration-(--duration)` |
| Layers (130-131) | 2 | `--z-index-bar`, `--z-index-float` | `z-float` |

Names that must change in code: `web/src/layout/viewport.ts:6-7` (`TAB_BAR_HEIGHT = 76` "must equal `--tabbar-height`"; keep it equal and say which token), `web/src/components/cover.ts:3`, the comments at `web/index.html:8` and `web/vite.config.ts:176-177` (the manifest's raw `#F5F5F3`, which stays raw), `DESIGN.md:284, 298, 426`, [wiki/design.md](../../wiki/design.md):10-11 (a link to `tokens.css`, which will break) and [wiki/decisions.md](../../wiki/decisions.md):147.

### Classes the code and tests read

- **Behaviour hooks:** brief 06 replaces the four class-name queries (`.library-chip__remove`, `.library-panel__scroll …`, `.topbar`) before this brief deletes the classes. Re-run `grep -rn "querySelector" web/src` first.
- **Tests: two touchpoints, not thirty.** `web/src/auth/auth.test.ts:36` matches `class="button button--primary button--large button--pill[^"]*"`; rewrite it to the role and text. `web/src/components/cover.test.ts:6-11, 69-75` **reads `web/src/styles/tokens.css`** and matches `--cover-(\d+)-(bg|ink): #hex`. It reads a file this brief deletes, and `--color-cover-1-bg` does not match `--cover-1-bg` (the regex needs two dashes before `cover`). Point it at `index.css` and the new names in the same commit that moves the tints, or it fails with "toBeDefined".
- **Variable-driven styling stays:** `--cover-width` and `--cover-title-size` (`CoverImage.tsx:41, 64`), `--value` (`CipReader.tsx:232`), eight `[data-tint="N"]` rules (`components.css:388-425`), which become `data-[tint=N]:` variants or a class map in `cover.ts`.

### Gotchas Tailwind brings to this app

- **The 15 px root.** `base.css:9` sets `font-size: var(--text-body)` on `:root`. Tailwind's rem scale would come out at 15/16. Four rem values exist: `add.css:246` (`22rem`), `CameraScanner.css:10, 34, 80` (`16rem`, `22rem`, `28rem`), 330, 240, 330 and 420 px today. Decision 5.
- **Default names collide:** `--font-sans`, `--ease-out`, `--leading-tight`, and Tailwind's palette, text, radius and shadow scales. Clear each namespace (`--color-*: initial`, …) before defining Shelfmark's.
- **`tailwind-merge` needs `extendTailwindMerge`.** Eleven text-size names (`text-body`, `text-label`, …) next to colour names (`text-ink`, `text-muted`) would otherwise drop each other in `cn()`. `web/src/lib/cn.ts` has a test for `cn("text-ink", "text-body")`.
- **Opacity shorthand changes the colour space.** Tailwind 4.3.5 compiles `bg-ink` with a 32% modifier to `color-mix(in oklab, var(--color-ink) 32%, transparent)` (checked 2026-11-10). Shelfmark writes `color-mix(in srgb …)`. Of the 19 mixes outside `tokens.css`, 17 mix with `transparent`, where oklab and sRGB give the same colour at that alpha, so `bg-ground` with a 92% opacity modifier is safe. The other two (`library.css:323`, `:754`) and the five derived tokens mix two colours, so they stay explicit `color-mix(in srgb …)`, never `/NN`.
- **Breakpoints.** `max-md:` is `width < 48rem`, and media queries ignore the root font size, so it is today's `max-width: 767.98px`. Four blocks in `library.css` say `767px`; they join the rest (a sub-pixel difference to list). `md:` equals `DESKTOP_QUERY` (`viewport.ts:4`). `pwa.css`'s `min-width: 768px` is `md:`.
- **`hover:`** is hover-capable only in v4; `library.css:1137` already is. The other `:hover` rules (37 in all, counted with `grep -rn ":hover" web/src --include=*.css`) will no longer stick after a tap: an expected difference to list.
- **Container query:** `@container cover (max-width: 72px)` (`components.css:490`) becomes `@max-[72px]/cover:`.
- **Preflight vs `base.css`.** Port what `base.css` adds beyond preflight to `@layer base`.

## Owner decisions (defaults this brief builds)

1. **Token names** (Q17). Default: Shelfmark's, which are DESIGN.md's, in Tailwind's namespaces.
2. **Dark mode** (Q18). Default: none; light only stays.
3. **Visual parity** (Q19). Default: screenshots at 1280 × 800 and 390 × 844, plus 768 and 767 for the shell's switch; every difference fixed or listed.
4. **The 15 px root.** Default: `--spacing: 4px` with the default scales cleared, and the four rem values written in px. The alternative is to move 15 px to `body`. *New question for the grilling* (any estate app with a non-16 px root meets it).
5. **Preflight.** Default: preflight plus the ported `base.css`. Fallback if the native controls shift: `theme.css` and `utilities.css` only, keeping `base.css`'s resets.
6. **Motion.** Default: parity. Seven `--animate-*` entries under `motion-safe:`, enter animations on mount as today, no new exit animations.
7. **Order** (Q20). Default: eighth, after Almanac, whose `index.css` and `cn()` skeleton it can copy. It depends on no other app's migration.
8. **Brief 04's page.** Whichever lands second takes the styling of the first. If recommendations lands first, `web/src/recommendations/*.css` is a fourteenth file in step 3; if second, it is written in Tailwind from the start.

## Files you OWN

- `web/src/**/*.css` (all thirteen go), `web/src/styles/index.css` and `web/src/lib/cn.ts` with its test (new).
- The `className` values in `web/src/**/*.tsx`.
- `web/src/main.tsx` (the style imports), `web/vite.config.ts` (the plugin), `web/index.html` (the comment).
- `web/src/components/cover.ts`, `cover.test.ts`, `web/src/layout/viewport.ts` (names and comments), `auth/auth.test.ts:36`.
- Dependencies, pinned: `web/package.json` gets `tailwindcss` 4.3.5, `@tailwindcss/vite` 4.3.5, `clsx` 2.1.1, `tailwind-merge` 3.7.0; the root gets `eslint-plugin-better-tailwindcss` 4.10.0; `package-lock.json`. Check `@tailwindcss/vite`'s peer range against Vite 8.3.5.
- `eslint.config.js`: the `better-tailwindcss` block only, `entryPoint: "web/src/styles/index.css"`.
- `DESIGN.md` (body text naming tokens and utilities; the front matter's values do not change), `scripts/conventions.json`, `.claude/rules/web.md`.
- Corpus: [wiki/decisions.md](../../wiki/decisions.md), [wiki/design.md](../../wiki/design.md), [wiki/overlays.md](../../wiki/overlays.md), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `server/`, `shared/`.
- Behaviour: handlers, the TanStack Table logic in `web/src/library/` beyond class names, focus handling, routes, props of `ui/` wrappers.
- The values in `DESIGN.md`'s front matter.

## What to do

One commit per step; after each, `npm run check` and `npm run build` pass.

1. **Screenshots before.** Bring the app up as [docs/images/shots.md](../../../docs/images/shots.md) does (scratch `DATA_DIR`, the `demo` user, `docs/images/demo-seed.mjs`). Freeze the clock with Playwright's `page.clock`, copy the seeded data folder, keep images out of git. Each state at 1280 × 800 and 390 × 844 (plus the shell at 768 and 767): sign-in (also a failed sign-in and the session-ended notice), Library table and covers (ticked rows with the bulk bar, a page of 10, the pager, empty and loading), Filter and Columns, the Views menu and each dialog, Add a book in its three modes (the lookup outcomes the seed can reach; the camera stage only where a fake stream works), the book page (view, edit, cover panel, re-lookup, delete ask), import, stats, the account menu and dialogs, the update prompt, the offline notice, a keyboard focus ring. Record the CSS sizes above.
2. **Set up.** Add the dependencies and the Vite plugin. Write `index.css`: `@import "tailwindcss"`, `@theme` with the default namespaces cleared and the 86 tokens mapped, `--spacing: 4px`, the seven `--animate-*`. Keep `tokens.css` as aliases only (`--ground: var(--color-ground)`), so unmigrated files work. Add `cn.ts` with the test.
3. **One stylesheet at a time**, deleting each when empty, building after each:
   1. `base.css`, with `.visually-hidden` as `sr-only`.
   2. `components.css`, plus `auth.css`'s `.auth-field*` and `.auth-error*` and the `add-*` label, hint, error, choice, input and chip rules that `book/` shares (`add.css` 518-566, 774-897), with the `ui/` wrappers, `Button` (`buttonClass()` in `Button.tsx` stays the one place), `SegmentedControl`, `Sheet`, `CoverImage` (and `cover.test.ts`).
   3. `shell.css`.
   4. The rest of `auth.css`, then `account.css` together with `library.css`'s dialog section (1490-1602): one the `Dialog` wrapper look, which removes the two families.
   5. `pwa.css`, `stats.css`, `import.css`.
   6. `book.css`.
   7. `CameraScanner.css` with `add.css`'s camera stage (155-279) together, since `add.css:176` depends on their order.
   8. The rest of `add.css`.
   9. `library.css`, one commit per banner section: toolbar and collection tabs, filter chips, panels, table, covers, pager, messages, phone.
   10. `tokens.css`: delete it when `grep -rn "var(--" web/src` shows only `--color-*`-style names, `--cover-width`, `--value`, the positioner variables and the local variables listed above.
   11. `ScannerDemo.tsx`'s eleven inline styles become utilities.
4. **Lint.** Turn on `better-tailwindcss`'s correctness rules and class order as errors; fix what they find.
5. **Screenshots after.** Same states, same clock and data. Compare each pair with Playwright's comparison or pixelmatch. Fix every difference or list it with its reason. Expected: `hover:` not sticking after a tap, the sub-pixel `767px` blocks. Record the CSS sizes.
6. **Corpus.** In [wiki/decisions.md](../../wiki/decisions.md) revisit "Base UI under the menus, panels, dialog and switches": it says "styled by Shelfmark's own CSS and DESIGN.md's tokens" and rejected shadcn "which brings Tailwind". Both change by the owner's call of 2026-11-09; shadcn stays rejected for its own reason (Base UI is used directly, without a styled kit on top). Update [wiki/design.md](../../wiki/design.md) (the `tokens.css` link), [wiki/overlays.md](../../wiki/overlays.md), `DESIGN.md`, `.claude/rules/web.md` (tokens only from `@theme`, no arbitrary colours, no `/NN` on mixed colours), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md). `bash corpus/lint.sh --index`, then `bash corpus/lint.sh`.
7. **The gate.** Drop `check-base-ui`'s `--warn-only`.

## Acceptance

- [ ] `find web/src -name '*.css'` prints only `web/src/styles/index.css`.
- [ ] `check-base-ui` passes strict, with only the exceptions in `scripts/conventions.json`.
- [ ] `grep -rnE "(bg|text|border|fill|stroke|ring|outline|shadow)-\[(#|rgb|hsl)" web/src` and `grep -rnE "#[0-9a-fA-F]{3,8}\b" web/src --include=*.tsx` print nothing.
- [ ] `index.css`'s `@theme` defines exactly the mapped tokens; `bg-red-500` or `text-sm` in a component produces no CSS (checked with a throwaway compile).
- [ ] A `cn` test proves `cn("text-ink", "text-body")` keeps both classes.
- [ ] `npx vitest run web/src/components/cover.test.ts` passes against `index.css`, and finds all eight tints.
- [ ] The screenshot pairs match, with every difference listed, beside the before and after CSS sizes.
- [ ] `npm run check` and `npm run build` pass; [wiki/decisions.md](../../wiki/decisions.md) holds the revisit and `log.md` the entry; `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 06's moved and new wrappers (`Dialog`, `ConfirmDialog`, `Toast`, `ToggleGroup`, `Tabs`, `Panel`) are styled here like any other part.
- Brief 08 does not touch `web/`. Both change `package-lock.json`, so do not run them together.
