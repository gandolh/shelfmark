# Task 13: Name the account the old statuses go to

**Depends on:** brief 11 (migration 5, which moves the books' statuses and ratings to one account).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

Migration 5 gives every existing status and rating to the earliest-created owner account. On 2026-11-17 the owner said they have two accounts: the original local one and a newer one, `acasa`, that they use. With the default rule their statuses would land on the account they don't use.

## The design

- `SHELFMARK_READINGS_TO` (optional, in `config.ts` as `readingsTo`): a username. When set, migration 5 gives the statuses and ratings to that account, matched folded as sign-in matches it (`foldUsername`); when it names no account, the migration throws and changes nothing. Unset, the earliest-created owner gets them, as before.
- `openDb(path, { readingsTo })` and `migrate(db, list, options)` carry it to the migration; `app.ts` passes the config's value. The dry run, `server/scripts/check-stored-replies.ts`, takes the username as an optional second argument.
- The value reaches the container through vps-deploy's Shelfmark stack (`SHELFMARK_READINGS_TO`, an optional key in its Shelfmark secrets file), committed there as `c28fdf7`; the owner's local secrets file already holds `acasa`.

## Acceptance

- [x] With `SHELFMARK_READINGS_TO` set (in any case), the statuses and ratings go to that account, not the earliest.
- [x] A name with no account makes the migration throw and leaves the database at version 4.
- [x] `npm run check` passes.

## Outcome

Built 2026-11-17 on `main` (13e482e; vps-deploy c28fdf7), not pushed; Ready for deploy with briefs 11 and 12. `npm run check` exit 0 (911 tests); two new migration tests. Migration 5 had not shipped yet, so it was changed in place rather than followed by a sixth.
