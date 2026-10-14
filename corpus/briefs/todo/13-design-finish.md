# Task 13: Design finish review and DESIGN.md

## Context

The UI briefs (04, 06, 08, 09, 10, 11, 12) each built inside the world in
[design.md](../../wiki/design.md). Impeccable's rule for a new world is that
the run ends with a finish review against its direction contract and a
`DESIGN.md` written from the **built** UI, not from intentions. This brief does
both, once, for the whole app. Load the `impeccable` skill and follow its
"Inspect and finish" section (reference/new-work.md §7); `PRODUCT.md` at the
repo root is its product record.

Depends on briefs 04 and 06 to 12 being done.

## Files you OWN

```
DESIGN.md  (and the sidecar the documenter writes)
.impeccable/review/*         (screenshots and the reviewer's packet; gitignore the PNGs)
web/src/**                   (fixes the reviewer lists, nothing else)
corpus/wiki/design.md        (point at DESIGN.md; keep the history and the decisions)
```

## Files you must NOT touch

Server code, tests' intent, anything not named by a finding.

## What to do

1. Run impeccable's detector over `web/src` once and fix what is mechanical.
2. With seed data (about 40 books: the sample books in design.md's mock-ups
   plus synthetic ones, half without covers), capture at desktop (1440) and
   phone (390) widths: Library as table and as covers, a filter open, Add a
   book in each outcome (found, not found, already owned), the book page,
   the login page. Validate every capture before sending it.
3. Spawn `impeccable-finish-reviewer` fresh with: the original request (the
   owner's: a light, familiar table app; two places; Covers variant), the
   direction contract (design.md), the screenshot paths, the detector
   findings, the craft-floor reference, and the mock-ups on the design canvas
   as the critique reference (code-led build, no approved comp).
4. Act on its disposition. At most two fix rounds; then the owner decides.
5. Spawn `impeccable-documenter` to write `DESIGN.md` and its sidecar from the
   built UI. Link `DESIGN.md` from design.md and from `corpus/index.md`'s
   intro; design.md keeps the choice history and the decisions.

## Acceptance

- The reviewer's last verdict is `ship`, or every material finding is
  resolved and scored so, or the owner chose to stop (said in the outcome
  note).
- `DESIGN.md` exists, describes what shipped, and its tokens equal
  `web/src/styles/tokens.css`.
- `npm run typecheck && npm run lint && npm test` pass; `bash corpus/lint.sh`
  is clean.
