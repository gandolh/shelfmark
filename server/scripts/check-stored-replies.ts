/**
 * Runs every stored row through the response schemas the server now sends it through, and prints the ones that
 * would answer 500 (a time that isn't ISO, a rating out of range, an ISBN that doesn't match): the library
 * and the saved views and recommendations. Read-only on your file: it works on a copy in a temporary folder.
 *
 *     npx tsx server/scripts/check-stored-replies.ts <a downloaded backup of shelfmark.db>
 *
 * It prints each failing row's id and the field and the rule that failed, never the value. Exit 0: no row fails.
 */
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookSchema, recommendationSchema } from "@shelfmark/shared";
import { z } from "zod";
import { openDb } from "../src/db/open.js";
import { createBookStore } from "../src/features/books/index.js";
import { createRecommendationStore } from "../src/features/recommendations/store.js";
import { savedViewOutputSchema } from "../src/features/views/schemas.js";
import { createViewStore } from "../src/features/views/store.js";

const source = process.argv[2];
if (source === undefined) {
  console.error("Usage: npx tsx server/scripts/check-stored-replies.ts <a downloaded backup of shelfmark.db>");
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), "shelfmark-check-"));
const copy = join(dir, "shelfmark.db");
copyFileSync(source, copy);
const db = openDb(copy);

let failures = 0;
function check(kind: string, schema: z.ZodType, rows: readonly { id: number | string }[]): void {
  let bad = 0;
  for (const row of rows) {
    const result = z.safeEncode(schema, row);
    if (result.success) continue;
    bad++;
    const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "(row)"}: ${issue.message}`);
    console.log(`${kind} ${row.id}: ${issues.join("; ")}`);
  }
  failures += bad;
  console.log(`${kind}: ${rows.length} checked, ${bad} would answer 500`);
}

try {
  check("book", bookSchema, createBookStore(db).list());
  check("view", savedViewOutputSchema, createViewStore(db).list());
  check(
    "recommendation",
    recommendationSchema,
    createRecommendationStore(db)
      .list(1000)
      .map((row) => ({ ...row, id: row.key })),
  );
} finally {
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failures === 0 ? 0 : 1);
