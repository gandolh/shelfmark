import { z } from "zod";

/** The server's settings, read once at startup from the environment (and the repo's `.env`). */
export interface Config {
  host: string;
  port: number;
  /** As given. `index.ts` resolves a relative path against the repo root. */
  dataDir: string;
  /** The app's own origin as the browser sees it, bare. Default is the Vite dev server. */
  publicOrigin: string;
  /** The API prefix as the browser sees it. Default `/shelfmark-api`. */
  apiPrefix: string;
  /** The web app's base path, with a trailing slash. Default `/shelfmark/` (the web build's `SHELFMARK_BASE`). */
  webBase: string;
  /** Optional: lookups skip Google Books when unset. */
  googleBooksApiKey: string | undefined;
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
  DATA_DIR: optional(z.string()).transform((value) => value ?? "./data"),
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
});

function describe(issue: z.core.$ZodIssue): string {
  const key = String(issue.path[0] ?? "");
  return issue.message.startsWith(key) ? issue.message : `${key}: ${issue.message}`;
}

/** Parse and validate the environment. Throws `ConfigError` listing every problem; never exits. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map(describe).join("\n"));
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
  };
}
