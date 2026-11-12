import { z } from "zod";

// Only the server uses this schema, so it lives with the feature, not in shared/.

/** `:key` in `/api/recommendations/:key/dismiss`: a work's Open Library key or a title key, as one path segment. */
export const keyParamsSchema = z.object({ key: z.string() });
