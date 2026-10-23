import {
  DEFAULT_CURRENCY,
  deriveAuthorSort,
  type Book,
  type BookBulkResult,
  type BookCreate,
  type BookPatch,
  type BulkChange,
  type Collection,
} from "@shelfmark/shared";
import type { Db } from "../db/open.js";

/**
 * The books store: the only module that runs SQL on `books`, `tags` and
 * `book_tags` (it reads `covers` only to say whether a book has one, and
 * since when). Other
 * features read books through it.
 *
 * Inputs are already parsed with the shared schemas; the store applies the
 * defaults, the tag rules and the author-sort rule, and sets the times.
 */
export interface BookStore {
  /** Every book, both collections, by id. One query for the books and one for all their tags. */
  list(): Book[];
  get(id: number): Book | undefined;
  create(input: BookCreate): Book;
  /** `undefined` when there is no such book. */
  patch(id: number, patch: BookPatch): Book | undefined;
  /** `false` when there is no such book. The cover and the book's tag links go with it (cascade). */
  remove(id: number): boolean;
  /** Every copy with this ISBN-13, owned and wishlist alike, by id. */
  findByIsbn(isbn13: string): Book[];
  /**
   * One change to many books, in one transaction (brief 26). `ids` are
   * distinct. When any of them names no book, nothing changes and the answer
   * is `{ unknown }`, those ids in order.
   */
  bulk(ids: readonly number[], change: BulkChange): { done: BookBulkResult } | { unknown: number[] };
}

/** The stored fields: everything in `Book` but the id, the tags, the cover's facts and the times. */
type BookFields = Omit<Book, "id" | "tags" | "hasCover" | "coverUpdatedAt" | "createdAt" | "updatedAt">;

/** Each field's column. Typed against `Book`, so a field the shared schema gains fails here until it has one. */
const COLUMNS: Record<keyof BookFields, string> = {
  isbn13: "isbn13",
  barcode: "barcode",
  title: "title",
  subtitle: "subtitle",
  authors: "authors",
  authorSort: "author_sort",
  publisher: "publisher",
  publishedYear: "published_year",
  pages: "pages",
  language: "language",
  series: "series",
  seriesNumber: "series_number",
  description: "description",
  subjects: "subjects",
  collection: "collection",
  format: "format",
  condition: "condition",
  shelf: "shelf",
  signed: "signed",
  status: "status",
  rating: "rating",
  notes: "notes",
  acquiredOn: "acquired_on",
  acquiredFrom: "acquired_from",
  priceMinor: "price_minor",
  currency: "currency",
  metadataSource: "metadata_source",
};

const FIELDS = Object.keys(COLUMNS) as (keyof BookFields)[];

/** What a field is when a create leaves it out, and what a patch's `null` turns it back into. */
const DEFAULTS: Omit<BookFields, "title"> = {
  isbn13: null,
  barcode: null,
  subtitle: null,
  authors: [],
  authorSort: null,
  publisher: null,
  publishedYear: null,
  pages: null,
  language: null,
  series: null,
  seriesNumber: null,
  description: null,
  subjects: [],
  collection: "owned",
  format: null,
  condition: null,
  shelf: null,
  signed: false,
  status: "unread",
  rating: null,
  notes: null,
  acquiredOn: null,
  acquiredFrom: null,
  priceMinor: null,
  currency: DEFAULT_CURRENCY,
  metadataSource: "manual",
};

/** A `books` row as the select below returns it: camelCase aliases, JSON and 0/1 still raw. */
type BookRow = Omit<Book, "authors" | "subjects" | "signed" | "hasCover" | "tags"> & {
  authors: string;
  subjects: string;
  signed: number;
  hasCover: number;
};

interface TagRow {
  bookId: number;
  name: string;
}

