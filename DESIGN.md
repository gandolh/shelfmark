---
name: Shelfmark
description: A catalog of the owner's physical books. A familiar table app, light, where the cover leads and the chrome recedes.
colors:
  ground: "#F5F5F3"
  surface: "#FFFFFF"
  control: "#E6E6E2"
  field: "#E9E9E6"
  hairline: "#E2E2DF"
  divider: "#ECECE9"
  ink: "#1B1B1D"
  ink-2: "#45454A"
  muted: "#5F5F65"
  accent: "#0E6E8C"
  accent-press: "#0A4F65"
  accent-tint: "#DCEDF2"
  accent-tint-soft: "#EDF5F8"
  cover-1-bg: "#7B2D35"
  cover-1-ink: "#F7EEE6"
  cover-2-bg: "#D4A23A"
  cover-2-ink: "#2A1F10"
  cover-3-bg: "#33503E"
  cover-3-ink: "#EEF0E2"
  cover-4-bg: "#2C3E57"
  cover-4-ink: "#EAEFF5"
  cover-5-bg: "#5C3F78"
  cover-5-ink: "#F2ECF7"
  cover-6-bg: "#DCCDB0"
  cover-6-ink: "#3A2E22"
  cover-7-bg: "#B9C3A5"
  cover-7-ink: "#26301F"
  cover-8-bg: "#2E2E30"
  cover-8-ink: "#E8C66C"
typography:
  title:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "34px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  title-phone:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "32px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  wordmark:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  row-title:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
  action-large:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 600
  input-phone:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 400
  body:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  body-phone:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  meta:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.25
  small:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.25
  label:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 600
  tab:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  cover: "3px"
  segment: "6px"
  menu-item: "7px"
  control: "8px"
  field: "10px"
  track: "10px"
  menu: "12px"
  container: "16px"
  sheet: "20px"
  pill: "999px"
spacing:
  gutter-phone: "16px"
  gutter-desktop: "40px"
  page-width: "1180px"
  touch: "44px"
  control-height: "34px"
  control-height-large: "48px"
  segment-height: "32px"
  segment-height-small: "30px"
  topbar-height: "63px"
  tabbar-height: "76px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.meta}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  button-primary-hover:
    backgroundColor: "{colors.accent-press}"
    textColor: "{colors.surface}"
  button-primary-pill:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  button-large:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.action-large}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "{spacing.control-height-large}"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  button-secondary-open:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-press}"
  button-quiet:
    textColor: "{colors.accent}"
    typography: "{typography.body}"
    padding: "0 4px"
  button-quiet-hover:
    textColor: "{colors.accent-press}"
  segmented-track:
    backgroundColor: "{colors.control}"
    rounded: "{rounded.track}"
    padding: "3px"
  segmented-item:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.segment-height}"
  segmented-item-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  segmented-small-track:
    backgroundColor: "{colors.control}"
    rounded: "{rounded.control}"
    padding: "2px"
  segmented-small-item:
    typography: "{typography.small}"
    rounded: "{rounded.segment}"
    padding: "0 12px"
    height: "{spacing.segment-height-small}"
  search-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.field}"
    padding: "0 10px"
    height: "{spacing.control-height}"
  text-input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.input-phone}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "42px"
  menu:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.menu}"
    padding: "6px"
  menu-item:
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.menu-item}"
    padding: "0 10px"
    height: "36px"
  menu-item-hover:
    backgroundColor: "{colors.accent-tint-soft}"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.container}"
    padding: "20px"
  cover:
    rounded: "{rounded.cover}"
  filter-chip:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-press}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    height: "{spacing.segment-height-small}"
  choice-chip:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  choice-chip-selected:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.accent-press}"
  tab-item:
    textColor: "{colors.muted}"
    typography: "{typography.tab}"
  tab-item-current:
    textColor: "{colors.accent}"
---

# Design System: Shelfmark

## Overview

**Creative North Star: "The Lit Shelf"**

Shelfmark is the familiar table app played straight, in its Covers variant: the book's cover leads and everything around it recedes. A quiet off-white ground, flat grey controls, white containers with no shadow, one teal for everything that can be pressed, and the system font. The only object in the app that sits up off the page is a book's cover. Navigation is conventional on purpose (the owner rejected a metaphor-driven UI elsewhere as hard to navigate): exactly two places, Library and Add a book, a top bar on the desktop and a two-tab bar on a phone, account items in a menu rather than a Settings page.

