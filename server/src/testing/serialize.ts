import { ResponseSerializationError, serializerCompiler } from "@fastify/type-provider-zod";
import type { z } from "zod";

/** A reply through its response schema, as Fastify serialises it once the route declares it. */
export function serialize(schema: z.ZodType, body: unknown): string {
  return serializerCompiler({ schema, method: "GET", url: "/api/test", httpStatus: "200" })(body);
}

/** The error serialising throws for a body the schema doesn't allow: a 500 once on a route. */
export function serializationFailure(schema: z.ZodType, body: unknown): ResponseSerializationError {
  try {
    serialize(schema, body);
  } catch (error) {
    if (error instanceof ResponseSerializationError) return error;
    throw error;
  }
  throw new Error("expected the body to fail its response schema");
}