const SELECT_BOOKS = `
  SELECT b.id AS id, ${FIELDS.map((key) => `b.${COLUMNS[key]} AS ${key}`).join(", ")},
         b.created_at AS createdAt, b.updated_at AS updatedAt,
         c.book_id IS NOT NULL AS hasCover, c.updated_at AS coverUpdatedAt
  FROM books b LEFT JOIN covers c ON c.book_id = b.id`;

// book_tags.rowid is insertion order, which keeps a book's tags in the order they were given.
const SELECT_TAGS = `
  SELECT bt.book_id AS bookId, t.name AS name
  FROM book_tags bt JOIN tags t ON t.id = bt.tag_id`;

function toBook(row: BookRow, tags: string[]): Book {
  return {
    ...row,
    authors: JSON.parse(row.authors) as string[],
    subjects: JSON.parse(row.subjects) as string[],
    signed: row.signed === 1,
    hasCover: row.hasCover === 1,
    tags,
  };
}

function fieldsOf(book: Book): BookFields {
  return Object.fromEntries(FIELDS.map((key) => [key, book[key]])) as BookFields;
}

/** The named parameters for the insert and the update: JSON for lists, 0/1 for `signed`. */
function toParams(fields: BookFields): Record<string, unknown> {
  return {
    ...fields,
    authors: JSON.stringify(fields.authors),
    subjects: JSON.stringify(fields.subjects),
    signed: fields.signed ? 1 : 0,
  };
}

/** The fields a create or patch sets, with each `null` turned into the field's default. Tags are not fields. */
function settle(values: BookCreate | BookPatch): Partial<BookFields> {
  const out: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const value = values[key];
    if (value === undefined) continue;
    out[key] = value === null ? DEFAULTS[key as keyof typeof DEFAULTS] : value;
  }
  return out as Partial<BookFields>;
}

/**
 * Trimmed, de-duplicated case-insensitively (the first spelling wins), blanks
 * dropped. `key` is what tags match on; NFC so a composed and a decomposed "ș"
 * are one tag.
 */
function normalizeTags(tags: readonly string[]): { name: string; key: string }[] {
  const seen = new Map<string, string>();
  for (const raw of tags) {
    const name = raw.normalize("NFC").trim();
    const key = name.toLowerCase();
    if (name !== "" && !seen.has(key)) seen.set(key, name);
  }
  return [...seen].map(([key, name]) => ({ name, key }));
}