The density is that of a working tool. The desktop Library is a table of 94 px rows inside one white rounded container; the phone defaults to a three-column grid of covers. Because free databases miss most Romanian covers, many books wear the no-cover placeholder, a typographic cover on one of eight tints picked from the title, so a library with few real covers still reads as a shelf rather than a wall of grey boxes.

The theme is light only. No dark theme exists or is planned; `color-scheme: light` is set at the root. The camera view is dark because it is a camera, not because the system has a dark mode.

The app icon carries the same world: books on a shelf in the accent on the ground, spines of different widths and heights, the last one leaning 15° on its neighbour, a ground-coloured label band low on three spines. No text, no gradients, the mark inside the maskable safe zone so one image serves both purposes.

**Key Characteristics:**
- Light only; the ground is a neutral off-white, containers are white.
- One interactive colour, the teal accent; everything else is ink, greys, and white.
- The cover is the only thing with a shadow, besides what floats (menus, sheets, dialogs).
- Flat fills, no borders on controls, hairlines only on the bars and dividers in the table.
- The system font at a small set of sizes; tabular figures for years, counts and ISBNs.
- Two places only; account items live in a menu.

## Colors

A neutral, slightly warm grey ladder on an off-white ground with a single deep teal as the only colour that means "you can press this"; the eight placeholder tints are the one place colour appears for its own sake, and only on a book's face.

### Primary
- **Shelf Teal** (accent): the one interactive colour. Primary buttons and the "Add a book" pill, links, quiet text buttons ("Filter and sort", "Export" on a phone), the current tab, the focus ring, the caret, and the status "Reading" (semibold), which is the one status that is coloured.
- **Pressed Teal** (accent-press): hover and pressed states of the accent; link hover; the text on any tinted selected state.
- **Teal Wash** (accent-tint): a menu button while its menu is open, a selected choice chip, an active filter chip, the open account disc, text selection.
- **Faint Teal Wash** (accent-tint-soft): the hovered or focused row inside a menu; a selected table row.

### Tertiary: the no-cover tints
Eight background/ink pairs used only on the typographic placeholder cover: oxblood (cover-1), ochre (cover-2), forest (cover-3), slate (cover-4), plum (cover-5), sand (cover-6), sage (cover-7), charcoal with gold letters (cover-8). Each ink passes 4.5:1 on its tint (a unit test reads the token lines). The tint is chosen by an FNV-1a hash of the title, normalized (diacritics stripped, lower case, spaces collapsed), so a book keeps its colour on every device and "Inocenţii" and "Inocenții" get the same one. These tints never appear on chrome.

### Neutral
- **Ground** (ground): the page background, the desktop top bar, and the icon's background.
- **Paper White** (surface): the table container, book-page cards, Add a book's result card, menus, sheets, dialogs; also the selected half of a segmented control and the text on the accent.
- **Control Grey** (control): segmented tracks, secondary buttons, unselected choice chips, the account disc; the colour a cover shows while its image loads.
- **Field Grey** (field): the search field, text inputs, the ISBN field, a block error's panel.
- **Hairline** (hairline): the top bar's bottom border, the tab bar's top border, the offline notice's border.
- **Divider** (divider): row dividers in the table and the table head's bottom border; separators in menus.
- **Ink** (ink): primary text, book titles, the shelf column; also the camera's dark ground.
- **Ink Two** (ink-2): secondary text and table cells, unselected segment labels, a subtitle, the outline of an invalid field.
- **Muted** (muted): captions and counts, authors under a title, the Added column, statuses Unread and Abandoned, tab labels at rest, placeholders, hints.

