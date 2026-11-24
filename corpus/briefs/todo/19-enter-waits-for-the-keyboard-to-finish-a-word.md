# Task 19: Enter waits for the keyboard to finish a word

**Depends on:** nothing. **Runs after:** 18 (so the gate shows every failing step).
**Builder:** Sonnet.
**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Promoted 2026-11-25 from the todo `todos/enter-waits-for-the-keyboard-to-finish-a-word.md` (modern-web-guidance
research of 2026-11-23 in the skills library). The todo said "unverified on a phone"; the check moves to the owner
(below) and the fix is built now because it is one guard with no downside on a keyboard that does not compose.

## Context

A phone keyboard with word suggestions, and any input method for accented or non-Latin text, composes a word before
it commits it. An Enter pressed during that composition belongs to the keyboard. Two handlers here act on it anyway:

- `web/src/book/TagsField.tsx` (`onKeyDown`): Enter adds the typed text as a chip.
- `web/src/add/ShelfPicker.tsx` (`onKeyDown`): Enter closes the picker on "this shelf".

On Android Chrome the likely symptom is a chip made from a half-finished word (or the word's ending left in the
field), or the keyboard's own Enter swallowed. The owner types Romanian, so diacritics make this a real path. The
fix is one check in both handlers: return, with no `preventDefault`, when `event.nativeEvent.isComposing` is true or
`event.keyCode === 229` (Safari still sends 229 for the Enter that ends a composition). `postern` and `satchel`
already do this (`event.nativeEvent.isComposing` in satchel's composer, `event.isComposing` in postern's shortcuts).

## Decisions

- One small helper, so the two handlers cannot drift: `isComposingKey(event)` in a new `web/src/lib/ime.ts`
  (`event: { nativeEvent: { isComposing: boolean }; keyCode: number }`, a structural type so a test passes a plain
  object). Both handlers call it first thing for the Enter branch.
- The Escape and Backspace branches are untouched: only Enter is ambiguous.
- No React DOM test environment exists in this repo (`vitest.config.ts` has none and no `*.test.tsx` under `web/`);
  don't add one. Unit-test the helper; the handlers are a one-line call each.

## Files you OWN

- `web/src/lib/ime.ts` and `web/src/lib/ime.test.ts` (new), `web/src/book/TagsField.tsx`, `web/src/add/ShelfPicker.tsx`.
- Closeout: outcome note, `corpus/log.md`, `corpus/wiki/status.md`, the todo's removal if the corpus rules delete it.

## Files you must NOT touch

- Any other input handler, `vendor/`, `server/`, lockfiles, `infrastructure/`.

## Steps

1. Write `isComposingKey` and its test: composing true, keyCode 229 with `isComposing` false, a plain Enter (false).
2. In `TagsField` and `ShelfPicker`, at the top of the `event.key === "Enter"` branch, `if (isComposingKey(event))
   return;` before `preventDefault`. Keep each comment saying why the form must not submit on a plain Enter.
3. `npm run check:fast`, then `npx vitest run web/src/lib/ime.test.ts`; `npm run check` once at the end.

## Acceptance

- [ ] `ime.test.ts` passes (the three cases); `npm run check` exit 0; `bash corpus/lint.sh` OK.
- [ ] Both handlers call the helper before `preventDefault`; a plain Enter still adds a chip and still closes the picker (the helper returns false).
- [ ] End move: `Ready for deploy` (web client only: `node cli.ts shelfmark deploy`), with the owner test below listed.

## Owner steps

- After the deploy, on the Android phone (Gboard, suggestions on): in a book's Tags field type a Romanian word with
  diacritics (for example "povești") and press Enter while the last word is still underlined. Expected: the chip holds
  the whole word, once, and no word ending is left in the field. Repeat in the shelf picker's "write a new shelf"
  field: Enter while the word is still underlined must not close the picker on a half word. Then a plain Enter after
  the word is committed must still add the chip / close the picker. Report what was seen.

## Owner decisions

- Settled 2026-11-25 (owner): promote it.
- Mine (technical): build the guard before the phone check, since it is harmless when there is no bug; a shared
  helper instead of two inline checks; helper test only, no DOM test environment.
