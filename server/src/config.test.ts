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
      ward: undefined,
      trustedProxies: [],
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

  describe("Sign in with Ward", () => {
    // What Ward's local seed writes. The key is a stand-in: the config never reads it, `createWardClient` does.
    const WARD = {
      WARD_OIDC_ISSUER: "http://localhost:8792/ward-api/oidc",
      WARD_OIDC_CLIENT_ID: "shelfmark",
      WARD_OIDC_CLIENT_KEY: "not-a-real-key",
      WARD_OIDC_REDIRECT_URI: "http://localhost:5176/shelfmark-api/auth/ward/callback",
      WARD_OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:5176/shelfmark/",
    };

    it("is on with the five settings", () => {
      expect(loadConfig(WARD).ward).toEqual({
        issuer: "http://localhost:8792/ward-api/oidc",
        clientId: "shelfmark",
        clientKey: "not-a-real-key",
        redirectUri: "http://localhost:5176/shelfmark-api/auth/ward/callback",
        postLogoutRedirectUri: "http://localhost:5176/shelfmark/",
      });
    });

    it("is off with WARD_OIDC_ISSUER empty, whatever else is set", () => {
      expect(loadConfig({ ...WARD, WARD_OIDC_ISSUER: "" }).ward).toBeUndefined();
    });

    it("names what is missing when the issuer is set, and never repeats the key", () => {
      const message = problems({ ...WARD, WARD_OIDC_CLIENT_ID: "", WARD_OIDC_REDIRECT_URI: "" });
      expect(message).toContain("WARD_OIDC_CLIENT_ID");
      expect(message).toContain("WARD_OIDC_REDIRECT_URI");
      expect(message).not.toContain("not-a-real-key");
    });

    it("wants the callback under the API prefix", () => {
      const elsewhere = problems({ ...WARD, WARD_OIDC_REDIRECT_URI: "http://localhost:5176/shelfmark/auth/ward/callback" });
      expect(elsewhere).toContain("WARD_OIDC_REDIRECT_URI");
      expect(elsewhere).toContain("/shelfmark-api/auth/ward/callback");
      const prefix = { SHELFMARK_API_PREFIX: "/books-api", WARD_OIDC_REDIRECT_URI: "https://example.com/books-api/auth/ward/callback" };
      expect(loadConfig({ ...WARD, ...prefix }).ward?.redirectUri).toBe(prefix.WARD_OIDC_REDIRECT_URI);
    });
  });

  describe("AUTH_TRUSTED_PROXIES", () => {
    it("reads a comma-separated list of addresses and ranges", () => {
      expect(loadConfig({ AUTH_TRUSTED_PROXIES: " 172.16.0.0/12, 10.0.0.2 ,fd00::/8," }).trustedProxies).toEqual([
        "172.16.0.0/12",
        "10.0.0.2",
        "fd00::/8",
      ]);
    });

    it.each(["0.0.0.0/0", "172.19.0.3/16", "caddy"])("refuses %s", (value) => {
      expect(problems({ AUTH_TRUSTED_PROXIES: value })).toContain("AUTH_TRUSTED_PROXIES");
    });
  });

  it("names the Ward and proxy keys along with the rest", () => {
    const message = problems({ PORT: "0", AUTH_TRUSTED_PROXIES: "0.0.0.0/0", WARD_OIDC_ISSUER: "http://localhost:8792/ward-api/oidc" });
    expect(message).toContain("PORT");
    expect(message).toContain("AUTH_TRUSTED_PROXIES");
    expect(message).toContain("WARD_OIDC_CLIENT_ID");
  });
});
