---
title: Metadata lookup and covers
created: 2026-10-14
status: open
tags: [v1, server]
---

# Metadata lookup and covers

`POST /api/lookup { isbn }` returns a draft book: lookup cache first, then Open
Library, then Google Books, merged field by field. One server-side queue
respects the rate limits. The chosen cover is downloaded once to `data/covers/`
and served by the API.

## Context

Sources, limits and measured hit rates in [metadata-lookup.md](../wiki/metadata-
lookup.md). Measure Google Books' Romanian coverage on the same Wikidata samples
once a key exists. Send a `User-Agent` naming the app and the placeholder
contact `johndoe@example.com`.

## Owner step

Create the Google Books key before this brief runs: a Google Cloud project,
enable the Books API, create an API key restricted to the Books API, and put it
in `.env` as `GOOGLE_BOOKS_API_KEY`. The key is free; it never goes into git.
