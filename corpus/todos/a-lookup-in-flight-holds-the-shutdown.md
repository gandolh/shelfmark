---
title: A lookup in flight holds the shutdown
created: 2026-11-12
status: open
tags: [server]
---

# A lookup in flight holds the shutdown

Found by brief 08's builder (2026-11-12). A book lookup can wait on the catalogs for up to about 40 s on a miss.
If the container is stopped while one runs, Fastify waits for it, `close-with-grace` runs out its 10 s, and the
process exits 1 (a deploy then logs a failed stop). The real-socket check only covered an idle server.

## What to do

- Give the lookup's outbound requests (Open Library, the CIP source, the others in `features/lookup/`) an
  `AbortSignal` that a `preClose` hook aborts, so a stop answers the client at once (a 503 is fine) and closes.
- Check on a real socket: start the built server, hold a lookup against a slow stub, send SIGTERM, expect exit 0
  within a second, read from the node PID.