### Derived colours (mixes of named tokens, never a new hue)
Defined in `tokens.css` as aliases or `color-mix` of the table above; they are not separate colours and are not given hex values:
- **on-accent**: `var(--surface)`, text on the accent.
- **bar**: `color-mix(in srgb, var(--surface) 40%, var(--ground))`, the phone tab bar's ground, a shade lighter than the page.
- **control-hover**: `color-mix(in srgb, var(--control) 92%, var(--ink))`.
- **control-press**: `color-mix(in srgb, var(--control) 84%, var(--ink))`.
- **segment-hover**: `color-mix(in srgb, var(--surface) 45%, var(--control))`, the unselected half of a segmented track under the pointer.
- **field-placeholder**: `var(--muted)`.
- **focus-ring**: `var(--accent)`.
- **selection**: `var(--accent-tint)`.
- **scrollbar-thumb**: `color-mix(in srgb, var(--muted) 40%, var(--ground))`.

Feature stylesheets add a few local mixes of the same kind: the table's row hover `color-mix(in srgb, var(--surface) 55%, var(--ground))`, the dialog backdrop `color-mix(in srgb, var(--ink) 32%, transparent)`, the camera vignette's edge `color-mix(in srgb, var(--ink) 50%, transparent)`, and the placeholder's hinge line `color-mix(in srgb, var(--tint-ink) 24%, transparent)`.

### Named Rules
**The Token-Only Rule.** Every colour comes from `tokens.css`. No stylesheet or script outside it writes a colour literal; a new need is met by a mix or alias of existing tokens, never a new hue.

**The One Interactive Colour Rule.** The accent is the only colour that means "press this". Nothing decorative is teal, and nothing pressable is any other hue. The status "Reading" is the single non-control use, and it is semibold so it reads as state, not as a link.

**The No Danger Hue Rule.** There is no red. An error is ink, semibold, with its mark; a block error sits on the field grey; an invalid field gets a 1.5 px ink-2 outline. Destructive actions are separated by placement, not colour.

## Typography

**Display Font:** none distinct; the page title is the system font at 700.
**Body Font:** the system stack (`system-ui, -apple-system, "Segoe UI", sans-serif`)

**Character:** the platform's own voice, used at a handful of sizes so the app feels native on the owner's phone and laptop. Weight, not size or face, does the hierarchy work: 700 for the page title, 600 for book titles, labels and anything selected, 400 for the rest.

