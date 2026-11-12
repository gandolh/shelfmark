import { ResponseSerializationError, serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { bookCreateSchema } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { mapError } from "./errors.js";

const internal = { error: { code: "internal", message: "Something went wrong on the server." } };

/** The error Fastify raises when a request fails its route schema: the provider's issues in `validation`. */
function schemaFailure(schema: z.ZodType, value: unknown): Error {
  const validate = validatorCompiler({ schema, method: "POST", url: "/api/x", httpStatus: "" });
  const result = validate(value);
  if (typeof result !== "object" || result === null || !("error" in result) || !Array.isArray(result.error)) {
    throw new Error("expected the value to fail the schema");
  }
  return Object.assign(new Error("body must be valid"), { validation: result.error, validationContext: "body" });
}

describe("mapError", () => {
  it("answers an ApiError with its code's status and message", () => {
    expect(mapError(new ApiError("conflict", "There is already a view called “A”."))).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: "There is already a view called “A”." } },
    });
    expect(mapError(new ApiError("upstream", "The cover host answered 500.")).status).toBe(502);
  });

  it("answers a request that fails its schema with 400 and the first issue's field and message", () => {
    expect(mapError(schemaFailure(bookCreateSchema, { title: "x", rating: 9 }))).toEqual({
      status: 400,
      body: { error: { code: "validation", message: "rating: must be 1 to 5" } },
    });
    // A nested path reads with dots, and a root issue has no field.
    expect(
      mapError(schemaFailure(z.object({ ids: z.array(z.number()) }), { ids: [1, "x"] })).body.error.message,
    ).toMatch(/^ids\.1: /);
    expect(mapError(schemaFailure(z.object({}), "nope")).body.error.message).toBe(
      "Invalid input: expected object, received string",
    );
  });

  it("answers a zod error thrown from a service with 400 and the first issue", () => {
    const parsed = z.object({ name: z.string() }).safeParse({ name: 1 });
    if (parsed.success) throw new Error("expected a failure");
    expect(mapError(parsed.error)).toEqual({
      status: 400,
      body: { error: { code: "validation", message: "name: Invalid input: expected string, received number" } },
    });
  });

  it("keeps the status of a 4xx Fastify raised, as not_found for 404 and validation for the rest", () => {
    expect(mapError(Object.assign(new Error("Body is not valid JSON"), { statusCode: 400 }))).toEqual({
      status: 400,
      body: { error: { code: "validation", message: "Body is not valid JSON" } },
    });
    expect(mapError(Object.assign(new Error("Request body is too large"), { statusCode: 413 })).status).toBe(413);
    expect(mapError(Object.assign(new Error("gone"), { statusCode: 404 })).body.error.code).toBe("not_found");
  });

  it("answers a reply that fails its response schema with a fixed 500, flagged as the reply's fault", () => {
    const serialize = serializerCompiler({
      schema: z.object({ id: z.number() }),
      method: "GET",
      url: "/api/x",
      httpStatus: "200",
    });
    let failure: unknown;
    try {
      serialize({ id: "not a number" });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ResponseSerializationError);
    expect(mapError(failure)).toEqual({ status: 500, body: internal, fault: "reply" });
  });

  it("answers anything else with a fixed 500 that never echoes the thrown message", () => {
    const mapped = mapError(new Error("SQLITE_CORRUPT: database disk image is malformed"));
    expect(mapped).toEqual({ status: 500, body: internal, fault: "unhandled" });
    expect(JSON.stringify(mapped)).not.toContain("SQLITE");
    expect(mapError("a string")).toEqual({ status: 500, body: internal, fault: "unhandled" });
    // Not a reply fault: an error that only has a `method` property (the provider's own check would say it is).
    expect(mapError(Object.assign(new Error("boom"), { method: "GET", url: "/x" }))).toEqual({
      status: 500,
      body: internal,
      fault: "unhandled",
    });
    // A 5xx a library raised is a 500 here too, not its own message.
    expect(mapError(Object.assign(new Error("secret detail"), { statusCode: 503 })).body).toEqual(internal);
  });
});
