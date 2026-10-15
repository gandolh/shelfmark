import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";
import { backupFileName } from "./backup.js";

let t: SignedInTestApp | undefined;
let dir: string | undefined;

afterEach(async () => {
  await t?.close();
  t = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

const png = (): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(200)]);
const leftovers = () => readdirSync(tmpdir()).filter((name) => name.startsWith("shelfmark-backup-"));

describe("GET /api/backup", () => {
  it("needs a session", async () => {
    t = await startSignedInApp();
    const res = await t.app.inject({ method: "GET", url: "/api/backup" });
    expect(res.statusCode).toBe(401);
  });

  it("downloads a database holding the same books and covers, and leaves no temp file", async () => {
    t = await startSignedInApp();
    const ids: number[] = [];
    for (const title of ["Orbitor", "Ș și Ț"]) {
      const res = await t.inject({ method: "POST", url: "/api/books", payload: { title } });
      expect(res.statusCode).toBe(201);
      ids.push((res.json() as { id: number }).id);
    }
    const cover = png();
    const put = await t.inject({
      method: "PUT",
      url: `/api/books/${ids[0]}/cover`,
      headers: { "content-type": "image/png" },
      payload: cover,
    });
    expect(put.statusCode).toBe(200);

    const before = leftovers().length;
    const res = await t.inject({ method: "GET", url: "/api/backup" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toBe(`attachment; filename="${backupFileName()}"`);
    expect(backupFileName(new Date(2026, 9, 5))).toBe("shelfmark-2026-10-05.db");

    dir = await mkdtemp(join(tmpdir(), "shelfmark-copy-test-"));
    const path = join(dir, "copy.db");
    await writeFile(path, res.rawPayload);
    const copy = new Database(path, { readonly: true });
    try {
      const books = copy.prepare("SELECT id, title FROM books ORDER BY id").all() as { id: number; title: string }[];
      expect(books).toEqual([
        { id: ids[0], title: "Orbitor" },
        { id: ids[1], title: "Ș și Ț" },
      ]);
      const tables = copy.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%cover%'").all() as { name: string }[];
      const stored = tables.flatMap(({ name }) => copy.prepare(`SELECT * FROM ${name}`).all() as Record<string, unknown>[]);
      expect(stored.some((row) => Object.values(row).some((v) => Buffer.isBuffer(v) && v.equals(cover)))).toBe(true);
    } finally {
      copy.close();
    }
    // The stream closes after the response is built; give the removal a tick.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(leftovers().length).toBe(before);
  });
});
