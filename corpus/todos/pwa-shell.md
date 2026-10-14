---
title: PWA: install and offline shell
created: 2026-10-14
status: open
tags: [v1, web]
---

# PWA: install and offline shell

Manifest, icons, a service worker that precaches the app shell and the scanner's
`.wasm`, an update prompt. The app opens offline and says so; data features wait
for the network until the v1.x offline todos land.

## Context

The owner asked for a website with PWA. iOS standalone camera quirks in
[scanning.md](../wiki/scanning.md).
