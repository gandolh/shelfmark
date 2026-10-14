# Task 08: Library page

## Context

The page the product is about: every owned book, sortable, filterable by any
column, searchable, as a table or as covers. Read
[library-table.md](../../wiki/library-table.md) (views, filter per column kind,
search, sorting, layout memory) and [design.md](../../wiki/design.md) (the
Library section; mock-ups `Covers-Desktop` and `Covers-Library`). Load
`impeccable` and build inside that world.

v1 shows the **owned** collection only. The Owned / Wishlist tabs come with the
wishlist brief (v1.x); keep the page so a collection switch can sit under the
title later without a rewrite.

Depends on briefs 04 (shell, books client, CoverImage) and 02.

## Files you OWN

```
web/src/library/LibraryPage.tsx   (replaces brief 04's stub)
web/src/library/BookTable.tsx  web/src/library/CoversGrid.tsx
web/src/library/Toolbar.tsx  web/src/library/FilterPanel.tsx  web/src/library/FilterChips.tsx
web/src/library/ColumnPicker.tsx  web/src/library/columns.ts
web/src/library/search.ts  web/src/library/search.test.ts
web/src/library/filters.ts  web/src/library/filters.test.ts
web/src/library/sort.ts  web/src/library/sort.test.ts
web/src/library/prefs.ts  web/src/library/prefs.test.ts
web/src/library/view.ts            (the current rows and visible columns, for brief 11)
web/package.json                   (@tanstack/react-table, @tanstack/react-virtual)
```

## Files you must NOT touch

The shell, router, books client (use them), the server.

## What to do

1. **Engine.** TanStack Table (headless; current major, v9 on 2026-10-14; read
   its docs for the v9 API rather than assuming v8) and
   `@tanstack/react-virtual`, both pinned at releases at least two weeks old.
   All filtering, sorting and searching in the browser over `useBooks()`.
2. **Columns** (`columns.ts`): one definition per book field with its kind
   (text, pick-list, number, date, yes/no) and how it sorts and filters. The
   first column is the book itself (cover, then title over author). Visible by
   default: book, publisher, year, shelf, status, added. Everything else via
   the column picker.
3. **Search** (`search.ts`): one box over title, subtitle, authors, publisher,
   series, ISBN, tags and notes; case- and diacritics-insensitive (NFD, drop
   combining marks, so ș/ş → s and ț/ţ → t); ISBN ignores hyphens and spaces.
   "cartarescu" finds "Cărtărescu".
4. **Filters** (`filters.ts`, `FilterPanel`, `FilterChips`): Filter opens the
   list of columns, then that column's filter by kind: text contains / is
   empty / is not empty; pick-list multi-select of values present with counts
   (a new shelf appears as soon as a book uses it); number and date ranges;
   yes/no/any. Active filters show as removable chips under the toolbar, with
   "Clear all".
5. **Sorting** (`sort.ts`): header click sorts, shift-click adds a key; text
   with `Intl.Collator('ro', { sensitivity: 'base', numeric: true })`; authors
   by `authorSort`. Default: newest first.
6. **Views.** Table/Covers switch (desktop default Table, phone default
   Covers). Table: the white rounded container, virtualised rows, sticky
   header. Covers: a grid (three columns on a phone) with a two-line title and
   the author, as in `Covers-Library`. A row or cover opens the book page.
7. **Layout memory** (`prefs.ts`): column order, widths, visibility, sort and
   view per device in `localStorage`, every access in try/catch; a missing or
   broken value falls back to the defaults.
8. **Toolbar** per design.md: title and count ("14 books, newest first"), the
   view switch, Filter, an empty slot where brief 11 puts Export, and the
   accent "Add a book" pill. `view.ts` exposes the rows after filters, search
   and sort, and the visible columns in order, for the export.
9. **States:** loading, error with retry, empty library ("No books yet" with
   "Add a book"), no results for the current filters ("No books match" with
   "Clear filters").

## Acceptance

- With 3,000 synthetic books, typing in search and toggling a filter update in
  under 50 ms, and scrolling stays smooth.
- Unit tests: diacritics folding, every filter kind, multi-key sort with
  Romanian collation, prefs fallback on corrupt storage.
- Keyboard: every control reachable; filters and the column picker operable
  without a mouse.
- impeccable's detector run on `web/src/library`; `npm run typecheck && npm
  run lint && npm test` pass.
