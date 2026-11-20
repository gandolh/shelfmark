# The redesign: "Covers, typeset"

This folder is the design record of Shelfmark's redesign. The estate redesign board, where it was drawn and approved, is a private canvas; this is a copy of the app's page on it plus the build behind that page. The owner approved it on 2026-11-13, and [brief 09](../../corpus/briefs/done/09-a-redesign-with-hallmark-on-the-estate-board.md) built it. The code is now the source of truth: where the app and these files differ, the app wins, and later work may have moved a screen on. Read this folder to see what was decided and why before reshaping a screen.

## The owner's decisions

The owner approved the whole board on 2026-11-13, with every question standing at what the board proposed unless they reopened it. The questions this app's page asked:

- **Ask:** 1. Book titles in Literata and the controls in Public Sans, replacing the system font: yes, or keep the system font? 2. At 72 px and under, a no-cover placeholder shows the title's first letter: keep the initial, or today's miniature title? 3. Approve round 2, Covers, typeset: today's islands with the type, the phone rows and the dark set from round 1?
- **Open question:** At 72 px and under (table rows, the draft) a no-cover placeholder shows the title's first letter, not an unreadable miniature title. This answers the 2026-10-15 finish review's open question (wiki/design.md), and it is ask question 2.
- **Open question:** The app pulses its loading skeleton today; the direction sheet draws it still, as research 2.6 prefers [S30]. Keep it still?

Where the files below disagree, the later layer wins: the owner's decisions, then the controller's rulings, then the judges' rulings, then the directions file.

## What is here

| Path | What it holds |
|---|---|
| `critiques/shelfmark.md` | The design critic's review against today, and the controller's rulings over it. |
| `manifests/shelfmark.tokens.css`, `manifests/shelfmark.tokens-map.md` | The token hand-off in the app's own names, and the renamed, new and unused tokens. |
| `manifests/shelfmark.board-notes.md` | What the board said beside the screens: the asks, decisions, reopened rules, open questions, the contrast table and the runner-up. |
| `canvas/shelfmark-*.dc.html` | The board's own artboards for the direction sheet and the proposed screens: HTML and CSS in the board's component format (a `<x-dc>` page with `{{…}}` values filled by the script at its foot). They need the board's runtime to render, so read them as source; no rendered picture of them exists outside the board. |
| `shots/shelfmark/` | Today's screens as the board showed them before the redesign. |

People's names and data in the pictures come from seeded demo accounts or are invented.

## Not here

The sketches and the judges' images, the runner-up's build (its notes are in the board's notes), the build's scripts, and the screenshots taken while it was built. They stay in the estate build folder.
