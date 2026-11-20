fix

# Shelfmark: design critique of the "Covers, typeset" proposal

The type, the cover tints, the phone rows and the dark palette are worth keeping. The "one sheet of paper ruled with hairlines" half of the direction line has to go. It removes every surface the app had, and the owner already turned that down (`corpus/wiki/design.md`, 2026-11-04). Keep "the cover is the only object with depth", because the cards come back flat.

## Regressions against today

1. **Library, 1280, 1024 and 768, light and dark: header and table share one flat ground.** I confirm the owner's note. Sampled pixels show the title zone, the column-head row and the rows all at `#f9f7f3` (dark: all `#141310`). Today the header sits on a white card (`#ffffff` on `#f5f5f3`) with the table on its own white box 18 px below, and in dark the card is `#1c1c1f` on `#121214`. Now the column heads (12 px muted) float with nothing to sit on, and the Table/Covers track (`#e8e6e1`) almost vanishes against the ground.
   Fix: use the recorded spec (DESIGN.md, Header card). Title, caption and toolbar go on a `surface` card, 16 px radius, no shadow, 22 px top and bottom, 24 px at the sides, so the title lines up with the table's first cell. The table goes in its own `surface` container with the same radius, 16 px below the header card, and the column-head row is the container's first row, divided from the body by `rule`. The pager sits on the ground under the container. Keep the full window width minus the 40 px gutters.
2. **Library, 390 and 360: the header card is gone.** Today the title, search and toolbar sit on an edge-to-edge white card with rounded lower corners, Views sits on the ground under it, and the list is its own white box. Fix: restore exactly that. The card runs full bleed, 16 px radius on the lower corners only, 16 px padding. The Views row stays on the ground. The list goes in a `surface` box (16 px radius, 16 px side margins), and the phone row content stays as proposed.
3. **Book, 1280 / 1024 / 768 and 390, light and dark: the two fact cards became one ruled list.** Today "About the book" and "About this copy" are separate white (dark: lighter grey) cards, so the two kinds of fact read as two groups at a glance. Now the only grouping is a 20 px serif head on hairlines. Fix: put each section in a `surface` card (16 px radius, 20 px padding, flat), with 16 px between cards. Keep the proposed order (copy first) and the large Shelf/Status strip. The strip can stay on the ground above the cards as the page's lead.
4. **The system is now inconsistent.** The Add draft is the only card in the proposal. Once 1-3 land, that inconsistency goes away. Without them, "card = not saved yet" is the only surface rule, and the app reads as two products.

Nothing a person could *do* got harder. Every action, column, tool and fact from today is present. The losses are grouping and depth, not features.

## Priority issues (ranked by cost to the user)

1. **The surface token can't carry a card even once cards return.** Light `surface #fefdfb` on `ground #f9f7f3` is 1.05:1, against today's 1.09:1 (`#ffffff` on `#f5f5f3`). The Add draft card already reads only through its hairline. Fix: aim for at least today's 1.09:1, for example `surface #ffffff` on `ground #f6f4f0` (1.10:1). Shift the neutral ladder with it so fields on the ground keep their fill: `field #ebe9e4` (1.10 on the new ground), `control #e8e6e1` unchanged (1.14). `row-hover #f1efeb` now sits on the white table container (1.15), which is fine. Don't go darker than `#f3f1ec`, or the ground collides with today's field and row-hover values. Dark `#201e1a` on `#141310` (1.12:1) is fine. Add a "surface on ground" pair to the contrast table as a floor at today's 1.09:1, in both themes. The 49 scripted pairs have none, which is why the gates passed a flat page. Re-run the table afterwards.
2. **Phone Add after Look up: the primary falls under the tab bar.** At 360 × 800 (the Android case) "Save and type the next one" is entirely behind the bar, and only "Add to wishlist" shows below it. At 390 × 844 the bar clips Save's bottom 6 px (Save y 729-777, bar from 771). The draft card is also 4 px wider than the field column on each side (`.draft { margin: 0 -4px }` under 768: x 12 vs 16). Fix: remove the negative margin. While a draft is open, put the field and Look up in one row (field plus a 48 px "Look up" button) and drop the hint once the ISBN is valid, so Save sits about 100 px higher and above the bar. Or pin Save in a bar directly above the tab bar.
3. **Book at 768: the cover stands alone top-left with a ~450 px void beside it,** and the title follows below. It reads as a broken layout, not a tablet one. Fix: keep the two-column layout down to 768 (cover 200 px wide, 24 px gap, title and facts beside it), or centre the cover as on the phone. Don't use the left-aligned stack.
4. **Tabular figures in Public Sans look letter-spaced and change face outside a column.** On the Book page, "2016" and "512" (`.num` on the values) read as a monospace among proportional values like "Litera" and "Romanian". "2003" in the draft meta does the same. Fix: drop `.num` from the Book fact values and the draft meta and use proportional lining figures there. Keep `tabular-nums` only where digits stack in a column (the Year column, the pager, the ISBN field), where the wide figures are justified. In the draft, set the year in `muted` so "Penguin Classics  2003" reads as two facts.
5. **The Library header is weak typographically.** The caption is 14 px (`.t-meta`) and sits almost on the 32 px title, and the toolbar is centred on the title block. DESIGN.md asks for a 15 px Body caption and a toolbar that is bottom-aligned. Fix: set the caption in Body 15 px with about 4 px under the title, and align the toolbar to the bottom of the title block, inside the card.
6. **The phone pager's "10 per page" is a lone centred accent link** under the Previous / Page 1 of 3 / Next row. It reads as a link to somewhere, not as a setting, and the disabled "Previous" still looks like a button. Fix: use the desktop's "10 per page ▾" control, left-aligned on the pager row's grid line or below it, and render disabled Previous as text at `muted` with no fill.
7. **Card radius has two values.** The recorded header and table cards use 16 px, while the proposal's `--radius-panel` (the draft card) is 14 px. Fix: use one panel radius for all cards. Take 16 px from the record and set `--radius-panel` to it, so the restored cards and the draft match.

