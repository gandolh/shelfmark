// The house dependency-cruiser preset, from the vendored house-style copy: no cycles, no unresolvable
// imports, a feature used through its index only, no Fastify in lib/.
module.exports = {
  extends: "./vendor/house-style/.dependency-cruiser.cjs",
  forbidden: [
    // A warning for now (2026-11-11): the route files import their context type from app.ts, which
    // imports them back, and add/flow.ts, words.ts and form.ts import each other. When each feature has
    // its own options type and the add flow's shared types sit in a module of their own, this goes.
    { name: "no-circular", severity: "warn" },
  ],
  options: {
    // Vite's `?url` suffix asks for a file's address; the bundler resolves it, dependency-cruiser can't.
    exclude: { path: "(^|/)(vendor|dist|coverage)/|\\?url$" },
  },
};
