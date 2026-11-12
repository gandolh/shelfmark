import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseTrustedProxies, wardClientOptionsFromEnv, type WardClientOptions } from "../vendor/ward/ward-auth.js";

/** The repo root. `src/` (tsx in dev) and `dist/` (built) sit at the same depth, so this resolves the same from both. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The data folder when `DATA_DIR` is unset. */
const DEFAULT_DATA_DIR = "./data";

/** Where the auth plugin's routes sit as Fastify sees them (`plugins/auth/index.ts`); the browser reaches them under the API prefix. */
export const AUTH_ROUTE_PREFIX = "/auth";

/** The Ward callback, under the API prefix: `WARD_OIDC_REDIRECT_URI` is the origin, the prefix, then this. */
export const WARD_CALLBACK_PATH = `${AUTH_ROUTE_PREFIX}/ward/callback`;

/** The server's settings, read once at startup from the environment (and the repo's `.env`). */
export interface Config {
  host: string;
  port: number;
  /** As given. `server.ts` resolves a relative path against the repo root (`resolveDataDir`). */
  dataDir: string;
  /** The app's own origin as the browser sees it, bare. Default is the Vite dev server. */
  publicOrigin: string;
  /** The API prefix as the browser sees it. Default `/shelfmark-api`. */
  apiPrefix: string;
  /** The web app's base path, with a trailing slash. Default `/shelfmark/` (the web build's `SHELFMARK_BASE`). */
  webBase: string;
  /** Optional: lookups skip Google Books when unset. */
  googleBooksApiKey: string | undefined;
  /** `CIP_REFRESH`: whether the server refreshes the CIP index weekly (`features/lookup/cip/job.ts`). Default on; `off` stops it. */
  cipRefresh: boolean;
  /**
   * "Sign in with Ward": the five `WARD_OIDC_*` settings, or `undefined` when
   * `WARD_OIDC_ISSUER` is unset, and then the server has local accounts only
   * and the login page shows no Ward button. `clientKey` is a secret: never log it.
   */
  ward: WardClientOptions | undefined;
  /**
   * `AUTH_TRUSTED_PROXIES`, comma-separated: the peers besides loopback (addresses
   * or CIDR ranges) whose `X-Forwarded-For` the login lockout believes. Empty
   * means loopback only, which is right under the Vite dev proxy and for a
   * server on loopback. In a container it is the network the host's proxy
   * reaches it from, or every client shares one lockout.
   */
  trustedProxies: string[];
}

/** The environment cannot run the server. The message names every key at fault. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** An empty value (`KEY=` copied from `.env.example`) counts as not set. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z.object({
  HOST: optional(z.string()).transform((value) => value ?? "127.0.0.1"),
  PORT: optional(
    z.coerce.number<string>().int().min(1).max(65535, { message: "PORT must be a port number (1-65535)." }),
  ).transform((value) => value ?? 8808),
  DATA_DIR: optional(z.string()).transform((value) => value ?? DEFAULT_DATA_DIR),
  PUBLIC_ORIGIN: optional(
    z.string().refine((value) => URL.canParse(value) && new URL(value).origin === value, {
      message: "PUBLIC_ORIGIN must be a bare origin such as https://example.com: no path and no trailing slash.",
    }),
  ).transform((value) => value ?? "http://localhost:5176"),
  SHELFMARK_API_PREFIX: optional(
    z.string().regex(/^\/[^\s?#]*[^/\s?#]$/, {
      message: "SHELFMARK_API_PREFIX must be a path such as /shelfmark-api: a leading slash and no trailing slash.",
    }),
  ).transform((value) => value ?? "/shelfmark-api"),
  SHELFMARK_BASE: optional(
    z.string().regex(/^\/([^\s?#]*\/)?$/, {
      message: "SHELFMARK_BASE must be a path such as /shelfmark/: a leading and a trailing slash.",
    }),
  ).transform((value) => value ?? "/shelfmark/"),
  GOOGLE_BOOKS_API_KEY: optional(z.string()),
  CIP_REFRESH: optional(z.enum(["on", "off"], { error: "CIP_REFRESH must be on or off." })).transform(
    (value) => value !== "off",
  ),
});

function describe(issue: z.core.$ZodIssue): string {
  const key = String(issue.path[0] ?? "");
  return issue.message.startsWith(key) ? issue.message : `${key}: ${issue.message}`;
}

/**
 * The Ward settings, read by the library's own reader so the rules are its
 * (an empty `WARD_OIDC_ISSUER` means off; with it set, the client id, key and
 * redirect URI must be too). On top: the redirect URI must be the callback
 * under the API prefix, where the session cookie and the dev proxy are.
 * Messages never repeat the key.
 */
