---
title: Offline scan queue
created: 2026-10-14
status: open
tags: [v1.x]
---

# Offline scan queue

Scans made offline wait in IndexedDB and are looked up and offered for
confirmation once the network is back.

## Context

Goes through the same lookup queue as everything else; see [metadata-
lookup.md](../wiki/metadata-lookup.md).
