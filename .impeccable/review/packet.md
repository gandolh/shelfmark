# Finish review packet: Shelfmark v1 web UI (brief 13)

Round 1, 2026-10-15. Project root `/home/gandolh/projects/shelfmark`; the artifact
is the React PWA in `web/src` (served by Vite at `/shelfmark/`, API at
`/shelfmark-api`). Platform: web. Mode: Operate.

## The owner's original request

A catalog of the owner's physical books. On 2026-10-14 the owner chose the
category standard, **a familiar table app played straight, light**, over three
themed directions, then chose its **Covers** variant (calibrated on Apple's own
apps: the cover leads, the chrome recedes, one interactive colour). **Exactly
two places: Library and Add a book.** Account items live in a menu, not a
Settings page. The book page (`/books/:id`) and the login page are routes inside
Library's world, not places of their own; don't read them as a third place.

The owner rejected a metaphor-driven UI in another project as hard to navigate,
so conventional navigation is a hard preference.

## Inputs

| What | Path |
|---|---|
| Direction contract | `/home/gandolh/projects/shelfmark/corpus/wiki/design.md` |
| Product record | `/home/gandolh/projects/shelfmark/PRODUCT.md` |
| Tokens (the only place a colour is written) | `/home/gandolh/projects/shelfmark/web/src/styles/tokens.css` |
| Vocabulary for UI copy | `/home/gandolh/projects/shelfmark/corpus/wiki/glossary.md` |
| Craft floor | `/home/gandolh/projects/my-personal-skills/skills/impeccable/reference/craft-floor.md` |
| Critique reference | `/home/gandolh/projects/shelfmark/.impeccable/review/mockups.md` |
| App icon | `/home/gandolh/projects/shelfmark/web/public/icon.svg`, rendered: `/home/gandolh/projects/shelfmark/web/public/icons/icon-192.png`, `maskable-512.png` |

- **Approved comp: none.** This is a code-led build. `mockups.md` is the
  critique reference: measurements transcribed from the owner's design canvas
  (artboards Covers-Desktop, Covers-Library, Covers-Add; the found and not-found
  outcomes come from the Calm-Add and Grid-Add artboards, to be redrawn in the
  Covers world). The canvas itself isn't reachable this session.
- **QUALITY BAR card: none exists** for this project. Judge against the
  direction contract, the craft floor, and the critique reference.
- **Detector** (`node …/impeccable/scripts/detect.mjs --json web/src`), run once
  before this review: `[]`, zero findings, no inline ignores in `web/src`.
  No colour literal exists in any CSS/TS file outside `tokens.css` (grep).

## Constraints on any fix you propose

- Every colour from a token in `tokens.css` (new derived tokens there are fine;
  new hues are not). Light only; the camera view is dark because it is a camera.
- English copy, using the glossary's words (book, collection, shelf, status,
  lookup, draft).
- No new top-level place. The scanner never navigates while the camera runs.
- The Owned / Wishlist tabs that design.md describes belong to the **v1.x
  wishlist brief**, not v1: Library shows owned books only on purpose
  (`web/src/library/view.ts`, comment in `LibraryPage.tsx`). Their absence is
  not a defect in this build.

## Capture notes

- Headless Chrome on Linux: `system-ui` renders as DejaVu Sans, wider and
  rounder than the owner's real system font (Segoe UI / SF). Judge type
  metrics with that in mind; a label that only just fits here fits elsewhere.
- Viewport captures unless named `-full`; `prefers-reduced-motion: reduce` was
  set so no entrance motion was mid-flight. In the two `-full` captures the
  sticky top bar is drawn about 10 px lower than live (a full-page capture
  artifact, not a layout bug).
- Seed data: 40 books (the mock-ups' sample books plus synthetic ones, 20 with
  real Open Library covers, 20 with the typographic placeholder), 37 owned and
  3 on the wishlist (hidden in v1). All were added today, so "Added" reads
  "Today" on every row.
- Desktop Add a book was driven through **Type ISBN** (9780547928227 = found,
  9786063205583 = not found, 9780441172719 = already owned). On the phone the
  camera has nothing to open in headless Chrome, so Scan is captured in its
  "No camera found" state and the three outcomes through Type ISBN.

## Screenshots (all required; each one opened and checked)

Directory: `/home/gandolh/projects/shelfmark/.impeccable/review/`.
`desktop.png` is a copy of `desktop-library-table.png`; `mobile.png` is a copy
of `mobile-library-covers.png`.

### Desktop, 1440×900

| File | Shows |
|---|---|
| `desktop-login.png` | Login page, signed out |
| `desktop-login-offline.png` | Login with the offline notice, 1440×900 |
| `desktop-login-offline-720.png` | Same at 1440×720: the notice touches the heading |
| `desktop-library-table.png` | Library, Table view (default sort: Added, newest first) |
| `desktop-library-sorted-year.png` | Table sorted by Year: the header truncates to "Y…" |
| `desktop-library-covers.png` | Library, Covers view |
| `desktop-filter-columns.png` | Filter panel open at its column list |
| `desktop-filter-open.png` | Shelf filter open with two shelves ticked; chip row under the toolbar |
| `desktop-export-menu.png` | Export menu open (compare Covers-Desktop) |
| `desktop-account-menu.png` | Account menu open |
| `desktop-add-default.png` | Add a book, Type ISBN, empty |
| `desktop-add-found.png` | Outcome: found (The Hobbit) |
| `desktop-add-notfound.png` / `-full.png` | Outcome: not found, viewport and full page |
| `desktop-add-owned.png` | Outcome: already in your library (Dune) |
| `desktop-book.png` / `desktop-book-full.png` | Book page, The Road (real cover, every field filled) |
| `desktop-book-nocover.png` | Book page, Inocenții (placeholder cover, short fact lists) |

