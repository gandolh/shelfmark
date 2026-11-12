import { z } from "zod";

// Only the server uses this schema, so it lives with the feature, not in shared/.
export const healthSchema = z.object({ ok: z.literal(true) });
