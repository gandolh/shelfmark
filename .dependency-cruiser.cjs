// The house dependency-cruiser preset, from the vendored house-style copy: no cycles, no unresolvable
// imports, a feature used through its index only, no Fastify in lib/.
module.exports = {
  extends: "./vendor/house-style/.dependency-cruiser.cjs",
  forbidden: [
    // The server and shared have no cycle left: the house rule stands there (2026-11-12). The web app keeps
    // two, add/flow.ts with words.ts and form.ts, which import each other; a warning until the add flow's
    // shared types sit in a module of their own.
    {
      name: "no-circular",
      severity: "error",
      comment: "A cycle makes load order matter and leaves no layer that can be read on its own.",
      from: { path: "^(server|shared)/" },
      to: { circular: true },
    },
    {
      name: "no-circular-web",
      severity: "warn",
      comment: "The web app's add flow, until its shared types move out.",
      from: { path: "^web/" },
      to: { circular: true },
    },
  ],
  options: {
    // Vite's `?url` suffix asks for a file's address; the bundler resolves it, dependency-cruiser can't.
    exclude: { path: "(^|/)(vendor|dist|coverage)/|\\?url$" },
  },
};
