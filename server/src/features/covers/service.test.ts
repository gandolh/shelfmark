import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api-error.js";
import {
  fakeFetch,
  hang,
  image,
  imageBytes,
  RECORDED_COVER,
  recordedInternet,
  redirect,
} from "../../testing/fakeFetch.js";
import { checkCoverUrl, downloadCover, sniffImage } from "./service.js";

/** The ApiError a call throws, or a failed test when it throws nothing else. */
async function refusal(run: () => unknown): Promise<ApiError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected an ApiError");
}

describe("sniffImage", () => {
  it("names JPEG, PNG and WebP by their first bytes, whatever the file claims", () => {
    expect(sniffImage(imageBytes("image/jpeg"))).toBe("image/jpeg");
    expect(sniffImage(imageBytes("image/png"))).toBe("image/png");
    expect(sniffImage(imageBytes("image/webp"))).toBe("image/webp");
  });

  it("refuses everything else, an empty body included", () => {
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    // A RIFF container that is not WebP.
    expect(sniffImage(Buffer.from("RIFF\0\0\0\0WAVE"))).toBeNull();
  });
});

describe("checkCoverUrl", () => {
  it("lets an https URL on a cover host through", () => {
    expect(checkCoverUrl("https://covers.openlibrary.org/b/id/1-L.jpg", { redirect: false }).hostname).toBe(
      "covers.openlibrary.org",
    );
    expect(checkCoverUrl("https://books.google.com/books/content?id=x", { redirect: false }).hostname).toBe(
      "books.google.com",
    );
  });

  it("refuses a URL that is not one, a scheme but https, user info and a port", async () => {
    expect((await refusal(() => checkCoverUrl("not a url", { redirect: false }))).message).toBe(
      "url: this is not a URL.",
    );
    expect(
      (await refusal(() => checkCoverUrl("http://covers.openlibrary.org/x.jpg", { redirect: false }))).message,
    ).toBe("url: a cover URL must be https.");
    expect(
      (await refusal(() => checkCoverUrl("https://user:pw@covers.openlibrary.org/x.jpg", { redirect: false }))).message,
    ).toBe("url: a cover URL can't carry a user name or password.");
    expect(
      (await refusal(() => checkCoverUrl("https://covers.openlibrary.org:8443/x.jpg", { redirect: false }))).message,
    ).toBe("url: a cover URL can't name a port.");
  });

  it("refuses a host that is not a cover host, `constructor` and the loopback included", async () => {
    for (const host of ["evil.example", "constructor", "127.0.0.1", "covers.openlibrary.org.evil.example"]) {
      const error = await refusal(() => checkCoverUrl(`https://${host}/x.jpg`, { redirect: false }));
      expect(error.code).toBe("validation");
      expect(error.message).toContain("is not a cover host");
    }
  });

  it("lets a redirect reach the Internet Archive, and nothing else new", async () => {
    expect(checkCoverUrl("https://archive.org/download/x.jpg", { redirect: true }).hostname).toBe("archive.org");
    expect(checkCoverUrl("https://ia600100.us.archive.org/x.jpg", { redirect: true }).hostname).toBe(
      "ia600100.us.archive.org",
    );
    // The archive is a redirect target only: a candidate URL on it is refused.
    expect((await refusal(() => checkCoverUrl("https://archive.org/x.jpg", { redirect: false }))).message).toContain(
      "is not a cover host",
    );
    expect((await refusal(() => checkCoverUrl("https://evil.example/x.jpg", { redirect: true }))).message).toBe(
      "url: the cover redirected to evil.example, which is not a cover host.",
    );
    expect((await refusal(() => checkCoverUrl("http://archive.org/x.jpg", { redirect: true }))).message).toBe(
      "url: the cover redirected to http, not https.",
    );
  });
});