function wardSettings(
  env: NodeJS.ProcessEnv,
  apiPrefix: string | undefined,
  problems: string[],
): WardClientOptions | undefined {
  let ward: WardClientOptions | undefined;
  try {
    ward = wardClientOptionsFromEnv(env);
  } catch (error) {
    problems.push(
      `${error instanceof Error ? error.message : String(error)}. Set all of them, or leave WARD_OIDC_ISSUER empty for local accounts only.`,
    );
    return undefined;
  }
  if (ward === undefined || apiPrefix === undefined) return ward;
  const expected = `${apiPrefix}${WARD_CALLBACK_PATH}`;
  if (!URL.canParse(ward.redirectUri) || new URL(ward.redirectUri).pathname !== expected) {
    problems.push(
      `WARD_OIDC_REDIRECT_URI must be the callback as the browser reaches it: the app's origin, then ${expected}.`,
    );
  }
  return ward;
}

/** `AUTH_TRUSTED_PROXIES` as a list, checked by the library's own parser (a malformed entry or a /0 is refused). */
function trustedProxies(value: string, problems: string[]): string[] {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  try {
    parseTrustedProxies(entries);
  } catch (error) {
    problems.push(`AUTH_TRUSTED_PROXIES: ${error instanceof Error ? error.message : String(error)}.`);
  }
  return entries;
}

/** Parse and validate the environment. Throws `ConfigError` listing every problem; never exits. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  const problems = parsed.success ? [] : parsed.error.issues.map(describe);
  // Read on their own too, so one run names every key at fault.
  const apiPrefix = envSchema.shape.SHELFMARK_API_PREFIX.safeParse(env.SHELFMARK_API_PREFIX);
  const ward = wardSettings(env, apiPrefix.success ? apiPrefix.data : undefined, problems);
  const proxies = trustedProxies(env.AUTH_TRUSTED_PROXIES ?? "", problems);
  if (!parsed.success || problems.length > 0) {
    throw new ConfigError(problems.join("\n"));
  }
  const values = parsed.data;
  return {
    host: values.HOST,
    port: values.PORT,
    dataDir: values.DATA_DIR,
    publicOrigin: values.PUBLIC_ORIGIN,
    apiPrefix: values.SHELFMARK_API_PREFIX,
    webBase: values.SHELFMARK_BASE,
    googleBooksApiKey: values.GOOGLE_BOOKS_API_KEY,
    cipRefresh: values.CIP_REFRESH,
    ward,
    trustedProxies: proxies,
  };
}

/**
 * Loads the repo's `.env` into `process.env` (a variable already set wins) and
 * returns its path, or `undefined` when there is no such file. Call it before
 * `loadConfig()` in a process entry: the server, the seed and the CIP refresh.
 * The root comes from this file's own location, so a file that moves can't
 * quietly stop reading it.
 */
export function loadEnvFile(): string | undefined {
  const path = `${REPO_ROOT}.env`;
  try {
    process.loadEnvFile(path);
    return path;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return undefined;
  }
}

/**
 * The data folder as an absolute path: `npm run dev` runs the server from
 * `server/`, so a relative `DATA_DIR` means the repo root's. One rule for the
 * server, the seed and the CIP refresh; `buildApp` opens `<dataDir>/shelfmark.db` there.
 */
export function resolveDataDir(configured: string): string {
  return isAbsolute(configured) ? configured : resolve(REPO_ROOT, configured);
}

/** What the seed command reads from the environment. An unset name or password is empty, for the command to ask for. */
export interface SeedConfig {
  username: string;
  password: string;
  /** `DATA_DIR`, resolved as the server resolves it. */
  dataDir: string;
}

/** `SEED_USERNAME` (trimmed), `SEED_PASSWORD` (as typed, spaces and all) and `DATA_DIR`. */
export function loadSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  return {
    username: env.SEED_USERNAME?.trim() ?? "",
    password: env.SEED_PASSWORD ?? "",
    dataDir: resolveDataDir(env.DATA_DIR || DEFAULT_DATA_DIR),
  };
}
