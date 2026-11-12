# Task 09: A redesign with Hallmark, on the estate board

**Depends on:**

- In Shelfmark:
  - [brief 04](../done/04-wishlist-with-recommendations.md), which adds the Wishlist place and its page, so the redesign covers three places, not two;
  - [brief 07](../done/07-the-web-app-to-tailwind.md), which moves the styling to one stylesheet of tokens in Tailwind and adds the Light / Dark / System switch. A redesign is then mostly a new token set and layout;
  - [brief 06](../done/06-base-ui-by-the-conventions.md), whose wrappers the redesign keeps working.
- In the owner's skills library:
  - brief 24, which vendors Hallmark as the design skill and adopts taste-skill 2.5's ideas (palettes and type dealt by trade, its copy layer);
  - the estate redesign board: one artifact with a page per app, owned by the skills library.
- The owner's answer of 2026-11-10 (Q39): no bake-off; Hallmark redesigns every web UI, keeping what is useful from taste-skill 2.5, and the owner approves each app on the board before any code changes.

**Runs after:** 04, 05, 06, 07 and 08, the redesign last.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

Shelfmark is a catalog of the owner's physical books: a familiar table app where the cover leads and the chrome recedes. One user, on a laptop at the shelf and on an Android phone with the camera.

### The screens (read 2026-11-10, `web/src/router.ts` and `web/src/layout/AppShell.tsx`; Wishlist is planned by brief 04)

| Screen | Route | File |
|---|---|---|
| Library, table and covers, with the Filter and Columns panels, the Views menu and the bulk bar | `/` | `web/src/library/LibraryPage.tsx`, `BookTable.tsx`, `CoversGrid.tsx`, `FilterPanel.tsx`, `ColumnPicker.tsx`, `BulkBar.tsx` |
| Add a book, in its three modes (scan, ISBN, by hand), the result sheet, the CIP read | `/add` | `web/src/add/AddBookPage.tsx`, `ModeSwitch.tsx`, `ResultSheet.tsx`, `ManualForm.tsx`, `CipReader.tsx` |
| **Wishlist**, with its Add a book button, recommendations, download and prompt, and Import (new, brief 04) | `/wishlist` (final name set by brief 04) | `web/src/wishlist/` |
| A book | `/books/:id` | `web/src/book/BookPage.tsx`, `BookDetails.tsx`, `EditForm.tsx`, `CoverPanel.tsx` |
| Import a CSV | `/import` | `web/src/import/ImportPage.tsx` |
| Stats | `/stats` | `web/src/stats/StatsPage.tsx` |
| Sign in, and the session-ended notice | `/login` | `web/src/auth/LoginPage.tsx`, `AuthGate.tsx` |
| The shell: top bar with the three places, search, the account menu and its dialogs, the phone tab bar, the update prompt and offline notice | every page | `web/src/layout/TopBar.tsx`, `TabBar.tsx`, `AccountMenu.tsx`, `web/src/account/`, `web/src/pwa/` |

### What the design docs fix today

- [DESIGN.md](../../../DESIGN.md) records the shipped design system (the token-only rule, the radii, the 44 px targets, the phone layout), and [PRODUCT.md](../../../PRODUCT.md) is the product truth. [wiki/design.md](../../wiki/design.md) holds how the look was chosen.
- [wiki/decisions.md](../../wiki/decisions.md) records the look: from three themed directions (Dictionary, Ledger, Departures) and three light variants, the owner chose **Covers** (the cover leads, the chrome recedes, one teal accent) on 2026-10-14, and rejected the themed directions because they make the owner learn a metaphor before finding a book. The owner's standing preference is familiar, conventional navigation. The same file records that the navigation is Library, Add a book and Wishlist (revisited 2026-11-10), and that account items live in a menu, with no Settings tab and no loans.
- The theme is the owner's call of 2026-11-10 (Q18): Light / Dark / System, light on a first visit, built in brief 07. The camera view is dark in both because it is a camera.
- English only, physical books only, an Android phone as the main phone.

The redesign stays inside these decisions unless the owner reopens one on the board.

## Owner decisions

Answered 2026-11-10: Q39 (Hallmark, with taste-skill 2.5's useful parts; approval on the board first). Default: the proposal keeps the Covers direction, the table-first Library, the conventional three-place navigation and the account menu. Anything that moves one of those, including a different metaphor, is flagged on the board as a reopened decision.

## Files you OWN

- The token set in `web/src/styles/index.css` (both themes) and the screens listed above, one commit each.
- `DESIGN.md`, recorded from the shipped result.
- Corpus: [wiki/design.md](../../wiki/design.md) and [wiki/decisions.md](../../wiki/decisions.md) (the look, if it changes), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `server/` and `shared/`.
- The Ward library in `web/vendor/`.
- Behaviour: handlers, the lookup and scan flows, the TanStack Table logic beyond class names, the `ui/` wrappers' props.
- The copy's meaning: wording keeps the glossary's terms unless the board approves a change. No invented facts or numbers: a recommendation's reason, a count and a book's data come from the library or the picks.

## What to do

1. **Today.** Take Playwright screenshots of every screen above at 1280 and 390 px, in light and dark, kept out of git, with the demo data ([docs/images/shots.md](../../../docs/images/shots.md)). Include the table and the covers, the open Filter and Columns panels, the bulk bar, the Add a book modes and result sheet, the Wishlist with and without recommendations, the open menus and the dialogs.
2. **Propose.** With Hallmark (and taste-skill 2.5's trade palettes and copy layer where they help), make a proposal per screen, inside the recorded decisions. Check each against the Floor: contrast, a visible focus ring, a reduced-motion path, no invented facts, no broken phone layout.
3. **Board.** Put the proposals on this app's page of the estate board, beside today's screenshots at both widths.
4. **Approval.** The owner approves on the board. Nothing below starts before that, and the approval is recorded in `log.md` with its date.
5. **Build.** First as a token change (colours, radii, shadows, type, spacing, both themes), then one screen per commit. Keep the Base UI wrappers and the theme switch working, and keep the cover tints' placeholder role.

## Acceptance

- [ ] The owner's approval is on the board and recorded in `log.md` with the date.
- [ ] Contrast: every text and icon pair in both themes clears 4.5:1 (3:1 for large text and UI parts), measured with a script over the built tokens and listed in the outcome note.
- [ ] A Playwright test tabs through each screen and asserts a visible focus ring on every stop.
- [ ] A Playwright test with `reducedMotion: "reduce"` asserts no running animation or transition on each screen.
- [ ] A Playwright test at 390 px asserts `document.documentElement.scrollWidth <= window.innerWidth` on each screen, and every touch target is at least 44 px.
- [ ] Every figure and book shown comes from the data; the outcome note lists none invented.
- [ ] Light, dark and system all render every screen, and the first visit is light.
- [ ] `npm run check` and `npm run build` pass, and `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 07 owns the tokens, the dark set and the switch; this brief re-tunes them and the layout on top. The camera view stays dark.
- Brief 04's Wishlist page is a screen of its own here: the wished-for books, the Add a book button and the recommendations share one page, so the proposal must keep the recommendations visibly apart from the books the owner chose.
- Brief 06's wrappers (`Dialog`, `Menu`, `Tabs`, `ToggleGroup`, `Toast`, `Panel`) are restyled through tokens, not rewritten.
- Brief 05's formatter and lint run on every redesign commit.
