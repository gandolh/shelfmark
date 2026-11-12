import { coverInfoSchema } from "@shelfmark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../../db/open.js";
import { errorBody } from "../../lib/api-error.js";
import { imageBytes } from "../../testing/fakeFetch.js";
import { serializationFailure, serialize } from "../../testing/serialize.js";
import { createBookStore } from "../books/index.js";
import { errorBodySchema } from "./schemas.js";
import { createCoverStore } from "./store.js";

let db: Db;

beforeEach(() => {
  db = openDb(":memory:");
});

afterEach(() => {
  db.close();
});

/** What `PUT` and `POST …/fetch` send: the stored cover's facts, from a real row. */
function stored() {
  const book = createBookStore(db).create({ title: "A" });
  return createCoverStore(db).put(book.id, {
    mime: "image/png",
    bytes: imageBytes("image/png", 300),
    source: "upload",
  });
}

describe("the cover replies through their response schemas", () => {
  it("send the stored cover's facts byte for byte as before", () => {
    const info = stored();
    expect(info.size).toBe(300);
    expect(serialize(coverInfoSchema, info)).toBe(JSON.stringify(info));
  });

  it("strip a field it doesn't declare, and refuse a value out of shape", () => {
    const info = stored();
    expect(JSON.parse(serialize(coverInfoSchema, { ...info, bytes: "x" }))).toEqual(info);
    expect(serializationFailure(coverInfoSchema, { ...info, mime: "image/gif" })).toBeTruthy();
    expect(serializationFailure(coverInfoSchema, { ...info, size: 0 })).toBeTruthy();
    expect(serializationFailure(coverInfoSchema, { ...info, source: "scanner" })).toBeTruthy();
  });

  it("send the 415's error body as the error plugin builds it", () => {
    const body = errorBody("validation", "A cover is sent as the raw image: image/jpeg, image/png, image/webp.");
    expect(serialize(errorBodySchema, body)).toBe(JSON.stringify(body));
    expect(serializationFailure(errorBodySchema, { error: "Unsupported Media Type" })).toBeTruthy();
  });
});
