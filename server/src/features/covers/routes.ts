import { createHash } from "node:crypto";
import {
  COVER_MAX_BYTES,
  COVER_MIME_TYPES,
  coverFetchRequestSchema,
  type CoverInfo,
  type CoverMime,
} from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../../db/open.js";
import { ApiError, errorBody } from "../../lib/api-error.js";
import type { BookStore } from "../books/index.js";
import { downloadCover, sniffImage } from "./service.js";
import { createCoverStore } from "./store.js";

interface IdParams {
  Params: { id: string };
}

const noSuchBook = () => new ApiError("not_found", "There is no such book.");
const noCover = () => new ApiError("not_found", "This book has no cover.");

/** A positive integer in the path, or a 404, as in the book routes. */
function bookId(raw: string): number {
  const id = /^[1-9]\d{0,15}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id)) throw noSuchBook();
  return id;
}

function etagOf(bytes: Buffer): string {
  return `"${createHash("sha256").update(bytes).digest("base64url")}"`;
}

function matchesEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((tag) => {
    const value = tag.trim();
    return value === "*" || value.replace(/^W\//, "") === etag;
  });
}

const isCoverMime = (value: string): value is CoverMime => (COVER_MIME_TYPES as readonly string[]).includes(value);

/** What the cover routes take from the app. */
export interface CoverRoutesOptions {
  db: Db;
  /** Books go through this store: a cover belongs to a book that exists. */
  books: BookStore;
  /** Every outbound request: cover downloads. Tests pass a fake. */
  fetch: typeof globalThis.fetch;
}

/**
 * The cover routes. `PUT` takes the raw image; `POST …/fetch`
 * downloads a draft's candidate; both answer `CoverInfo`. `GET` serves the
 * bytes with an `ETag` and a day of private caching, so a client adds
 * `?v=<Book.coverUpdatedAt>` to the image URL (ignored here).
 */
export const coverRoutes: FastifyPluginAsync<CoverRoutesOptions> = async (app, { db, books, fetch }) => {
  const covers = createCoverStore(db);

  // Scoped to this plugin: any body that isn't JSON arrives as raw bytes (2 MB
  // at most), so the PUT handler can answer every wrong type the same way.
  // Fastify's own text/plain parser would 400 on binary bytes first.
  app.removeContentTypeParser("text/plain");
  app.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: COVER_MAX_BYTES }, (_request, body, done) => {
    done(null, body);
  });

  app.get<IdParams>("/api/books/:id/cover", (request, reply) => {
    const id = bookId(request.params.id);
    const cover = covers.get(id);
    if (!cover) throw books.get(id) ? noCover() : noSuchBook();
    const etag = etagOf(cover.bytes);
    reply
      .header("ETag", etag)
      .header("Cache-Control", "private, max-age=86400")
      .header("X-Content-Type-Options", "nosniff");
    if (matchesEtag(request.headers["if-none-match"], etag)) return reply.code(304).send();
    return reply.type(cover.mime).send(cover.bytes);
  });

  app.put<IdParams>("/api/books/:id/cover", (request, reply): CoverInfo | typeof reply => {
    const id = bookId(request.params.id);
    const declared = (request.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!isCoverMime(declared) || !Buffer.isBuffer(request.body)) {
      return reply
        .code(415)
        .send(errorBody("validation", `A cover is sent as the raw image: ${COVER_MIME_TYPES.join(", ")}.`));
    }
    if (!books.get(id)) throw noSuchBook();
    const mime = sniffImage(request.body);
    if (!mime) throw new ApiError("validation", "The body is not a JPEG, PNG or WebP image.");
    // The bytes decide the stored type: a PNG sent as image/jpeg is served as a PNG.
    return covers.put(id, { mime, bytes: request.body, source: "upload" });
  });

  app.post<IdParams>("/api/books/:id/cover/fetch", async (request): Promise<CoverInfo> => {
    const id = bookId(request.params.id);
    const { url } = coverFetchRequestSchema.parse(request.body);
    if (!books.get(id)) throw noSuchBook();
    const cover = await downloadCover(url, { fetch });
    // Again: the book may have been deleted during the download (up to 10 s),
    // and the insert would then fail its foreign key as a 500.
    if (!books.get(id)) throw noSuchBook();
    return covers.put(id, cover);
  });

  app.delete<IdParams>("/api/books/:id/cover", (request, reply) => {
    const id = bookId(request.params.id);
    if (!covers.remove(id)) throw books.get(id) ? noCover() : noSuchBook();
    return reply.code(204).send();
  });
};
