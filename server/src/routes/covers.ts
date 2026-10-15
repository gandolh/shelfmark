import { createHash } from "node:crypto";
import {
  COVER_MAX_BYTES,
  COVER_MIME_TYPES,
  coverFetchRequestSchema,
  type CoverInfo,
  type CoverMime,
  type CoverSource,
} from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { ApiError, errorBody } from "../errors.js";
import { USER_AGENT } from "../lookup/openlibrary.js";
import { createCoverStore } from "../store/covers.js";

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

/** The image type the bytes start with; `null` for anything but JPEG, PNG or WebP. */
export function sniffImage(bytes: Uint8Array): CoverMime | null {
  const starts = (offset: number, ...values: number[]) => values.every((value, i) => bytes[offset + i] === value);
  if (starts(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0, 0x52, 0x49, 0x46, 0x46) && starts(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

// The SSRF guard. A candidate URL must be https on one of the cover hosts, on
// the default port, with no user info; so must every redirect, except that
// Open Library's covers are served by the Internet Archive:
// covers.openlibrary.org answers 302 to archive.org, which answers 302 to an
// iaNNNNNN.us.archive.org node (seen 2026-10-15). Those are allowed as
// redirect targets only. The hosts are a Map, not an object: `"constructor"
// in {}` is true, and `constructor` is a valid hostname.
export const COVER_HOSTS: ReadonlyMap<string, Exclude<CoverSource, "upload">> = new Map([
  ["covers.openlibrary.org", "openlibrary"],
  ["books.google.com", "googlebooks"],
  ["books.googleusercontent.com", "googlebooks"],
]);
const ARCHIVE_HOST = /^(archive\.org|ia\d+\.us\.archive\.org)$/;
const MAX_REDIRECTS = 5;
export const COVER_TIMEOUT_MS = 10_000;

const refused = (message: string) => new ApiError("validation", `url: ${message}`);

/** The URL if the guard lets it through; a 400 `validation` otherwise. */
export function checkCoverUrl(raw: string | URL, { redirect }: { redirect: boolean }): URL {
  if (typeof raw === "string" && !URL.canParse(raw)) throw refused("this is not a URL.");
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    const scheme = url.protocol.replace(":", "");
    throw refused(redirect ? `the cover redirected to ${scheme}, not https.` : "a cover URL must be https.");
  }
  if (url.username !== "" || url.password !== "") throw refused("a cover URL can't carry a user name or password.");
  if (url.port !== "") throw refused("a cover URL can't name a port.");
  const allowed = COVER_HOSTS.has(url.hostname) || (redirect && ARCHIVE_HOST.test(url.hostname));
  if (!allowed) {
    throw refused(
      redirect
        ? `the cover redirected to ${url.hostname}, which is not a cover host.`
        : `${url.hostname} is not a cover host. Allowed: ${[...COVER_HOSTS.keys()].join(", ")}.`,
    );
  }
  return url;
}

const tooLarge = () => new ApiError("validation", "url: the image is larger than 2 MB.");

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? Number.NaN);
  if (declared > maxBytes) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export interface DownloadOptions {
  fetch: typeof globalThis.fetch;
  /** The whole download, redirects and body included. Default 10 s. */
  timeoutMs?: number;
  maxBytes?: number;
}

export interface DownloadedCover {
  mime: CoverMime;
  bytes: Buffer;
  source: Exclude<CoverSource, "upload">;
}

/**
 * Download a cover candidate through the guard. A URL the guard refuses, an
 * image over 2 MB, or something that isn't a JPEG, PNG or WebP is a 400
 * `validation`; a host that fails, answers non-2xx or takes more than 10 s is
 * a 502 `upstream`.
 */
export async function downloadCover(raw: string, options: DownloadOptions): Promise<DownloadedCover> {
  const { fetch, timeoutMs = COVER_TIMEOUT_MS, maxBytes = COVER_MAX_BYTES } = options;
  let url = checkCoverUrl(raw, { redirect: false });
  const source = COVER_HOSTS.get(url.hostname)!;
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = { "User-Agent": USER_AGENT, Accept: COVER_MIME_TYPES.join(", ") };

  try {
    for (let redirects = 0; ; redirects++) {
      const response = await fetch(url, { redirect: "manual", signal, headers });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (location === null) throw new ApiError("upstream", "The cover host redirected without a location.");
        if (redirects === MAX_REDIRECTS) throw new ApiError("upstream", "The cover host redirected too many times.");
        url = checkCoverUrl(new URL(location, url), { redirect: true });
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError("upstream", `The cover host answered ${response.status}.`);
      }
      const bytes = await readCapped(response, maxBytes);
      const mime = sniffImage(bytes);
      if (!mime) throw new ApiError("validation", "url: this is not a JPEG, PNG or WebP image.");
      return { mime, bytes, source };
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted) throw new ApiError("upstream", `The cover host did not answer within ${timeoutMs / 1000} s.`);
    throw new ApiError("upstream", "The cover could not be downloaded.");
  }
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

/**
 * The cover routes (brief 05). `PUT` takes the raw image; `POST …/fetch`
 * downloads a draft's candidate; both answer `CoverInfo`. `GET` serves the
 * bytes with an `ETag` and a day of private caching, so a client that
 * replaces a cover adds `?v=<updatedAt>` to the image URL.
 */
export const coverRoutes: FastifyPluginAsync<FeatureContext> = async (app, { db, books, fetch }) => {
  const covers = createCoverStore(db);

  // Scoped to this plugin: any body that isn't JSON arrives as raw bytes (2 MB
  // at most), so the PUT handler can answer every wrong type the same way.
  // Fastify's own text/plain parser would 400 on binary bytes first.
  app.removeContentTypeParser("text/plain");
  app.addContentTypeParser("*",{ parseAs: "buffer", bodyLimit: COVER_MAX_BYTES }, (_request, body, done) => {
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
    const declared = (request.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
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
    return covers.put(id, cover);
  });

  app.delete<IdParams>("/api/books/:id/cover", (request, reply) => {
    const id = bookId(request.params.id);
    if (!covers.remove(id)) throw books.get(id) ? noCover() : noSuchBook();
    return reply.code(204).send();
  });
};