### Hierarchy
- **Title** (700, 34 px, -0.02em; 32 px on a phone; line height 1.15 in the page header): the page title ("Library", "Add a book", a book's title on its page) and, at the same size, the wordmark on the login page.
- **Wordmark** (600, 17 px, -0.01em): "Shelfmark" in the desktop top bar.
- **Row title** (600, 16 px, 1.25): a book's title in a table row (two lines at most) and a card's heading on the book page.
- **Action large** (600, 16 px): a sheet's 48 px primary action.
- **Input on a phone** (16 px): every field on a phone, because iOS zooms into anything smaller.
- **Body** (400, 15 px, 1.45 on the desktop, 1.4 on a phone): running text, the caption under a title, quiet text buttons.
- **Meta** (400, 14 px, 1.25): table cells, authors, desktop controls, menu items.
- **Small** (13 px): small segmented controls, filter chips, grid titles on a phone, hints and inline errors.
- **Label** (600, 12 px): column heads and menu section labels. Sentence case, no tracking.
- **Tab** (11 px): tab bar labels, 600 when current.

Add a book keeps three feature-local sizes in `add/add.css`: a result's title 20 px / 700 / line height 1.2, the heading of a result without a book 17 px / 600, and Type ISBN's one large field 22 px / 600 with 0.04em tracking (0.02em at 16 px).

### Named Rules
**The Tabular Figures Rule.** Years, counts, ISBNs, dates and number columns use `font-variant-numeric: tabular-nums` so they line up; number columns are right-aligned.

**The Steady Width Rule.** A label that turns semibold when selected (segments, chips, menu buttons) reserves its semibold width with a hidden copy of itself, so a choice never shifts its neighbours.

## Layout

The shell picks the layout in script: from 768 px it is the desktop (`.shell--desktop`), below it the phone (`.shell--phone`); stylesheets outside the shell use the matching media query at 767.98 px.

**Desktop.** A sticky top bar 63 px tall on the ground with a hairline under it, in three columns: the wordmark left, the two places as a segmented control centred, the search field (up to 240 px) and the account disc right. Under it, one centred column up to 1180 px wide with 40 px gutters, 36 px above and 48 px below, its parts 18 px apart. A page header is the title with its caption on the left and the toolbar on the right, bottom-aligned.

**Phone.** No top bar. A large title with the account disc beside it, then search, then the toolbar, with 16 px gutters; a sticky two-tab bar at the bottom (76 px, its bottom 10 px growing into the home-indicator area) on the lighter `bar` ground with a hairline above. Every target is at least 44 px, often by an invisible extension around a smaller-looking control.

**Library.**
- Desktop toolbar: Table / Covers switch, Views (the saved views' menu, a secondary button that shows the view's name while the page is on one), Filter, Columns (in the table), Export, then the accent "Add a book" pill.
- Phone toolbar: one quiet row. The small segmented Covers / Table switch, then "Filter and sort" and "Export" as accent text. There is no Columns button on a phone: "Columns" is a row inside the "Filter and sort" sheet that steps the sheet to the column picker, with a back step to "Filter and sort". Views has no room in this row: it ends the Owned / Wishlist row as accent text, its menu lined up with the right edge.
- Owned / Wishlist: text tabs under the title on a hairline, each with its count; the open one ink with a 2 px accent underline, the other muted.
- Bulk bar: while books are selected it takes the toolbar's place. Desktop: "3 selected" in ink semibold (", 1 not shown" in muted regular when some are out of sight), then Move to shelf…, Set status (a menu), Add tags…, Remove tags… and Delete… as secondary buttons, and a quiet Clear. Phone: the count, then Actions (a menu) and Clear as accent text; Views stays at the end of the tabs. Clear puts the toolbar back as it was. A line in ink-2 under the tabs says what the last change did. Its dialogs use the Views dialogs' frame; Delete asks first, naming the count, with no danger colour.
- Active filters show as removable chips under the toolbar, with a quiet "clear" at the end.
- Table: default columns Book, Publisher (150 px), Year (80 px, the label and its sort arrow whole), Shelf (150 px), Status (112 px, "Abandoned" whole), Added; columns resize and the choice is remembered. Before Book, a 48 px track of select boxes (44 px on a phone; 16 px boxes, 18 px on a phone, in the accent), the header's box selecting the rows on show. A selected row takes the faint teal wash. Rows are 94 px with the 46 px cover; the head sticks under the top bar on the desktop and to the top on a phone. First and last cells pad 24 px (16 px on a phone).
- Covers: three columns on a phone, more on the desktop, title (two lines) over author. A long press selects a cover; while books are selected, each cover carries a 24 px mark in its top corner, an open ink-2 ring on a near-white disc or the accent disc with a white check, and a ticked cover is ringed in the accent.

**Add a book.** On the desktop the Scan / Type ISBN / By hand switch heads the content column directly under the title; under it, Scan is a rounded camera stage (420 to 660 px tall) and Type ISBN and By hand are one column up to 600 px. On a phone the camera fills the screen down to the tab bar and the switch and session counter float over it.

**Book page.** On the desktop a 260 px sticky cover column and a main column up to 720 px, 40 px apart. The header's actions (Edit, Re-run lookup) end at the cards' edge, not the page's: the header row is capped at the two columns' combined width. On a phone the cover is centred (up to 168 px) above the cards.

**Offline notice.** A small pill fixed at the top: 8 px under the top bar where there is one, 8 px under the top of the window where there is none (the login page, the phone).

## Elevation & Depth

A hybrid, deliberately lopsided: surfaces are separated by tone (white containers on the off-white ground, grey controls inside them), and only two shadows exist. The cover casts one, because it is the object; things that float over the page cast the other, because they are above it. Cards, the table, Add a book's in-page result, chips and buttons are flat.

### Shadow Vocabulary
- **Cover** (`box-shadow: 0 6px 14px rgba(27, 27, 29, 0.22), 0 1px 2px rgba(27, 27, 29, 0.2)`): every book cover, real or placeholder, at every size.
- **Float** (`box-shadow: 0 16px 40px rgba(27, 27, 29, 0.18)`): menus, the scan sheet and the phone's panel sheets, the desktop Filter/Columns panels, the password dialog, the update prompt, the account notice, and the skip link while focused.

### Named Rules
**The Lit Object Rule.** The cover is the only thing with a shadow besides floating menus and sheets. A card, a button, a chip or a container never gets one; if something needs to separate from the ground, make it white.

## Shapes

Gently rounded throughout, with the radius growing with the size of the thing: a cover's corners are barely softened (3 px) so it still reads as a printed object; segments 6 px; menu rows 7 px; buttons and small tracks 8 px; fields and segmented tracks 10 px; menus 12 px; the table container, book-page cards and the desktop camera stage 16 px; the floating sheet and the desktop dialog 20 px. Chips, the "Add a book" pill, a sheet's large action, the account disc and the offline notice are full pills. Controls have no borders; edges come from fill against ground. Covers are always 2:3.

## Components

### Buttons
Flat fills, no borders, no shadow.
- **Shape:** 8 px corners, 34 px tall on the desktop (44 px on a phone); the "Add a book" pill and a sheet's large action are full pills.
- **Primary:** accent fill, white semibold text, 16 px side padding; hover and press go to accent-press.
- **Secondary:** control fill, ink text; hover and press darken by a mix toward ink. While its menu is open (Export, the account disc) it turns teal wash with accent-press semibold text.
- **Quiet:** accent text on nothing, 15 px, 4 px side padding; hover accent-press. A leaving action ("Not this book", "Discard this scan") is a quiet button in plain ink, apart from the primary.
- **Large:** 48 px, 24 px side padding, 16 px semibold: a sheet's primary action ("Save and scan the next one") and the camera's *Scan the barcode*.
- **Disabled:** 45% opacity, no pointer.
- **Focus:** the one ring, 2 px accent, 2 px offset, keyboard only.

### Segmented control
The workhorse switch: the two places in the top bar, Table / Covers, Add a book's three modes, sort direction. A control-grey track (10 px corners, 3 px inset) holding 32 px segments; the selected segment is a white 8 px tile with ink semibold text, the rest ink-2 at 14 px, hovering to the segment-hover mix. The small variant (8 px track, 2 px inset, 30 px segments with 6 px corners, 13 px) sits in toolbars. Over the camera the track sits on the ground, nearly opaque.

### Chips
- **Filter chip:** teal wash, accent-press text, 30 px pill, 13 px semibold label with a separate remove "x"; tapping the label reopens that filter.
- **Choice chip** (shelf and status in Add a book): control-grey 36 px pill, 14 px; hover control-hover; selected turns teal wash with accent-press semibold text. Each is a real radio under the chip. "New shelf" is the same chip drawn with a 1 px dashed muted outline on no fill.

### Cards / Containers
- **Corner Style:** 16 px.
- **Background:** white on the ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; inside, rows are separated by 1 px divider lines.
- **Internal Padding:** 20 px on the desktop, 16 px on a phone.

### Inputs / Fields
- **Style:** field-grey fill, no border, 10 px corners; search 34 px on the desktop (40 px in the phone header) with a muted icon and a muted round clear button; form inputs 42 px; the ISBN field 48 px.
- **Focus:** a 2 px accent outline on the field's edge (offset 0); the search box carries the ring for its input.
- **Error:** a 1.5 px ink-2 outline on the field and an ink semibold message with its mark under it. No red.
- **On a phone:** 16 px text so iOS does not zoom.

### Navigation
- **Desktop:** the top bar; the two places as a centred segmented control with 18 px segment padding, the current place a white tile.
- **Phone:** the tab bar, two items (Library, Add a book), each an icon over an 11 px label; muted at rest, ink-2 on hover, accent and semibold when current; the icon scales to 0.92 while pressed.
- **Account:** a round control-grey disc (34 px on the desktop, 32 px in a 44 px target on a phone) that opens a menu: change password, Sign in with Ward (linked or not), download a backup, sign out.
- **Icons:** one hand-drawn line set on a 24-unit grid, 1.9 stroke, round caps and joins, `currentColor`, decorative (the control names itself).

### Menus and sheets
- **Menu:** white, 12 px corners, 6 px padding, float shadow, at least 224 px wide; 12 px semibold muted section labels, 36 px rows (44 px on a phone) with 7 px corners that wash faint teal on hover; secondary detail in muted 13 px on the right. It enters with a 4 px drop over 180 ms.
- **Sheet:** white, 20 px corners, 16 px padding, 12 px from the edges, at most 440 px wide, float shadow. It rises from below its edge over 240 ms; it never fades in from nothing. Used for the scan result over the camera, the phone's Filter and sort / Columns panels, and the phone's password dialog.

### The cover (signature)
Every book is shown by its cover at 2:3 with 3 px corners and the cover shadow, at 46 px in a table row, in the grid, 168 to 260 px on the book page. Without an image (or when it fails to load) it becomes the **typographic placeholder**: the title in 700 over a short rule and the author in uppercase 600 with 0.06em tracking, on the book's tint, sized off the cover's own width (container query units) so it reads the same at every size; a hairline 7% in from the left edge suggests a hardback's hinge. The title shrinks only as far as needed to keep its longest word whole. At 72 px wide or less (a table row) the author is dropped and the title takes up to four lines. In the grid, a cover lifts 3 px on hover.

### The camera stage
The camera fills its stage on an ink ground with a soft radial vignette so the white sheet and controls hold their edge over a bright picture. A 240 x 132 viewfinder with a 3 px white rim; a read flashes the frame teal wash, the cue that works with the sound off. The camera's own controls sit top right in a column, each a 44 px disc on the ground and each only when the camera has it: the torch toggle, then the zoom chip, which shows the zoom in use ("2×", the start, or "1×") and switches on a tap, as a phone's camera app does. The camera reads only on a press: while no result is open, a large accent pill, *Scan the barcode*, sits where the sheet will (12 px from the edges, at most 440 px wide). While it reads, which lasts until a code is read, it says *Stop reading* and a tap stops it. After a minute with nothing read, "Nothing read for a minute" shows above it as a pill on the ground. `?camera` at the end of the address adds the camera readout, the owner's diagnostic: four lines of 11 px ink-2 type on a ground pill, top left under the mode switch, taking no touches and sitting under the sheet. The result floats over the camera in the sheet: the cover, the draft's details, then the action. The scanner never navigates while the camera runs: the three outcomes (found, not found, already owned) are states of one screen.

### Motion
State changes only, short, one curve: `cubic-bezier(0.22, 1, 0.36, 1)` at 120 ms for colour changes, 180 ms for menus and the in-page result's 8 px rise, 240 ms for sheets. Under `prefers-reduced-motion: reduce` every animation and transition collapses to 1 ms.

## Do's and Don'ts

### Do:
- **Do** take every colour from `tokens.css`; meet a new need with a `color-mix` of existing tokens, never a new hue.
- **Do** keep the accent as the only interactive colour: primary actions, links, quiet text buttons, the current tab, the focus ring.
- **Do** give every book a cover: the stored image, or the typographic placeholder on its title's tint.
- **Do** keep the cover's shadow (`0 6px 14px rgba(27, 27, 29, 0.22), 0 1px 2px rgba(27, 27, 29, 0.2)`) on the cover and the float shadow (`0 16px 40px rgba(27, 27, 29, 0.18)`) on menus, sheets and dialogs, and nothing else.
- **Do** separate surfaces by tone: white containers (16 px corners) on the ground, grey controls inside them.
- **Do** keep exactly two places, Library and Add a book; the book page and login are routes inside them, and account items live in the account menu.
- **Do** write English copy in the glossary's words: book, collection, shelf (written "Room · shelf"), status, lookup, draft.
- **Do** keep the scanner one screen with internal states; nothing navigates while the camera runs.
- **Do** give every phone target 44 px and every phone field 16 px text.
- **Do** use tabular figures for years, counts, ISBNs and dates.

### Don't:
- **Don't** add a dark theme. The app is light only; the camera is dark because it is a camera.
- **Don't** put a shadow on a card, the table, a button, a chip or the in-page result.
- **Don't** introduce a second interactive hue, or a red for errors or deletion.
- **Don't** use the eight cover tints anywhere but the placeholder cover.
- **Don't** add a third place or a Settings page.
- **Don't** use decorative gradients; the camera's vignette is the one gradient, and it is functional.
- **Don't** write "item", "record", "entry", "location", "result" or "match" for what the glossary calls a book, shelf or draft, or "search" for a lookup.
- **Don't** fade a sheet in from nothing; it rises from its edge.
