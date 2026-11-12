import { savedViewSchema, savedViewStateSchema } from "@shelfmark/shared";
import { z } from "zod";

// Only the server uses these two, so they live with the feature, not in shared/.

/**
 * A view as the server sends it: `savedViewSchema` with its state already read.
 * The web parses answers with `savedViewSchema`, whose `state` goes through
 * `.transform(readSavedViewState)`, and zod can't encode through a transform
 * (every reply would be a 500). The store reads the stored state on the way out
 * (`readSavedViewState`), so what is left to declare is the shape it returns.
 */
export const savedViewOutputSchema = savedViewSchema.extend({ state: savedViewStateSchema });

/** `GET /api/views`: every view, by position. */
export const savedViewListOutputSchema = z.object({ views: z.array(savedViewOutputSchema) });