### Phone, 390×844

| File | Shows |
|---|---|
| `mobile-login.png` | Login page |
| `mobile-library-covers.png` | Library, Covers view (phone default) |
| `mobile-library-table.png` | Library, Table view (scrolls sideways by design) |
| `mobile-filter-open.png` | "Filter and sort" sheet at its first level |
| `mobile-filter-status.png` | Status filter with two values ticked, chip row behind |
| `mobile-library-filtered.png` | Sheet closed, chip row under the toolbar |
| `mobile-add-scan.png` | Add a book, Scan, the camera's "No camera found" state |
| `mobile-add-type.png` | Type ISBN, empty |
| `mobile-add-found.png` | Outcome: found |
| `mobile-add-notfound.png` | Outcome: not found. The page auto-scrolled to the sheet when the form appeared, so the ISBN field is off-screen above by design |
| `mobile-add-owned.png` | Outcome: already in your library |
| `mobile-book.png` / `mobile-book-scrolled.png` | Book page, The Road, top and scrolled 700 px |

## Known issues collected during the build (weigh each; none was fixed blind)

1. **Year header truncates.** Unsorted it fits ("Year", 64 px column). Sorted by
   Year the sort arrow pushes it to "Y…" (`desktop-library-sorted-year.png`;
   the header button measures 52 px in a 64 px column, its label clipped to
   24 of 30 px).
2. **Offline notice vs. the login heading.** The notice is `position: fixed`
   (`web/src/pwa/OfflineNotice.tsx`, `pwa.css`). With no top bar on the login
   page, it sits just above the heading at 1440×900 and touches it at
   1440×720 (`desktop-login-offline*.png`).
3. **App icon reads as a bar chart.** `web/public/icon.svg`: three accent spines
   on a shelf with a label band. No screenshot; see the rendered PNGs above.
   Regeneration: `npm run icons -w @shelfmark/web`; keep the maskable safe zone.
4. **Desktop Add a book leaves the right half empty.** The form column sits left
   (≈600 px); the mode switch floats right (`desktop-add-*.png`).
5. **Book page cover is large next to short fact lists.** A 260 px sticky cover
   (`desktop-book-nocover.png` shows it worst).
6. **Three chip vocabularies:** `.add-chip*` (shelf/status toggles in the add
   sheet), `.book-chip*` (removable tags on the book page and edit form),
   `.library-chip*` (active filter chips). Deliberate in the build; judge
   whether they read as one family (`desktop-add-found.png`,
   `desktop-book-full.png`, `desktop-filter-open.png`).
7. **Small placeholder covers.** At 46×69 in the table the placeholder still
   prints title and author; the text is barely legible
   (`desktop-library-table.png`). Should it drop to a simpler mark at that size?

## Also seen while validating the captures (unweighed; yours to judge)

- Phone book page: each fact's value is indented about 40 px under its label
  (`mobile-book.png`, `mobile-book-scrolled.png`).
- Phone Library toolbar mixes two quiet text buttons ("Columns", "Filter and
  sort") with a filled, taller "Export" button, and wraps onto a second line in
  Table view (`mobile-library-table.png`, `mobile-library-covers.png`).
- Desktop book page: "Edit" and "Re-run lookup" end at the page's right edge
  (≈1270 px) while the fact cards stop at ≈1190 px (`desktop-book.png`).

## What I need back

Your five contract sections and a disposition word. Fixes are applied in one
batch, recaptured over the same files, and sent back to you for a verdict pass.
At most two fix rounds; what's open after that goes to the owner.

---

## Outcome (2026-10-15)

- **Round 1 review: `fix`.** Seven material fixes: (1) the phone Library
  toolbar as one quiet row, with Columns moved into "Filter and sort"; (2) the
  book page's leaked `dd` indent; (3) the book page's header actions ending
  past the cards; (4) the desktop Add a book mode switch cut off from its
  column; (5) the Year header clipped when sorted; (6) the offline notice on
  the login page; (7) the app icon reading as a bar chart. Known issues 5 and
  6 were ruled fine as built; 7 is the owner's call.
- **Fixes applied in one batch**, recaptured over the same files, plus
  `desktop-add-scan.png`, `desktop-add-manual.png`,
  `mobile-filter-columns.png`, `mobile-login-offline.png` and
  `icon-preview.png`.
- **Verdict pass: all seven resolved, `ship`.** The ship covers the scored
  fixes, not a fresh full review.
- **Left for the owner:** the 46×69 placeholder's text (known issue 7); a
  larger cover in the desktop Add result (the reviewer's ceiling note); the
  Sign in with Ward states, never captured because Ward wasn't configured.
