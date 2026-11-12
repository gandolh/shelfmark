import { COVER_MAX_BYTES, COVER_MIME_TYPES, type CoverMime, type CoverSource } from "@shelfmark/shared";
import { ApiError } from "../../lib/api-error.js";
import { USER_AGENT } from "../../lookup/openlibrary.js";

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
  const source = COVER_HOSTS.get(url.hostname);
  if (!source) throw refused(`${url.hostname} is not a cover host.`);
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