Minor: the draft's two text buttons, "Not this book" and "Edit details", are inset 8 px from the card edge. That's symmetric and fine, so leave it. The phone captures (library, book, add) show the sticky tab bar halfway down a full-page image. That's a capture artefact. Re-capture at viewport height, or with the bar rendered at the end, so the owner isn't misled. The red numbered callouts sit on content (callout 1 covers the "L" of Library at 390, callout 4 covers a checkbox). Move them into the margin.

## Strengths to keep

- **Literata for what a book says, Public Sans for controls.** This is what makes the proposal belong to Shelfmark and not to any table app. The serif row titles finally make the list read as books. It renders ș ț ă î.
- **The Book page's lead strip:** Shelf and Status set large, with Edit beside them, so the page answers "where is it?" first. Keep it above the cards.
- **Phone Library rows carry shelf and status under the author.** Today's phone row hides them. This one addition answers the question the app exists for.
- **Dark is a designed theme.** Warm grey ground, calmer tints with a cover edge in place of a shadow, light teal with dark text on the primary. Once the cards exist, the 1.12:1 surface step will separate them, and `#201e1a` is already the right card colour.

## Heuristic scores (0-4, on the comps)

1. Visibility of system status: 3. The selected segment, the sort arrow, the current page and the Reading accent are all visible. A draft is clearly "not saved" only through its card.
2. Match with the real world: 4. Typeset covers, room · shelf, "Found in Open Library".
3. User control and freedom: 3. "Not this book", Previous, and a breadcrumb back to Library.
4. Consistency and standards: 2. One card on Add and none on Library or Book. Tabular and proportional figures mixed in one list. Two pager styles (desktop select vs a phone link).
5. Error prevention: 3. A 3:1 field edge, the ISBN hint, and the draft before saving.
6. Recognition rather than recall: 3. Shelf and status are visible in the phone rows. The column heads are faint at 12 px muted.
7. Flexibility and efficiency: 3. "Save and type the next one", Views, Columns.
8. Aesthetic and minimalist design: 2. Minimal turned into flat. Grouping comes from hairlines alone (the cognitive-load checklist fails on "grouping" and "visual hierarchy" for Library and Book).
9. Help users recognise and recover from errors: n/a on these comps. The Direction sheet's error field keeps the no-danger-hue rule.
10. Help and documentation: 3. Inline hints ("10 or 13 digits...") where they are needed.

**Detector:** the first run was DEGRADED (ESM ignores NODE_PATH). It was re-run in full mode from a scratch copy with the parser modules linked.
- library-light / library-dark: 1 × `cramped-padding` on the phone Views row (`div.phone-only` with border-bottom). False positive: the 48 px tool button carries its own inset, and the render shows about 12 px of air above the rule.
- book-light / book-dark / add-light / add-dark: 0 findings.
- direction-light: 6 × `nested-cards`. False positive: these are specimen panels on the Direction sheet, not app UI.

**Don't dilute:** the Literata/Public Sans split and the large Shelf/Status lead. Put the cards back flat, white and 16 px round, so the typeset covers stay the only things with a shadow.
