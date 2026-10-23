import type { Book, Collection } from "@shelfmark/shared";
import { inStore, STORES } from "./db";

/**
 * The device's copy of the library, for "do I own this?" with no signal:
 * `{ isbn13, title, shelf, collection }` for every book, replaced whole each
 * time the library list loads or changes (it is one owner's books, so a full
 * rewrite is small and never out of step). The pure parts (`copyOf`,
 * `answerFor`) are tested; the IndexedDB calls below are thin.
 */

export interface OfflineBook {
  isbn13: string;
  title: string;
  shelf: string | null;
  collection: Collection;
}

export interface LibraryCopy {
  /** When it was written, ISO. */
  savedAt: string;
  books: OfflineBook[];
}

/** What the copy says about one ISBN. */
export type OfflineAnswer =
  /** On a shelf: every owned copy. */
  | { kind: "owned"; copies: OfflineBook[]; savedAt: string }
  /** No copy owned, but on the wishlist. */
  | { kind: "wishlisted"; copies: OfflineBook[]; savedAt: string }
  | { kind: "absent"; savedAt: string };

/** The copy of a library list: only books with an ISBN can be matched by a scan. */
export function copyOf(books: readonly Book[], now: Date = new Date()): LibraryCopy {
  const kept: OfflineBook[] = [];
  for (const book of books) {
    if (book.isbn13 === null) continue;
    kept.push({ isbn13: book.isbn13, title: book.title, shelf: book.shelf, collection: book.collection });
  }
  return { savedAt: now.toISOString(), books: kept };
}

/** Already owned wins over wishlisted, and both win over absent (the same order as a lookup's). */
export function answerFor(copy: LibraryCopy, isbn13: string): OfflineAnswer {
  const matches = copy.books.filter((book) => book.isbn13 === isbn13);
  const owned = matches.filter((book) => book.collection === "owned");
  if (owned.length > 0) return { kind: "owned", copies: owned, savedAt: copy.savedAt };
  const wished = matches.filter((book) => book.collection === "wishlist");
  if (wished.length > 0) return { kind: "wishlisted", copies: wished, savedAt: copy.savedAt };
  return { kind: "absent", savedAt: copy.savedAt };
}

const KEY = "copy";

// Writes and clears run one after another, so a clear (sign out) is never
// overtaken by a write that was started before it.
let queue: Promise<unknown> = Promise.resolve();
function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Replace the copy with `books`. Resolves `false` when the device wouldn't store it; never rejects. */
export function saveLibraryCopy(books: readonly Book[]): Promise<boolean> {
  const copy = copyOf(books);
  return inOrder(() => inStore(STORES.library, "readwrite", (store) => store.put(copy, KEY))).then(
    () => true,
    () => false,
  );
}

/** The stored copy, or `null` when there is none (never loaded, signed out, or no IndexedDB). Never rejects. */
export function loadLibraryCopy(): Promise<LibraryCopy | null> {
  return inOrder(() => inStore<LibraryCopy | undefined>(STORES.library, "readonly", (store) => store.get(KEY))).then(
    (copy) => copy ?? null,
    () => null,
  );
}

/** Forget the copy (sign out). Never rejects. */
export function clearLibraryCopy(): Promise<void> {
  return inOrder(() => inStore(STORES.library, "readwrite", (store) => store.clear())).then(
    () => undefined,
    () => undefined,
  );
}
