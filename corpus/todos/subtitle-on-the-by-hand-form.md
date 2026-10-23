---
title: A subtitle field on the by-hand form
created: 2026-10-23
status: promoted
tags: [v1.x]
---

Promoted 2026-10-23 into [brief 31](../briefs/todo/31-subtitle-on-the-by-hand-form.md).

# A subtitle field on the by-hand form

Brief 30's reader finds the subtitle in a CIP block ("Ferestrele Clujului :
exerciţii de memorie culturală"), but the by-hand form in
`web/src/add/ManualForm.tsx` has no subtitle field, so it is dropped. Books
already have a `subtitle` column, and lookups fill it. Either the form gains
an optional Subtitle field, filled from the block like the others, or the
subtitle is put in only when the book is saved. The field is the plainer of
the two.

**Owner's call, 2026-10-23:** the field. An optional Subtitle field under Title
on the by-hand form, which "Read the CIP block" fills and marks "From the CIP
block: check it" like the other fields, because the OCR can misread a subtitle's
diacritics and it should be editable before the save. Rejected: saving it unseen
with the book, and leaving it to Edit afterwards.
