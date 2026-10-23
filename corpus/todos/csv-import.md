---
title: CSV import
created: 2026-10-14
status: promoted
tags: [v1.x]
---

Promoted 2026-10-23 into [brief 28](../briefs/done/28-csv-import.md).

# CSV import

Import a CSV from Goodreads, Libib or a spreadsheet: map columns to fields, look
up rows that only have an ISBN, show a preview with duplicates flagged, then
save.

## Context

Moves to v1 if the owner already has a list ([open-questions.md](../wiki/open-
questions.md)). Libib's import needs only an ISBN column; LibraryThing exports
can be non-UTF-8, so detect the encoding.
