import { houseStyle } from "./vendor/house-style/eslint.config.js";

/**
 * The house config from the vendored house-style copy, given Shelfmark's folders. Thin on purpose: the
 * compiler is the first gate, and the house adds only what it cannot see. The rules and the reason for
 * each are in the copy.
 */
export default [
  ...houseStyle({
    root: import.meta.dirname,
    web: "web/src",
    server: "server/src",
    // Scripts run by hand, which print and read the environment directly: the repo's own, the docs
    // capture helper and the OCR fixture recorder.
    scripts: ["server/scripts", "docs/images", "web/src/ocr/fixtures"],
    // Allowed to print: the server entry, the seed and the CIP refresh talk to the person running them.
    console: ["server/src/server.ts", "server/src/seed.ts", "server/src/features/lookup/cip/cli.ts"],
    // ScannerDemo is loaded with lazy(import()), which reads `default`.
    defaultExports: ["web/src/scanner/ScannerDemo.tsx"],
    // The Tailwind entry: the unknown-class, conflicting-class and class-order rules read its theme.
    tailwind: { css: "web/src/styles/index.css", order: true },
    // data/ is the local database.
    ignores: ["data/**", "**/dev-dist/**"],
    // Files no tsconfig reaches; the tool configs and .mjs files are linted without types by the house.
    typed: { allowDefaultProject: ["server/scripts/*.ts"] },
    // add/flow.test.ts asserts through the expectStep helper.
    assertFunctionNames: ["expect", "expectTypeOf", "expectStep"],
  }),
];
