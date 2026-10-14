---
title: Camera barcode scanner
created: 2026-10-14
status: promoted
tags: [v1, web]
---

# Camera barcode scanner

A single scanner screen: rear camera, continuous scanning of EAN-13/8, UPC and
Code-128 through the `barcode-detector` ponyfill with a self-hosted `.wasm`,
beep or vibrate per read, the same code ignored for a few seconds, an "already
owned" warning, and a confirm card before saving. It never navigates while the
camera runs.

## Context

The owner asked to "scan an ISBN or some barcode from a book" and add it to the
database. Traps (iOS standalone re-prompt, HTTPS, add-on bars, non-ISBN codes)
in [scanning.md](../wiki/scanning.md).

## Acceptance

Scanning a book's barcode on a phone ends with the book saved in SQLite.

Promoted to [brief 07](../briefs/todo/07-camera-scanner.md) on 2026-10-14.
