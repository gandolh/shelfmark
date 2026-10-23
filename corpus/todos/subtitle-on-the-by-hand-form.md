---
title: A subtitle field on the by-hand form
created: 2026-10-23
status: open
tags: [v1.x]
---

# A subtitle field on the by-hand form

Brief 30's reader finds the subtitle in a CIP block ("Ferestrele Clujului :
exerciţii de memorie culturală"), but the by-hand form in
`web/src/add/ManualForm.tsx` has no subtitle field, so it is dropped. Books
already have a `subtitle` column, and lookups fill it. Either the form gains
an optional Subtitle field, filled from the block like the others, or the
subtitle is put in only when the book is saved. The field is the plainer of
the two.
