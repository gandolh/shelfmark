---
title: Export to CSV and Excel, and backup
created: 2026-10-14
status: promoted
tags: [v1, web, server]
---

# Export to CSV and Excel, and backup

An export menu on the table: CSV or XLSX, for the current view or for
everything. CSV with a UTF-8 BOM and the formula-injection guard; XLSX through
`write-excel-file` with typed cells. Plus `GET /api/backup`, a zip of the
database and covers.

## Context

The owner asked for export to Excel/CSV. Details and the rejected libraries in
[export.md](../wiki/export.md).

## Acceptance

Exported files open in Excel with Romanian diacritics intact.

Promoted to [brief 11](../briefs/todo/11-export-and-backup.md) on 2026-10-14.