describe("downloadCover", () => {
  it("follows Open Library's two redirects to the image and names the host's source", async () => {
    const fetch = fakeFetch(recordedInternet);
    const cover = await downloadCover("https://covers.openlibrary.org/b/id/777-L.jpg", { fetch });
    expect(cover.source).toBe("openlibrary");
    expect(cover.mime).toBe("image/jpeg");
    expect(cover.bytes.equals(RECORDED_COVER)).toBe(true);
    expect(fetch.calls.map((call) => call.url.hostname)).toEqual([
      "covers.openlibrary.org",
      "archive.org",
      "ia600100.us.archive.org",
    ]);
    // Every hop is manual, so the guard sees each target, and each sends the polite User-Agent.
    expect(fetch.calls.every((call) => call.redirect === "manual")).toBe(true);
    expect(fetch.calls.every((call) => call.headers.has("user-agent"))).toBe(true);
  });

  it("reads a Google cover directly, with the type its bytes say", async () => {
    const fetch = fakeFetch(() => image(imageBytes("image/png", 300), "image/jpeg"));
    const cover = await downloadCover("https://books.google.com/books/content?id=x", { fetch });
    expect(cover).toMatchObject({ source: "googlebooks", mime: "image/png" });
  });

  it("refuses a candidate off the allowlist before any request", async () => {
    const fetch = fakeFetch(recordedInternet);
    expect((await refusal(() => downloadCover("https://evil.example/x.jpg", { fetch }))).code).toBe("validation");
    expect(fetch.calls).toHaveLength(0);
  });

  it("refuses a redirect to a host that is not allowed, and stops there", async () => {
    const fetch = fakeFetch(() => redirect("https://evil.example/x.jpg"));
    const error = await refusal(() => downloadCover("https://covers.openlibrary.org/b/id/1-L.jpg", { fetch }));
    expect(error.message).toBe("url: the cover redirected to evil.example, which is not a cover host.");
    expect(fetch.calls).toHaveLength(1);
  });

  it("answers 502 upstream for a redirect loop, a redirect with no place to go and a non-2xx", async () => {
    const loop = fakeFetch(() => redirect("https://covers.openlibrary.org/b/id/1-L.jpg"));
    expect(
      (await refusal(() => downloadCover("https://covers.openlibrary.org/b/id/1-L.jpg", { fetch: loop }))).message,
    ).toBe("The cover host redirected too many times.");
    expect(loop.calls).toHaveLength(6);

    const nowhere = fakeFetch(() => new Response(null, { status: 302 }));
    expect(
      (await refusal(() => downloadCover("https://covers.openlibrary.org/b/id/1-L.jpg", { fetch: nowhere }))).code,
    ).toBe("upstream");

    const missing = fakeFetch(() => new Response("no", { status: 404 }));
    const error = await refusal(() => downloadCover("https://covers.openlibrary.org/b/id/1-L.jpg", { fetch: missing }));
    expect(error).toMatchObject({ code: "upstream", message: "The cover host answered 404." });
  });

  it("refuses bytes that are not an image, and an image over the limit, as 400", async () => {
    const html = fakeFetch(() => new Response("<html></html>", { headers: { "content-type": "image/jpeg" } }));
    expect((await refusal(() => downloadCover("https://books.google.com/x", { fetch: html }))).message).toBe(
      "url: this is not a JPEG, PNG or WebP image.",
    );

    const declared = fakeFetch(() => image(imageBytes("image/jpeg", 600)));
    expect(
      (await refusal(() => downloadCover("https://books.google.com/x", { fetch: declared, maxBytes: 500 }))).message,
    ).toBe("url: the image is larger than 2 MB.");

    // No content-length: the body is counted as it is read.
    const streamed = fakeFetch(() => new Response(new Uint8Array(imageBytes("image/jpeg", 600))));
    expect(
      (await refusal(() => downloadCover("https://books.google.com/x", { fetch: streamed, maxBytes: 500 }))).code,
    ).toBe("validation");
  });

  it("answers 502 when the host hangs past the time limit, and when the request fails", async () => {
    const slow = fakeFetch((_url, init) => hang(init));
    expect(
      (await refusal(() => downloadCover("https://books.google.com/x", { fetch: slow, timeoutMs: 20 }))).message,
    ).toBe("The cover host did not answer within 0.02 s.");

    const refused = fakeFetch(() => undefined);
    expect((await refusal(() => downloadCover("https://books.google.com/x", { fetch: refused }))).message).toBe(
      "The cover could not be downloaded.",
    );
  });
});
