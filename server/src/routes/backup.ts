import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { ApiError } from "../errors.js";

/** `shelfmark-2026-10-15.db`, the server's local day. */
export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `shelfmark-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.db`;
}

/**
 * `GET /api/backup`: the whole database (books, covers, accounts, the lookup
 * cache) as one SQLite file. better-sqlite3's `backup()` copies a consistent
 * snapshot while the app keeps running, into a temporary file that is
 * streamed and then removed, however the download ends.
 */
export const backupRoutes: FastifyPluginAsync<FeatureContext> = async (app, { db }) => {
  app.get("/api/backup", async (_request, reply) => {
    const dir = await mkdtemp(join(tmpdir(), "shelfmark-backup-"));
    const file = join(dir, "backup.db");
    const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => undefined);
    try {
      await db.backup(file);
      const { size } = await stat(file);
      const stream = createReadStream(file);
      // `close` fires on finish, on error and when the client goes away.
      stream.once("close", () => void cleanup());
      return reply
        .header("Content-Type", "application/vnd.sqlite3")
        .header("Content-Length", size)
        .header("Content-Disposition", `attachment; filename="${backupFileName()}"`)
        .header("Cache-Control", "no-store")
        .send(stream);
    } catch {
      await cleanup();
      throw new ApiError("internal", "The backup could not be made. Try again.");
    }
  });
};
