import { z } from "zod";

// Only the server uses this schema, so it lives with the feature, not in shared/.

/**
 * The error body `{ error: { code, message } }` (`lib/api-error.ts`), declared for the one status the
 * cover `PUT` sends by hand: 415, for a body that isn't a JPEG, PNG or WebP by its content type. A declared
 * status encodes every reply on it, Fastify's own 415 included, which the error plugin gives this same body.
 */
export const errorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