export function createBookStore(db: Db, now: () => Date = () => new Date()): BookStore {
  const listRows = db.prepare<[], BookRow>(`${SELECT_BOOKS} ORDER BY b.id`);
  const listTags = db.prepare<[], TagRow>(`${SELECT_TAGS} ORDER BY bt.rowid`);
  const getRow = db.prepare<[number], BookRow>(`${SELECT_BOOKS} WHERE b.id = ?`);
  const getTags = db.prepare<[number], TagRow>(`${SELECT_TAGS} WHERE bt.book_id = ? ORDER BY bt.rowid`);
  const isbnRows = db.prepare<[string], BookRow>(`${SELECT_BOOKS} WHERE b.isbn13 = ? ORDER BY b.id`);
  const isbnTags = db.prepare<[string], TagRow>(
    `${SELECT_TAGS} WHERE bt.book_id IN (SELECT id FROM books WHERE isbn13 = ?) ORDER BY bt.rowid`,
  );

  const insertBook = db.prepare<[Record<string, unknown>]>(`
    INSERT INTO books (${FIELDS.map((key) => COLUMNS[key]).join(", ")}, created_at, updated_at)
    VALUES (${FIELDS.map((key) => `@${key}`).join(", ")}, @createdAt, @updatedAt)`);
  const updateBook = db.prepare<[Record<string, unknown>]>(`
    UPDATE books SET ${FIELDS.map((key) => `${COLUMNS[key]} = @${key}`).join(", ")}, updated_at = @updatedAt
    WHERE id = @id`);
  const deleteBook = db.prepare<[number]>("DELETE FROM books WHERE id = ?");

  const findTag = db.prepare<[string], { id: number }>("SELECT id FROM tags WHERE name_key = ?");
  const insertTag = db.prepare<[string, string]>("INSERT INTO tags (name, name_key) VALUES (?, ?)");
  const unlinkTags = db.prepare<[number]>("DELETE FROM book_tags WHERE book_id = ?");
  const linkTag = db.prepare<[number, number]>("INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)");
  const dropUnusedTags = db.prepare<[]>(
    "DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM book_tags WHERE tag_id = tags.id)",
  );

  // A bulk change names its books as one JSON array parameter, read with json_each.
  const IDS = "SELECT value FROM json_each(@ids)";
  const knownBooks = db.prepare<[{ ids: string }], { id: number; collection: Collection }>(
    `SELECT id, collection FROM books WHERE id IN (${IDS})`,
  );
  const rowsOf = db.prepare<[{ ids: string }], BookRow>(`${SELECT_BOOKS} WHERE b.id IN (${IDS}) ORDER BY b.id`);
  const tagsOf = db.prepare<[{ ids: string }], TagRow>(`${SELECT_TAGS} WHERE bt.book_id IN (${IDS}) ORDER BY bt.rowid`);
  // Only the books whose value changes are written, so the others keep their updatedAt.
  const setShelves = db.prepare<[{ ids: string; shelf: string | null; at: string }]>(
    `UPDATE books SET shelf = @shelf, updated_at = @at WHERE id IN (${IDS}) AND shelf IS NOT @shelf`,
  );
  const setStatuses = db.prepare<[{ ids: string; status: string; at: string }]>(
    `UPDATE books SET status = @status, updated_at = @at WHERE id IN (${IDS}) AND status <> @status`,
  );
  const touch = db.prepare<[string, number]>("UPDATE books SET updated_at = ? WHERE id = ?");
  const linkTagOnce = db.prepare<[number, number]>("INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)");
  const unlinkNamedTags = db.prepare<[{ book: number; keys: string }]>(
    "DELETE FROM book_tags WHERE book_id = @book AND tag_id IN (SELECT id FROM tags WHERE name_key IN (SELECT value FROM json_each(@keys)))",
  );
  const deleteBooks = db.prepare<[{ ids: string }]>(`DELETE FROM books WHERE id IN (${IDS})`);

  function withTags(rows: BookRow[], tagRows: TagRow[]): Book[] {
    const byBook = new Map<number, string[]>();
    for (const { bookId, name } of tagRows) {
      const names = byBook.get(bookId);
      if (names) names.push(name);
      else byBook.set(bookId, [name]);
    }
    return rows.map((row) => toBook(row, byBook.get(row.id) ?? []));
  }

  function get(id: number): Book | undefined {
    const row = getRow.get(id);
    return row && toBook(row, getTags.all(id).map((tag) => tag.name));
  }

  /** The tag's id, made if no tag has its key yet. */
  function tagId({ name, key }: { name: string; key: string }): number {
    return findTag.get(key)?.id ?? Number(insertTag.run(name, key).lastInsertRowid);
  }

  /** Replaces a book's tags. An existing tag is matched case-insensitively and keeps its spelling. */
  function setTags(bookId: number, tags: readonly string[]): void {
    unlinkTags.run(bookId);
    for (const tag of normalizeTags(tags)) linkTag.run(bookId, tagId(tag));
    dropUnusedTags.run();
  }

  /** `get` for a row that was just written in the same transaction. */
  function reread(id: number): Book {
    const book = get(id);
    if (!book) throw new Error(`Book ${id} vanished inside its own transaction.`);
    return book;
  }

  const create = db.transaction((input: BookCreate): Book => {
    const fields: BookFields = { ...DEFAULTS, ...settle(input), title: input.title };
    fields.authorSort ??= deriveAuthorSort(fields.authors);
    const at = now().toISOString();
    const id = Number(insertBook.run({ ...toParams(fields), createdAt: at, updatedAt: at }).lastInsertRowid);
    if (input.tags) setTags(id, input.tags);
    return reread(id);
  });

  const patch = db.transaction((id: number, changes: BookPatch): Book | undefined => {
    const current = get(id);
    if (!current) return undefined;
    const set = settle(changes);
    if (Object.keys(set).length === 0 && changes.tags === undefined) return current;

    const next: BookFields = { ...fieldsOf(current), ...set };
    // "Derived" means the stored key is what the stored authors give: no flag
    // to keep in step. A key the owner typed differs, and survives new authors.
    const wasDerived = current.authorSort === deriveAuthorSort(current.authors);
    if (changes.authorSort === null || (changes.authorSort === undefined && changes.authors !== undefined && wasDerived)) {
      next.authorSort = deriveAuthorSort(next.authors);
    }

    updateBook.run({ ...toParams(next), id, updatedAt: now().toISOString() });
    if (changes.tags !== undefined) setTags(id, changes.tags ?? []);
    return reread(id);
  });

  const remove = db.transaction((id: number): boolean => {
    const removed = deleteBook.run(id).changes > 0;
    if (removed) dropUnusedTags.run();
    return removed;
  });

  /** The books with these ids, by id: two statements, however many there are. */
  function listOf(ids: readonly number[]): Book[] {
    const param = { ids: JSON.stringify(ids) };
    return withTags(rowsOf.all(param), tagsOf.all(param));
  }

  const bulk = db.transaction((ids: readonly number[], change: BulkChange): { done: BookBulkResult } | { unknown: number[] } => {
    const known = knownBooks.all({ ids: JSON.stringify(ids) });
    if (known.length !== ids.length) {
      const found = new Set(known.map((book) => book.id));
      return { unknown: ids.filter((id) => !found.has(id)).sort((a, b) => a - b) };
    }
    const at = now().toISOString();

    if (change.kind === "delete") {
      deleteBooks.run({ ids: JSON.stringify(ids) });
      dropUnusedTags.run();
      return { done: { books: [], deleted: [...ids].sort((a, b) => a - b), skipped: [] } };
    }

    // A shelf is where an owned copy sits: a wishlist book has none to change.
    const skipped = new Set(change.kind === "shelf" ? known.filter((book) => book.collection !== "owned").map((book) => book.id) : []);
    const applied = skipped.size > 0 ? ids.filter((id) => !skipped.has(id)) : ids;
    const param = JSON.stringify(applied);

    switch (change.kind) {
      case "shelf":
        setShelves.run({ ids: param, shelf: change.shelf, at });
        break;
      case "status":
        setStatuses.run({ ids: param, status: change.status, at });
        break;
      case "addTags": {
        const tagIds = normalizeTags(change.tags).map(tagId);
        for (const id of applied) {
          let added = false;
          for (const tag of tagIds) added = linkTagOnce.run(id, tag).changes > 0 || added;
          if (added) touch.run(at, id);
        }
        break;
      }
      case "removeTags": {
        const keys = JSON.stringify(normalizeTags(change.tags).map((tag) => tag.key));
        for (const id of applied) {
          if (unlinkNamedTags.run({ book: id, keys }).changes > 0) touch.run(at, id);
        }
        dropUnusedTags.run();
        break;
      }
    }

    return { done: { books: listOf(applied), deleted: [], skipped: [...skipped].sort((a, b) => a - b) } };
  });

  return {
    list: () => withTags(listRows.all(), listTags.all()),
    get,
    create: (input) => create(input),
    patch: (id, changes) => patch(id, changes),
    remove: (id) => remove(id),
    findByIsbn: (isbn13) => withTags(isbnRows.all(isbn13), isbnTags.all(isbn13)),
    bulk: (ids, change) => bulk(ids, change),
  };
}
