import { describe, expect, it } from "vitest";
import { serializationFailure, serialize } from "../../testing/serialize.js";
import { healthSchema } from "./schemas.js";

describe("healthSchema", () => {
  it("sends { ok: true } and strips anything else", () => {
    expect(serialize(healthSchema, { ok: true })).toBe('{"ok":true}');
    expect(serialize(healthSchema, { ok: true, uptime: 12 })).toBe('{"ok":true}');
  });

  it("refuses a reply that says anything but ok", () => {
    expect(serializationFailure(healthSchema, { ok: false }).method).toBe("GET");
    expect(serializationFailure(healthSchema, {}).url).toBe("/api/test");
  });
});
