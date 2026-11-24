---
title: Enter waits for the keyboard to finish a word
created: 2026-11-23
status: promoted
tags: [web, phone, v1.x]
---

# Enter waits for the keyboard to finish a word

Promoted 2026-11-24 to [brief 19](../briefs/done/19-enter-waits-for-the-keyboard-to-finish-a-word.md).

From the modern-web-guidance research of 2026-11-23 (my-personal-skills, `corpus/wiki/modern-web-guidance-2026-11-23.md`
there). Unverified on a phone: confirm it before building.

A phone keyboard with word suggestions, and any input method for accented or non-Latin text, composes a word before
it commits it. An Enter pressed during that composition belongs to the keyboard. Two Enter handlers here act on it
anyway:

- `web/src/book/TagsField.tsx`: Enter adds the typed text as a chip.
- `web/src/add/ShelfPicker.tsx`: Enter closes the picker on "this shelf".

On Android Chrome the likely symptom is a chip made from a half-finished word (or the word's ending left behind in
the field), or the keyboard's own Enter swallowed. The fix is one check in both handlers: return when
`event.nativeEvent.isComposing` is true, or when `keyCode` is 229, which Safari still sends for the Enter that ends a
composition. Postern's shortcuts and Satchel's composer already do this. The `web-platform` skill (my-personal-skills
brief 44) will carry the guide `forms/ime-safe-enter-submit.md` with the details.

First step: on an Android phone with Gboard, type a tag whose last word is still underlined, press Enter, and see
what happens. If nothing goes wrong, close this todo with what was seen.
