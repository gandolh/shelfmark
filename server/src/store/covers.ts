import type { CoverInfo, CoverMime, CoverSource } from "@shelfmark/shared";
import type { Db } from "../db/open.js";

/**
 * The covers store: the only module that runs SQL on `covers`. One image per
 * book, as a BLOB (decisions.md: covers live in SQLite); deleting the book
 * deletes it (cascade). A row here is what makes `Book.hasCover` true.
 */

export interface StoredCover {
  mime: CoverMime;
  bytes: Buffer;
  source: CoverSource;
  /** UTC ISO timestamp. */
  updatedAt: string;
}

export interface CoverStore {
  get(bookId: number): StoredCover | undefined;
  /** Stores the book's cover, replacing any before. The book must exist (a foreign key). */
  put(bookId: number, cover: { mime: CoverMime; bytes: Buffer; source: CoverSource }): CoverInfo;
  /** `false` when the book had no cover. */
  remove(bookId: number): boolean;
}

export function createCoverStore(db: Db, now: () => Date = () => new Date()): CoverStore {
  const select = db.prepare<[number], StoredCover>(
    "SELECT mime, bytes, source, updated_at AS updatedAt FROM covers WHERE book_id = ?",
  );
  const upsert = db.prepare<[number, string, Buffer, string, string]>(`
    INSERT INTO covers (book_id, mime, bytes, source, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (book_id) DO UPDATE
      SET mime = excluded.mime, bytes = excluded.bytes, source = excluded.source, updated_at = excluded.updated_at`);
  const remove = db.prepare<[number]>("DELETE FROM covers WHERE book_id = ?");

  return {
    get: (bookId) => select.get(bookId),
    put(bookId, { mime, bytes, source }) {
      const updatedAt = now().toISOString();
      upsert.run(bookId, mime, bytes, source, updatedAt);
      return { mime, size: bytes.length, source, updatedAt };
    },
    remove: (bookId) => remove.run(bookId).changes > 0,
  };
}
