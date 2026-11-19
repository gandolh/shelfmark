import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { loadConfig } from "../../config.js";
import { databasePath, openDb } from "../../db/open.js";
import { openAccounts, seedOwner } from "./accounts.js";

/**
 * Linking and unlinking Ward, and renaming, through the real app: the vendored
 * plugin's `/auth/*` routes as Shelfmark wires them. Ward itself is never
 * reached: the issuer is the discard port on loopback.
 */

interface Owner {
  app: FastifyInstance;
  dataDir: string;
  username: string;
  password: string;
  /** `app.inject` with the owner's session cookie. */
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
}

let current: Owner | undefined;
afterEach(async () => {
  if (current === undefined) return;
  await current.app.close();
  await rm(current.dataDir, { recursive: true, force: true });
  current = undefined;
});

/** A Ward client key in the shape `createWardClient` reads, made now, for a test only. */
function testClientKey(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return Buffer.from(JSON.stringify({ ...privateKey.export({ format: "jwk" }), kid: "test-key" })).toString(
    "base64url",
  );
}

function wardSettings(): NodeJS.ProcessEnv {
  return {
    WARD_OIDC_ISSUER: "http://127.0.0.1:9/ward-api/oidc",
    WARD_OIDC_CLIENT_ID: "shelfmark",
    WARD_OIDC_CLIENT_KEY: testClientKey(),
    WARD_OIDC_REDIRECT_URI: "http://localhost:5176/shelfmark-api/auth/ward/callback",
  };
}

/** The app on a temporary data folder with the owner signed in. */
async function signedIn(env: NodeJS.ProcessEnv = {}): Promise<Owner> {
  const dataDir = await mkdtemp(join(tmpdir(), "shelfmark-auth-test-"));
  const app = await buildApp(loadConfig({ DATA_DIR: dataDir, ...env }));
  const username = "owner";
  const password = randomBytes(12).toString("base64url");
  // A second connection, as the seed script run against a live server would be.
  const db = openDb(databasePath(dataDir));
  try {
    await seedOwner(openAccounts(db), { username, password });
  } finally {
    db.close();
  }
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { username, password } });
  const header = login.headers["set-cookie"];
  const lines = header === undefined ? [] : Array.isArray(header) ? header : [header];
  const cookie = lines.map((line) => line.split(";")[0] ?? "").find((pair) => pair.startsWith("shelfmark_session="));
  if (login.statusCode !== 200 || cookie === undefined) throw new Error(`Sign-in answered ${login.statusCode}`);
  current = {
    app,
    dataDir,
    username,
    password,
    inject: (options) => app.inject({ ...options, headers: { cookie, ...options.headers } }),
  };
  return current;
}

describe("linking Ward asks for the current password", () => {
  it("answers 400 without it, 401 with a wrong one, and goes on to Ward with the right one", async () => {
    const t = await signedIn(wardSettings());
    const link = (payload?: object) =>
      t.inject({ method: "POST", url: "/auth/ward/link", ...(payload === undefined ? {} : { payload }) });
    const missing = await link({});
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toEqual({ error: "invalid_request" });
    const wrong = await link({ currentPassword: "not the password" });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: "invalid_credentials" });
    // The right one starts the link; only Ward (nothing listens at the issuer) is missing.
    const right = await link({ currentPassword: t.password });
    expect(right.statusCode).toBe(503);
    expect(right.json()).toEqual({ error: "ward_unavailable" });
  });

  it("is not there without the Ward settings", async () => {
    const t = await signedIn();
    const res = await t.inject({ method: "POST", url: "/auth/ward/link", payload: { currentPassword: t.password } });
    expect(res.statusCode).toBe(404);
  });
});

describe("unlinking Ward asks for the current password", () => {
  it("answers 400 without it and 401 with a wrong one; the right one unlinks, and the password still signs in", async () => {
    const t = await signedIn(wardSettings());
    const db = openDb(databasePath(t.dataDir));
    try {
      const { id } = db
        .prepare<[string], { id: string }>("SELECT id FROM auth_users WHERE username = ?")
        .get(t.username)!;
      db.prepare("INSERT INTO auth_ward_links (subject, user_id, linked_at) VALUES ('ward-subject', ?, 0)").run(id);
    } finally {
      db.close();
    }
    expect((await t.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({
      ward: { enabled: true, linked: true },
    });
    const unlink = (payload?: object) =>
      t.inject({ method: "POST", url: "/auth/ward/unlink", ...(payload === undefined ? {} : { payload }) });
    expect((await unlink({})).statusCode).toBe(400);
    const wrong = await unlink({ currentPassword: "not the password" });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: "invalid_credentials" });
    expect((await unlink({ currentPassword: t.password })).statusCode).toBe(200);
    expect((await t.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({
      ward: { enabled: true, linked: false },
    });
    const again = await t.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: t.username, password: t.password },
    });
    expect(again.statusCode).toBe(200);
  });

  it("answers the 409 before it looks at the body", async () => {
    const t = await signedIn(wardSettings());
    const res = await t.inject({ method: "POST", url: "/auth/ward/unlink", payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "not_linked" });
  });
});

describe("changing the username", () => {
  it("refuses a name another account holds, in any case and as a look-alike", async () => {
    const t = await signedIn();
    const db = openDb(databasePath(t.dataDir));
    try {
      await openAccounts(db).createUser({
        username: "alice",
        password: randomBytes(12).toString("base64url"),
        role: "owner",
      });
    } finally {
      db.close();
    }
    for (const name of ["alice", "ALICE", "AIice", "a1ice"]) {
      const res = await t.inject({ method: "POST", url: "/auth/username", payload: { username: name } });
      expect({ name, status: res.statusCode, body: res.json<unknown>() }).toEqual({
        name,
        status: 409,
        body: { error: "username_taken" },
      });
    }
    expect((await t.inject({ method: "GET", url: "/auth/session" })).json()).toMatchObject({
      user: { username: t.username },
    });
  });
});
