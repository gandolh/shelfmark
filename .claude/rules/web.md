---
paths:
  - "web/src/**"
---

# The web app (`web/src`)

- Read [DESIGN.md](../../DESIGN.md) and
  [corpus/wiki/overlays.md](../../corpus/wiki/overlays.md) before you add or
  change a component.
- Base UI sits under the menus, panels, dialog and switches
  ([corpus/wiki/decisions.md](../../corpus/wiki/decisions.md)). Native
  checkboxes, radios and selects stay native.
- Light only until the app gains a Light / Dark / System switch.
- Every call to the server goes through `web/src/api.ts`, with the shared
  schemas from `@shelfmark/shared`.
- UI copy uses the words of [corpus/wiki/glossary.md](../../corpus/wiki/glossary.md).
  English only.
- A `!` is an error in source: narrow with a guard or `??`. Tests may keep one
  (a warning).
- A default export only where a framework reads it (`ScannerDemo`, loaded with
  `lazy(import())`, and the tool configs).
- `web/vendor/ward/` is generated. Never edit it.
- `npm run check:conventions` runs `check-base-ui` over this folder,
  `--warn-only` until the Base UI and Tailwind work lands.
