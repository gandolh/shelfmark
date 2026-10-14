import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

function problems(env: NodeJS.ProcessEnv): string {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).message;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("defaults every setting", () => {
    expect(loadConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8808,
      dataDir: "./data",
      publicOrigin: "http://localhost:5176",
      apiPrefix: "/shelfmark-api",
      webBase: "/shelfmark/",
      googleBooksApiKey: undefined,
    });
  });

  it("reads the overrides, and treats an empty value as unset", () => {
    const config = loadConfig({ HOST: "0.0.0.0", PORT: "8796", DATA_DIR: "/data", GOOGLE_BOOKS_API_KEY: "k", SHELFMARK_BASE: "" });
    expect(config).toMatchObject({ host: "0.0.0.0", port: 8796, dataDir: "/data", googleBooksApiKey: "k", webBase: "/shelfmark/" });
    expect(loadConfig({ GOOGLE_BOOKS_API_KEY: "" }).googleBooksApiKey).toBeUndefined();
  });

  it("names every key at fault", () => {
    const message = problems({ PORT: "70000", SHELFMARK_API_PREFIX: "/shelfmark-api/", PUBLIC_ORIGIN: "https://example.com/" });
    expect(message).toContain("PORT");
    expect(message).toContain("SHELFMARK_API_PREFIX");
    expect(message).toContain("PUBLIC_ORIGIN");
  });

  it("wants a base with both slashes", () => {
    expect(problems({ SHELFMARK_BASE: "/shelfmark" })).toContain("SHELFMARK_BASE");
  });
});
