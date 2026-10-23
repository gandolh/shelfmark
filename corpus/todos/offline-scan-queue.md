---
title: Offline scan queue
created: 2026-10-14
status: promoted
tags: [v1.x]
---

Promoted 2026-10-23 into [brief 25](../briefs/todo/25-offline-scan-queue.md).

# Offline scan queue

Scans made offline wait in IndexedDB and are looked up and offered for
confirmation once the network is back.

## Context

Goes through the same lookup queue as everything else; see [metadata-
lookup.md](../wiki/metadata-lookup.md).
