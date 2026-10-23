import { z } from "zod";
import { collectionSchema } from "./book.js";

/**
 * Saved views (brief 27): the Library's filters, sort, shown columns and
 * collection tab under a name, kept on the server so they follow the owner
 * from the desktop to the phone. These schemas are the API's contract; the
 * server's store keeps the state as JSON in `saved_views.state`
 * (corpus/wiki/data-model.md).
 *
 * A state is checked strictly on the way in (`savedViewStateSchema`: every
 * column known, every filter well formed) and read leniently on the way out
 * (`readSavedViewState`): a column a later version took away is dropped from
 * the columns, the sort and the filters instead of failing the whole view.
 */

/**
 * The Library's columns, in the table's default order: one per book field
 * the table can show (web/src/library/columns.ts defines each). Here so the
 * server can tell a known column from one that no longer exists.
 */
export const LIBRARY_COLUMN_IDS = [
  "book",
  "authors",
  "subtitle",
  "publisher",
  "year",
  "shelf",
  "status",
  "added",
  "isbn",
  "barcode",
  "pages",
  "language",
  "series",
  "seriesNumber",
  "description",
  "subjects",
  "format",
  "condition",
  "signed",
  "rating",
  "tags",
  "notes",
  "acquiredOn",
  "acquiredFrom",
  "price",
  "currency",
  "cover",
  "source",
  "changed",
] as const;

export const libraryColumnIdSchema = z.enum(LIBRARY_COLUMN_IDS);
export type LibraryColumnId = z.infer<typeof libraryColumnIdSchema>;

/** The book column (cover, title, author) leads the table and is always shown, so a view never lists it. */
export const BOOK_COLUMN: LibraryColumnId = "book";

const KNOWN_COLUMNS: ReadonlySet<string> = new Set(LIBRARY_COLUMN_IDS);

export function isLibraryColumnId(id: unknown): id is LibraryColumnId {
  return typeof id === "string" && KNOWN_COLUMNS.has(id);
}

// --- Filters --------------------------------------------------------------------------

export const TEXT_OPS = ["contains", "empty", "notEmpty"] as const;
export type TextOp = (typeof TEXT_OPS)[number];

const FILTER_TEXT_MAX = 500;
const PICK_VALUES_MAX = 500;

/**
 * One column's filter, by the column's kind (corpus/wiki/library-table.md).
 * The web app's `Filter` is this type. Whether the kind fits the column is
 * the web app's to judge (a filter for another kind of column narrows
 * nothing there), so the server checks the shape only.
 */
export const savedFilterSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), op: z.enum(TEXT_OPS), text: z.string().max(FILTER_TEXT_MAX) }),
  /** `""` stands for the books with no value ("No shelf"). */
  z.strictObject({ kind: z.literal("pick"), values: z.array(z.string().max(FILTER_TEXT_MAX)).max(PICK_VALUES_MAX).readonly() }),
  /** In the column's stored units (a price in bani). */
  z.strictObject({ kind: z.literal("number"), min: z.number().nullable(), max: z.number().nullable() }),
  /** Calendar days, both ends included. */
  z.strictObject({ kind: z.literal("date"), from: z.iso.date().nullable(), to: z.iso.date().nullable() }),
  z.strictObject({ kind: z.literal("yesno"), value: z.boolean() }),
]);
export type SavedFilter = z.infer<typeof savedFilterSchema>;

export const savedSortKeySchema = z.strictObject({ id: libraryColumnIdSchema, desc: z.boolean() });
export type SavedSortKey = z.infer<typeof savedSortKeySchema>;

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * What a view holds: the collection tab, the active filters by column, the
 * sort keys in order, and the shown columns in the table's order (the book
 * column left out: it is always first). Not the search text, the Table /
 * Covers switch or the column widths, which stay the device's.
 */
export const savedViewStateSchema = z.strictObject({
  collection: collectionSchema,
  filters: z.partialRecord(libraryColumnIdSchema, savedFilterSchema),
  sorting: z
    .array(savedSortKeySchema)
    .max(LIBRARY_COLUMN_IDS.length)
    .readonly()
    .refine((keys) => unique(keys.map((key) => key.id)), { message: "sorts by a column twice" }),
  columns: z
    .array(libraryColumnIdSchema)
    .max(LIBRARY_COLUMN_IDS.length)
    .readonly()
    .refine(unique, { message: "lists a column twice" })
    .refine((ids) => !ids.includes(BOOK_COLUMN), { message: "the book column is always shown; leave it out" }),
});
export type SavedViewState = z.infer<typeof savedViewStateSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A stored state, read field by field: a column that no longer exists is
 * dropped (from the columns, the sort and the filters), and so is anything
 * else that doesn't read, so an old view still opens. Never throws.
 */
export function readSavedViewState(value: unknown): SavedViewState {
  const stored = isRecord(value) ? value : {};

  const collection = collectionSchema.safeParse(stored.collection);

  const filters: Partial<Record<LibraryColumnId, SavedFilter>> = {};
  if (isRecord(stored.filters)) {
    for (const [id, raw] of Object.entries(stored.filters)) {
      const filter = savedFilterSchema.safeParse(raw);
      if (isLibraryColumnId(id) && filter.success) filters[id] = filter.data;
    }
  }

  const sorting: SavedSortKey[] = [];
  for (const raw of Array.isArray(stored.sorting) ? stored.sorting : []) {
    const key = savedSortKeySchema.safeParse(raw);
    if (key.success && !sorting.some((other) => other.id === key.data.id)) sorting.push(key.data);
  }

  const columns: LibraryColumnId[] = [];
  for (const id of Array.isArray(stored.columns) ? stored.columns : []) {
    if (isLibraryColumnId(id) && id !== BOOK_COLUMN && !columns.includes(id)) columns.push(id);
  }

  return { collection: collection.success ? collection.data : "owned", filters, sorting, columns };
}

// --- Views ------------------------------------------------------------------------------

const VIEW_NAME_MAX = 80;

/** Trimmed, in NFC, so "Unread " and "Unread" are one name. Two views can't share one, whatever its case. */
export const viewNameSchema = z
  .string({ error: "a view needs a name" })
  .trim()
  .min(1, { message: "a view needs a name" })
  .max(VIEW_NAME_MAX, { message: `keep the name to ${VIEW_NAME_MAX} characters` })
  .transform((name) => name.normalize("NFC"));

/** A view as the API returns it. Its state is read leniently (`readSavedViewState`). */
export const savedViewSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  state: z.unknown().transform(readSavedViewState),
  /** Its place in the Views menu, from 0. */
  position: z.number().int().min(0),
  /** UTC ISO timestamps, set by the server. */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SavedView = z.infer<typeof savedViewSchema>;

/** `GET /api/views`: every view, by position. */
export const savedViewListSchema = z.object({ views: z.array(savedViewSchema) });
export type SavedViewList = z.infer<typeof savedViewListSchema>;

/** `POST /api/views`: a new view goes last in the menu. */
export const savedViewCreateSchema = z.strictObject({ name: viewNameSchema, state: savedViewStateSchema });
export type SavedViewCreate = z.infer<typeof savedViewCreateSchema>;

/**
 * `PATCH /api/views/:id`: rename, overwrite with the current state, or move
 * to a place in the menu (from 0; past the end is the end). Any of the three;
 * a missing one is left as it is.
 */
export const savedViewPatchSchema = z.strictObject({
  name: viewNameSchema.optional(),
  state: savedViewStateSchema.optional(),
  position: z.number().int().min(0).optional(),
});
export type SavedViewPatch = z.infer<typeof savedViewPatchSchema>;
