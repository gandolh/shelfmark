# Task 04: App shell, design tokens and the books client

## Context

The frame every screen sits in, and the one place the design's values live.
Read [design.md](../../wiki/design.md) first: the chosen world is the familiar
table app in its **Covers** variant (light, system font, one teal accent, the
cover is the only thing with a shadow). The mock-ups are on the design canvas
linked there (`Covers-Desktop`, `Covers-Library`, `Covers-Add`). Words follow
[glossary.md](../../wiki/glossary.md).

Load the `impeccable` skill before writing UI. The world is decided: do **not**
run a new direction round; build inside design.md and treat it as the
direction contract.

Depends on briefs 01 and 02 (the shared `Book` schema).

## Files you OWN

```
web/src/main.tsx  web/src/App.tsx  web/src/base.ts
web/src/router.ts  web/src/router.test.ts
web/src/api.ts  web/src/api.test.ts
web/src/books/store.ts  web/src/books/store.test.ts
web/src/styles/tokens.css  web/src/styles/base.css
web/src/layout/AppShell.tsx  web/src/layout/TopBar.tsx  web/src/layout/TabBar.tsx  web/src/layout/AccountMenu.tsx
web/src/account/actions.ts        (stubs; briefs 06 and 11 fill them)
web/src/components/CoverImage.tsx  web/src/components/cover.test.ts
web/src/components/SegmentedControl.tsx  web/src/components/Button.tsx
web/src/components/Menu.tsx  web/src/components/Sheet.tsx
web/src/library/LibraryPage.tsx   (stub; brief 08 replaces it)
web/src/add/AddBookPage.tsx       (stub; brief 09 replaces it)
web/src/book/BookPage.tsx         (stub; brief 10 replaces it)
```

## Files you must NOT touch

Anything under `server/`, `shared/`, `corpus/` (except the outcome note).

## What to do

1. **Tokens.** `tokens.css` defines every token in design.md's table as a CSS
   custom property with exactly those values, plus the type scale, radii and
   the two elevations. `base.css`: `color-scheme: light`, the system font
   stack, tabular figures where numbers align, and the browser surfaces themed
   from the palette (text selection, focus ring in the accent, caret,
   scrollbars). No other file hard-codes a colour.
2. **Router** (`router.ts`): a small History API router under the base path,
   in the shape of Satchel's `web/src/router.ts`, no routing library. Routes:
   `/` Library, `/add` Add a book, `/books/:id` the book page, `/login`
   (brief 06). Links navigate without a reload. Test the matching and the base
   path handling.
3. **API client** (`api.ts`): `fetch` under `/shelfmark-api`, JSON in and out,
   errors parsed into one `ApiError` type (`code`, `message`, `status`); a
   `401` raises a dedicated "signed out" signal brief 06 listens to.
4. **Books client** (`web/src/books/store.ts`): loads `GET /api/books` once, keeps the
   list in memory, exposes a `useBooks()` hook (`books`, `status`, `error`,
   `refresh`) and `createBook`, `patchBook`, `deleteBook` that update the list
   in place. One fetch per session unless refreshed.
5. **Shell.** Desktop (≥ 768 px): the top bar in three columns (wordmark
   "Shelfmark", the two places as a segmented control in the centre, search
   slot and account button on the right). Phone: a large page title and a
   two-tab bar at the bottom (Library, Add a book). Exactly two places; no
   Settings, no Loans ([decisions.md](../../wiki/decisions.md)).
6. **Account menu**: Change password, Sign in with Ward, Download a backup (the
   SQLite file, brief 11), Sign out. Each calls a function in
   `web/src/account/actions.ts`; leave them as stubs that say "not yet" for briefs 06
   and 11 to fill.
7. **CoverImage**: given a book, shows `/shelfmark-api/api/books/:id/cover`
   when `hasCover`, else the **no-cover placeholder**: a 2:3 typographic cover
   with title and author on a tint chosen deterministically from the title out
   of eight tints, each passing 4.5:1 for its text. It carries the cover
   shadow from the tokens. Many Romanian books will show this, so it must look
   designed, not missing ([design.md](../../wiki/design.md)). Test the tint
   choice is stable and every tint passes contrast.
8. **Small components** used across briefs: `SegmentedControl`, `Button`
   (primary accent pill, secondary on `control`, quiet text), `Menu` (keyboard
   operable), `Sheet` (the floating white sheet). Real `<button>`s and
   `<a href>`s, 44 px touch targets on the phone.
9. The three page stubs render their title only.

## Acceptance

- Both places render on desktop and phone widths; navigation never reloads.
- Every colour in the CSS comes from a token; the tokens equal design.md's
  table.
- `node <impeccable>/scripts/detect.mjs --json web/src` reports nothing
  material, or the outcome note says why a finding stays.
- `npm run typecheck && npm run lint && npm test` pass.
