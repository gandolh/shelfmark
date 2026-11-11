import { RECOMMENDATIONS_MAX, recommendationImportSchema, type RecommendationImport } from "@shelfmark/shared";

/**
 * The prompt for Claude (brief 04, step 2): what the attached file is, what to
 * return, the schema, and the warning that titles must be real books. It
 * leaves out everything about the library but the file the owner attaches.
 */
export const IMPORT_SCHEMA_EXAMPLE = `[
  { "title": "Orbitor", "authors": ["Mircea Cărtărescu"], "isbn13": "9789735050000", "reason": "One line on why it fits." }
]`;

export const CLAUDE_PROMPT = `The attached CSV file is my home library: one row per book, with its collection (owned or wishlist), my rating and status.

Suggest up to ${RECOMMENDATIONS_MAX} books I do not have yet, in Romanian or English, that fit what I own and rate highly. Skip every book in the file, in any language or translation.

Every title must be a real, published book. Do not invent titles or authors; leave a book out when you are not sure it exists. Give an ISBN-13 only when you are certain of it.

Reply with only a JSON array and nothing else, in this shape. "isbn13" is optional, "reason" is one line:

${IMPORT_SCHEMA_EXAMPLE}`;

/** The text of a paste or a file, parsed and checked, or a message for the owner. Changes nothing. */
export function readImportText(
  text: string,
): { ok: true; picks: RecommendationImport } | { ok: false; message: string } {
  // A chat answer often wraps the JSON in a fenced block.
  const body = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (body === "") return { ok: false, message: "Paste the JSON Claude returned, or choose the file." };
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    return { ok: false, message: "That is not valid JSON. Paste only the array Claude returned, starting with [." };
  }
  const result = recommendationImportSchema.safeParse(value);
  if (result.success) return { ok: true, picks: result.data };
  const issue = result.error.issues[0];
  const where = issue && issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
  return { ok: false, message: `The JSON is not in the expected shape${where}: ${issue?.message ?? "invalid"}.` };
}
