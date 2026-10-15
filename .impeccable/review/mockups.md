# Shelfmark mock-ups (Covers variant), transcribed from the design canvas

The owner's design canvas (artboards Covers-Desktop, Covers-Library, Covers-Add, plus
Calm-Add and Grid-Add for the scan outcomes the Covers set doesn't draw). Colours below
are the design.md tokens; the build must use the CSS custom properties in
web/src/styles/tokens.css, never the hex values.

## Covers-Desktop (1440 wide): Library as a table, Export menu open

- Top bar: 3-column grid (1fr auto 1fr), padding 12px 40px, 1px `hairline` bottom border.
  Left: wordmark "Shelfmark" 17px/600, -0.01em. Centre: nav segmented control on `control`
  (3px padding, radius 10), items 32px tall, padding 0 18px, radius 8, 14px; active item
  `surface` bg, `ink`, 600; inactive `ink-2`. Right: search field 240px wide, 34px tall,
  radius 9, `field` bg, magnifier icon 15px in `muted`, placeholder "Search"; account
  button 34px circle on `control`, person icon 17px in `ink-2`.
- Main: max-width 1180, padding 36px 40px 48px, column gap 18px.
- Toolbar row (wraps; align flex-end; space-between, gap 16):
  - Left: h1 "Library" 34px/700/-0.02em; under it "14 books, newest first" in `muted`.
  - Right (gap 8): View segmented control (Table | Covers) on `control`, padding 2, radius 8,
    buttons 30px tall, padding 0 12, radius 6, 13px, active `surface` + 600; "Filter"
    secondary button (34px, padding 0 12, radius 8, `control`, 14px); "Export" secondary
    (shown open: `accent-tint` bg, `accent-press` text, 600, aria-expanded); "Add a book"
    primary pill (34px, padding 0 16, radius 17, `accent`, white, 600).
  - Export menu: absolute under the button, 250px wide, padding 6, radius 12, `surface`,
    menu shadow. Section label "What you see now · 14 books" (12px/600 `muted`, padding
    6px 10px 2px); items "Excel workbook (.xlsx)" and "CSV" (36px tall, padding 0 10,
    radius 7, 14px, left aligned; hovered/selected row `#EDF5F8` = accent-tint-soft);
    second label "Every book, every field" (padding-top 10) and the same two items.
- Table: one container, radius 16, `surface`, overflow-x auto; table min-width 860.
  - Header row: 12px/600 `muted`, left aligned, padding 14px 12px 10px. Columns:
    "Book" (colspan 2, left padding 24), Publisher (150px), Year (64px, right aligned),
    Shelf (150px), Status (100px), Added (110px, right padding 24).
  - Body rows: 1px `divider` top border. Cell 1: cover 46×69, radius 3, cover shadow,
    padding 12px 6px 12px 24px. Cell 2: link (no underline) with title 16px/600 `ink` over
    author 14px `muted`, gap 2. Publisher 14px `ink-2`; Year 14px `ink-2`, right, tabular;
    Shelf 14px `ink`; Status 14px: Reading = `accent` 600, Read = `ink-2` 400, Unread =
    `muted` 400; Added 14px `muted` ("Today", "12 Oct").
- Sample rows: O vară cu Isidor / Veronica D. Niculescu / Polirom / 2021 / Living room · A2 /
  Unread; Paturi oculte / Doina Ruști / Litera / 2020 / Bedroom / Reading; Inocenții / Ioana
  Pârvulescu / Humanitas / 2016 / Living room · A2 / Read; The Road / Cormac McCarthy /
  Vintage / 2006 / Bedroom / Reading; Thinking, Fast and Slow / Daniel Kahneman / Farrar,
  Straus and Giroux / 2013 / Study · B1 / Read; Sapiens / Yuval Noah Harari / Harper / 2015 /
  Study · B1 / Unread; Crime and Punishment / Fyodor Dostoevsky / Penguin / 2003 /
  Study · B2 / Read.

