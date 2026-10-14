---
title: Scaffold the npm workspaces
created: 2026-10-14
status: open
tags: [v1, infra]
---

# Scaffold the npm workspaces

Create the repo skeleton the other briefs build on: `shared`, `server`, `web` as
npm workspaces in Satchel's layout, Node 24, exact versions, strict TypeScript,
Vitest, ESLint, `npm run dev` running API and Vite together with the
`/shelfmark-api` proxy, and a `dev:https` script so the camera can be tested on
a phone over the LAN.

## Context

See [architecture.md](../wiki/architecture.md). Copy conventions from
`../satchel` (root `package.json`, `tsconfig.base.json`, `.npmrc`), not its
code. Pick current versions at build time; vite-plugin-pwa 2.0.0 was only eleven
days old on 2026-10-14.
