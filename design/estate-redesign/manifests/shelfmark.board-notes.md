# The board's notes: Shelfmark

The estate redesign board is a private canvas. This file copies what its page for this app said beside the screens: the owner's asks, the decisions, the rules the design reopened, the open questions and the Floor. The owner's answers are in [README.md](../README.md#the-owners-decisions).

## Asks to the owner

- 1. Book titles in Literata and the controls in Public Sans, replacing the system font: yes, or keep the system font? 2. At 72 px and under, a no-cover placeholder shows the title's first letter: keep the initial, or today's miniature title? 3. Approve round 2, Covers, typeset: today's islands with the type, the phone rows and the dark set from round 1? (beside `shelfmark-direction`)

## Decisions

- The header card and the table box are flat cards: surface, 16 px radius, 16 px apart, full width less the gutters (DESIGN.md, Header card). On a phone the header card runs full bleed with rounded lower corners, and Views stays on the ground. (beside `shelfmark-proposed-library-1280`)
- Book titles are set in Literata, a reading face, so what a book says reads as a book, while the controls recede in Public Sans [conv, research 2.1]. Both faces render ș, ț, ă and î. (beside `shelfmark-proposed-library-1280`)
- Fields and checkboxes get a 3:1 edge, which today's borderless grey field on a grey ground lacks (WCAG 1.4.11, research 2.3). Errors keep DESIGN.md's No Danger Hue rule: ink, semibold, a mark, and a heavier edge of the same width. (beside `shelfmark-proposed-library-1280`)
- On a phone each row also shows the shelf and the status, so "do I own it, and where?" is answered without opening the book [conv, research 2.11]. (beside `shelfmark-proposed-library-390`)
- Dark is its own palette: a warm grey ground, surfaces lighter as they rise, and hairlines where the shadows were [S14, S7]. The teal is lighter and calmer with dark text on it, and the cover tints are calmed a step and edged [S7, S14]. (beside `shelfmark-direction`)
- Title and author stand beside the cover, which stays put while the facts scroll; the two columns hold down to 768, and on a phone the cover leads, centred [conv]. (beside `shelfmark-proposed-book-1280`)
- Shelf and status lead on the page, set large above the cards, so the page answers "where is it?" first (PRODUCT.md's purpose). They are not repeated in the cards. (beside `shelfmark-proposed-book-1280`)
- The placeholder's author is in sentence case under a short rule, not tracked capitals (Hallmark Floor 9, gate 67). (beside `shelfmark-proposed-book-1280`)
- About this copy and About the book are two flat cards again, copy first. The facts and their wording are today's. (beside `shelfmark-proposed-book-1280`)
- The label sits above a field with a 3:1 edge [S40]. With a draft open, the field and Look up share one row and the hint goes, so Save stays above the tab bar on a 360 by 800 phone. (beside `shelfmark-proposed-add-1280`)
- The draft is a flat card like every other island, so the screen follows the same surface rule as the Library and the book page. (beside `shelfmark-proposed-add-1280`)
- Publisher and year are separate facts in proportional figures, the year muted, not a dot-joined line (Hallmark gate 63). Tabular figures stay where digits stack: the Year column, the pager and the ISBN field. (beside `shelfmark-proposed-add-1280`)
- Shelf and status stay radio chips, the current one in the teal wash, with 48 px phone targets. New shelf keeps its dashed outline (DESIGN.md). (beside `shelfmark-proposed-add-1280`)
- One filled primary per screen: with a draft open, Look up drops to the grey secondary and the accent goes to "Save and type the next one" (Hallmark F4). (beside `shelfmark-proposed-add-1280`)

## Open questions

- At 72 px and under (table rows, the draft) a no-cover placeholder shows the title's first letter, not an unreadable miniature title. This answers the 2026-10-15 finish review's open question (wiki/design.md), and it is ask question 2. (beside `shelfmark-proposed-library-1280`)
- The app pulses its loading skeleton today; the direction sheet draws it still, as research 2.6 prefers [S30]. Keep it still? (beside `shelfmark-direction`)

## The Floor

- Contrast is scripted over 53 pairs, AA in both themes: text min 5.07 light and 4.83 dark, edges 3.48 and 3.70, focus 4.88 and 6.16. Islands on the page: 1.10 light and 1.16 dark (floor 1.09 / 1.15). Nothing overflows at 1280, 1024, 768, 390 or 360; at 360 and 390, scrolled to the end, no button sits under the tab bar, and no callout covers content. Sloplint --scope app on the six comps: 0 FAIL, 0 REFLEX. Each screen's empty, loading and error states are on the direction sheet. (beside `shelfmark-direction`)

## Other notes

- Round 2: what changed. 1. The islands are back to the recorded spec: the Library's header card and table box, the phone's full-bleed header card, and the book page's two fact cards, because the owner found the one-sheet page flat (wiki/design.md, 2026-11-04). 2. Ground and surface are retuned so a card reads at 1.10:1 light and 1.16:1 dark (it was 1.05:1), and surface-on-ground is now in the contrast table. 3. One card radius, 16 px, as recorded. 4. On a phone, Add puts the field and Look up in one row and drops the hint once a draft is open, so Save sits above the tab bar at 360 by 800; the draft lost its negative margin. 5. The book page keeps two columns down to 768. 6. Tabular figures only where digits stack; the book facts and the draft's year are proportional, the year muted. 7. The Library caption is body size, 4 px under the title, and the toolbar is bottom-aligned in the card. 8. The phone pager uses the 10 per page control, and a disabled Previous is muted text. 9. Every callout sits in the margin. 10. Phone shots are taken at full height, so the tab bar shows at the end.
- Proposed shows Type ISBN after Look up, with the draft open; today's shot is from before Look up. Emma, 9780141439587, is the Penguin Classics edition of 2003 in Open Library (checked 2026-11-12) and is not in the demo library.
- Two copy changes: the pager's range reads "1 to 10 of 27" (Hallmark gate 19 bans the en dash), and the phone switch keeps today's order, Covers then Table.

## Contrast, as measured

| Pair | Light | Dark | Needs |
|---|---|---|---|
| surface on ground (an island against the page) | 1.1 | 1.16 | 1.09 / 1.15 |
| control on surface (a track or chip inside a card) | 1.24 | 1.18 | 1.09 |
| rule on surface (dividers inside a card) | 1.33 | 1.31 | 1.2 |
| field on surface (the search field in the header card) | 1.2 | 1.11 | 1.09 |
| ink on ground | 15.42 | 15.32 | 4.5 |
| ink on surface | 16.93 | 13.24 | 4.5 |
| ink on field | 14.08 | 14.75 | 4.5 |
| ink on control | 13.67 | 11.18 | 4.5 |
| ink on control-raised (current segment) | 16.93 | 7.62 | 4.5 |
| ink on control-hover | 12.46 | 9.66 | 4.5 |
| ink on row-hover | 15.25 | 12.01 | 4.5 |
| ink on accent-wash (selected row) | 14.19 | 9.89 | 4.5 |
| ink-2 on ground | 9.06 | 11 | 4.5 |
| ink-2 on surface | 9.95 | 9.51 | 4.5 |
| ink-2 on control | 8.04 | 8.03 | 4.5 |
| ink-2 on row-hover | 8.97 | 8.62 | 4.5 |
| ink-2 on accent-wash (selected row) | 8.35 | 7.1 | 4.5 |
| muted on ground | 5.66 | 7.48 | 4.5 |
| muted on surface | 6.21 | 6.46 | 4.5 |
| muted on field (placeholder, icon) | 5.17 | 7.2 | 4.5 |
| muted on row-hover | 5.6 | 5.86 | 4.5 |
| muted on accent-wash (selected row) | 5.21 | 4.83 | 4.5 |
| accent text on ground | 5.5 | 9.55 | 4.5 |
| accent text on surface | 6.04 | 8.25 | 4.5 |
| accent text on row-hover | 5.45 | 7.48 | 4.5 |
| accent text on accent-wash | 5.07 | 6.16 | 4.5 |
| accent-hover text on ground | 7.79 | 12.34 | 4.5 |
| on-accent on accent | 5.99 | 9.28 | 4.5 |
| on-accent on accent-hover | 8.48 | 11.99 | 4.5 |
| on-accent-wash on accent-wash | 8.05 | 8.79 | 4.5 |
| outline (field edge) on field | 3.48 | 4.54 | 3 |
| outline (field edge) on ground | 3.81 | 4.72 | 3 |
| outline (checkbox edge) on surface | 4.19 | 4.08 | 3 |
| outline (checkbox edge) on row-hover | 3.77 | 3.7 | 3 |
| ink-2 (error edge) on field | 8.28 | 10.59 | 3 |
| focus ring on ground | 5.5 | 9.55 | 3 |
| focus ring on surface | 6.04 | 8.25 | 3 |
| focus ring on field | 5.03 | 9.19 | 3 |
| focus ring on control | 4.88 | 6.97 | 3 |
| focus ring on accent-wash | 5.07 | 6.16 | 3 |
| accent (checked box, current tab icon) on ground | 5.5 | 9.55 | 3 |
| accent (checked box) on surface | 6.04 | 8.25 | 3 |
| cover-edge on ground (dark: the cover’s 1px edge) | 15.42 | 2.2 | 1.4 |
| rule on ground (hairline, Lc 15 target) | 1.21 | 1.52 | 1.2 |
| on-callout on callout (board marker) | 5.27 | 6.93 | 4.5 |
| cover-1 ink on its tint (oxblood) | 8.08 | 7.69 | 4.5 |
| cover-2 ink on its tint (ochre) | 6.93 | 5.08 | 4.5 |
| cover-3 ink on its tint (forest) | 7.72 | 7.09 | 4.5 |
| cover-4 ink on its tint (slate) | 9.39 | 7.62 | 4.5 |
| cover-5 ink on its tint (plum) | 7.43 | 7.19 | 4.5 |
| cover-6 ink on its tint (sand) | 8.41 | 6.8 | 4.5 |
| cover-7 ink on its tint (sage) | 7.48 | 6.78 | 4.5 |
| cover-8 ink on its tint (charcoal, gold letters) | 8.21 | 8.53 | 4.5 |

## The artboards on the board

- Direction · Covers, typeset
- Library · 1280 · light · today
- Library · 390 · light · today
- A book · 1280 · light · today
- A book · 390 · light · today
- Add a book, Type ISBN · 1280 · light · today
- Add a book, Type ISBN · 390 · light · today
- Library · 1280 · light · proposed
- Library · 390 · dark · proposed
- A book · 1280 · light · proposed
- A book · 390 · dark · proposed
- Add a book, Type ISBN · 1280 · light · proposed
- Add a book, Type ISBN · 390 · dark · proposed
- Library · 1280 · light · proposed · round 1
- Library · 390 · dark · proposed · round 1
- A book · 1280 · light · proposed · round 1
- A book · 390 · dark · proposed · round 1
- Add a book, Type ISBN · 1280 · light · proposed · round 1
- Add a book, Type ISBN · 390 · dark · proposed · round 1
