# Shelfmark tokens: board role to app token

Mechanism: the app's own, kept. `@theme static` holds each colour as `light-dark(light, dark)`, picked by `color-scheme` on `:root`; the shadows use `light-dark()` too (the dark edge is a ring that is transparent in light), so there is no `[data-theme="dark"]` block. `shelfmark.tokens.css` replaces the colour, type, radius and shadow groups of `web/src/styles/index.css`; the reset block, sizes, motion, z-index, animations and `@layer base` stay. Islands stay: the board keeps flat cards on the page.

## Renamed or remapped (board role to app token)
- ground, surface, control, field, ink, ink-2, muted, accent: same names, new values (page #f5f5f3 to #f6f3ef, warmer; accent #0e6e8c to #0a6b84, dark #5bb8d4 to #79c5d8)
- rule -> `hairline`, and `divider` takes the same value
- accent-hover -> `accent-press`; accent-wash -> `accent-tint`; on-accent -> `on-accent` (an alias of surface today, a real pair now)
- control-hover: a `color-mix` today, now a pair; `segment-hover` re-based on `control-raised`
- focus -> `focus-ring` (still derived: the board's focus equals the accent in both themes)
- cover-1 to cover-8: same names, same roles (oxblood, ochre, forest, slate, plum, sand, sage, charcoal), light values unchanged, dark values moved
- fonts: Public Sans -> `font-sans` (system-ui today); Literata -> new `font-book`. Both need self-hosting (400, 600, 700; Literata 600)
- sizes: `text-title` 34 to 32 (phone 32 to 28), `text-wordmark` 17 to 20, `text-body` 15 to 16, `text-meta` 14, `text-label` 12, `text-tab` 11 to 12, `text-small` 13 to 14. Line heights are `--leading-*` as before: `leading-body` 1.45 to 1.5, `leading-phone` to 1.5, plus the new ones below. `tracking-title` and `tracking-wordmark` go to 0
- radii: panel 16 -> `radius-container`, full -> `radius-pill`, control 8 and cover 3 unchanged
- shadows: cover -> `shadow-cover` (new values, dark is a 1px edge in `cover-edge`); float -> `shadow-float` (dark is a hairline)
- spacing: the board's 4 8 12 16 20 24 32 40 48 64 are the app's `--spacing: 4px` multiples; no tokens

## New tokens (component that needs them)
- `control-raised`: the current segment of a segmented track
- `row-hover`: a table row under the pointer
- `outline`: field, checkbox and the new-shelf chip edges
- `on-accent-tint`: text on a selected segment, chip and row
- `cover-edge`: a cover's 1px edge in dark
- `font-book`: page titles, section heads, a book's title in a row, the wordmark
- `text-heading` (20, Literata 600): section heads, a draft's title
- `leading-title` 1.25, `leading-heading` 1.4, `leading-row-title` 1.375, `leading-meta` 1.43, `leading-label` 1.33: the board's line heights (40, 28, 22, 20, 16 px) as ratios

## App tokens the design no longer uses (keep or drop is the code brief's call)
- `accent-tint-soft` (the selected menu row): the board draws a menu's chosen row on `accent-tint`
- `text-small` and `text-tab` now duplicate `text-meta` and `text-label`; `text-input-phone` and `text-action-large` equal `text-body`
- `radius-segment` (6), `radius-menu-item` (7), `radius-field` (10), `radius-track` (10), `radius-menu` (12), `radius-sheet` (20): the board draws four radii (3, 8, 16, 999); kept in the file so the existing components keep working until the code brief collapses them
- `leading-tight`, `font-weight-*`, `camera`, `camera-ink`, `scrim`: unchanged

## Not mapped
- board-only `callout` (#c83122 / #f28058): a specimen annotation colour on the direction sheet
