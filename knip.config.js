import preset from "./vendor/house-style/knip.json" with { type: "json" };

// knip has no `extends`, so this spreads the house preset and adds what knip can't find on its own:
// the CLIs and scripts run by hand, and `pdftotext`, which the CIP refresh runs (poppler, in the image).
export default {
  ...preset,
  ignoreBinaries: ["pdftotext"],
  workspaces: {
    ".": { entry: ["docs/images/*.mjs"] },
    server: { entry: ["src/features/lookup/cip/cli.ts", "scripts/*.ts"] },
    web: { entry: ["src/ocr/fixtures/record.ts"] },
  },
};