## Covers-Library (390×844): Library on a phone, covers grid

- Header padding 14px 16px 12px, gap 10: row with h1 "Library" 32px/700/-0.02em and the
  account button (44px target, 32px circle on `control`). Search field: 40px tall, radius 10,
  `field`, icon 16px, placeholder "Search 14 books", input 16px (no iOS zoom).
- Row: View segmented control (Covers | Table — Covers first on the phone), buttons 30px,
  padding 0 14; on the right a quiet text button "Filter and sort" in `accent`, 15px.
- Grid: padding 4px 16px 0; 3 columns, column gap 14, row gap 18. Each item is a link:
  cover (aspect 2/3, radius 3, shadow `0 8px 16px rgba(27,27,29,.22), 0 1px 2px
  rgba(27,27,29,.2)`), gap 8, then title 13px/600 line-height 1.25 clamped to 2 lines,
  author 12px `muted`, one line with ellipsis.
- Tab bar: height 76px, padding-bottom 10, 1px `hairline` top, bg `#F9F9F7` (the `--bar`
  token). Two tabs, each a column: 24px stroke icon, label 11px; active `accent` 600,
  inactive `muted`. Library icon = a book; Add a book icon = a circle with a plus.

## Covers-Add (390×844): Add a book, scan outcome "Already in your library"

- The camera fills everything above the tab bar (dark `#1E1E20`, a vignette).
- Mode switch floats at top centre (top 16): segmented control on translucent ground
  (`rgba(245,245,243,.92)`), padding 3, radius 10; tabs "Scan" (selected, `surface`, 600),
  "Type ISBN", "By hand" — 32px tall, padding 0 14, radius 8, 14px. role=tablist.
- Viewfinder: 240×132 rounded frame (radius 14), 3px white border, centred-ish over the
  barcode.
- Result sheet: absolute, 12px from left/right/bottom, padding 16, gap 14, radius 20,
  `surface`, shadow `0 16px 40px rgba(0,0,0,.35)` over the camera.
  - Row: cover 60×90 (radius 3, cover shadow), then a column: status line with a check
    icon "Already in your library" (13px/600 `accent`), title 20px/700/-0.01em ("Dune"),
    "Frank Herbert · Ace · 2020" in `ink-2`, "Living room · A3 · added 3 Mar 2026" 14px
    `muted`.
  - Primary: "Scan the next one" — 48px, radius 24, `accent`, white, 16px/600, full width.
  - Then a row of two secondary pills (44px, radius 22, bg `#EFEFEC`, 15px): "Add another
    copy", "Open the book".

## Calm-Add (found outcome — redraw in the Covers world)

Camera on top (220px tall with a torch button top-right, 40px round, "Turn on the torch"),
then the found book: cover 52×78; "Found in Open Library" 12px muted; title 18px/700
("O vară cu Isidor"); author; "Polirom · 2021 · 218 pages" 13px muted. Then a "Shelf" label
(12px/600) with chips: "Living room · A2" (selected), "Study · B1", "Bedroom", and a dashed
"New shelf" chip. "Status" label with chips Unread (selected), Reading, Read. Primary
"Save and scan the next one" (48px). Under it a row: "Not this book" (quiet, left) and
"Edit details" (accent text, right). In the Covers world this content sits in the floating
white sheet over the camera, with Covers' chips (flat `control` fills, selected =
`accent-tint` with `accent-press` text, no coloured per-shelf tints).

## Grid-Add (not-found outcome — redraw in the Covers world)

A notice: "No match for **9786063205583** in Open Library or Google Books. Fill in what the
cover says; the rest can wait." Then a short form: Title (required, focused), Author
(optional), Publisher (optional) and Year (numeric, side by side 2:1), Shelf; a dashed box
"No cover found. Take a photo of the front." with a "Photo" button; primary "Save and scan
the next one" (48px pill); quiet "Discard this scan" under it. Inputs 42px tall, 16px text.
