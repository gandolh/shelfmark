---
title: Book store and CRUD API
created: 2026-10-14
status: promoted
tags: [v1, server]
---

# Book store and CRUD API

The SQLite schema and the store module that is the only place running SQL, plus
`GET/POST/PATCH/DELETE /api/books` with zod schemas from `shared`. Tags as their
own tables. Migrations that run on boot.

## Context

Schema proposal in [data-model.md](../wiki/data-model.md). One row per
physical copy is decided; wishlist rows share the table; no loans
([decisions.md](../wiki/decisions.md)).

Promoted to [brief 02](../briefs/todo/02-book-store-and-api.md) on 2026-10-14.
