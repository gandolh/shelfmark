import { defineConfig } from "@playwright/test";

/**
 * The redesign's browser checks. They run against a dev server (`npm run dev`) that is signed in to a scratch
 * library filled by `docs/images/demo-seed.mjs`; nothing here reaches a catalog, because the lookup is stubbed.
 * Set E2E_URL to the page's address (default http://localhost:5176/shelfmark/), E2E_USER and E2E_PASSWORD to the
 * scratch account. Run with `npx playwright test --workers=2`.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 2,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:5176/shelfmark/",
    browserName: "chromium",
    serviceWorkers: "block",
  },
});
