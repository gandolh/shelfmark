import type { Book, BookBulk, BookBulkResult, BookCreate, BookPatch } from "@shelfmark/shared";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError, booksApi, isApiError } from "../api";
import { authClient } from "../auth/session";
import { clearLibraryCopy, saveLibraryCopy } from "../offline/library";

/**
 * The books client: `GET /api/books` once per session, the whole list kept in
 * memory (a home library is hundreds to a few thousand books, and the Library
 * sorts, filters and searches it in the browser), and every change made
 * through here applied to that list in place, so no screen refetches after a
 * save. `refresh` fetches again on purpose.
 */

/**
 * - `loading`: no list yet (the first fetch, or a retry after it failed).
 * - `ready`: `books` is the list. A refresh that fails keeps it and sets `error`.
 * - `error`: the first fetch failed; `error` says why and `refresh` retries.
 */
export type BooksStatus = "loading" | "ready" | "error";

export interface BooksState {
  /** In the server's order (oldest first); new books join at the end. */
  readonly books: readonly Book[];
  readonly status: BooksStatus;
  readonly error: ApiError | null;
}

/** The calls the store makes; `booksApi` in the app, a fake in tests. */
export interface BooksSource {
  list(): Promise<Book[]>;
  create(body: BookCreate): Promise<Book>;
  patch(id: number, patch: BookPatch): Promise<Book>;
  remove(id: number): Promise<void>;
  bulk(body: BookBulk): Promise<BookBulkResult>;
}

type Update = (books: readonly Book[]) => readonly Book[];

const INITIAL: BooksState = { books: [], status: "loading", error: null };

/** Hooks for what lives beside the list: the device's offline copy of it. */
export interface BooksHooks {
  /** The list as it now stands, once a fetch has succeeded: after the fetch and after every change. */
  persist?: (books: readonly Book[]) => void;
  /** The store was reset (signed out). */
  forget?: () => void;
}

export function createBooksStore(source: BooksSource, hooks: BooksHooks = {}) {
  let state = INITIAL;
  let loaded = false; // a fetch has succeeded since the last reset
  let started = false;
  let inFlight: Promise<void> | null = null;
  // Changes saved while a fetch is in flight, replayed onto its answer: the
  // server may have read the list before the change landed.
  let pending: Update[] = [];
  // Bumped by `reset`, so the answer to a fetch from before it is dropped.
  let generation = 0;
  const listeners = new Set<() => void>();

  function set(next: Partial<BooksState>): void {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function apply(update: Update): void {
    if (inFlight) pending.push(update);
    set({ books: update(state.books) });
    if (loaded) hooks.persist?.(state.books);
  }

  function load(): Promise<void> {
    if (inFlight) return inFlight;
    started = true;
    pending = [];
    const run = generation;
    if (!loaded) set({ status: "loading", error: null });
    const request = source.list().then(
      (books) => {
        if (run !== generation) return;
        const replayed = pending.reduce<readonly Book[]>((list, update) => update(list), books);
        loaded = true;
        set({ books: replayed, status: "ready", error: null });
        hooks.persist?.(replayed);
      },
      (error: unknown) => {
        if (run !== generation) return;
        set({ status: loaded ? "ready" : "error", error: toApiError(error) });
      },
    );
    const tracked: Promise<void> = request.finally(() => {
      if (inFlight !== tracked) return; // a reset already let go of it
      inFlight = null;
      pending = [];
    });
    inFlight = tracked;
    return tracked;
  }

  return {
    getState: (): BooksState => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Fetch the list unless this session already has (or is fetching it). */
    ensureLoaded(): void {
      if (!started) void load();
    },

    /** Fetch the list again. Concurrent calls share one request. */
    refresh: load,

    async create(body: BookCreate): Promise<Book> {
      const book = await source.create(body);
      apply((books) => (books.some((b) => b.id === book.id) ? replace(books, book) : [...books, book]));
      return book;
    },

    async patch(id: number, patch: BookPatch): Promise<Book> {
      const book = await source.patch(id, patch);
      apply((books) => replace(books, book));
      return book;
    },

    /** A book that is already gone (a 404) counts as deleted. */
    async remove(id: number): Promise<void> {
      try {
        await source.remove(id);
      } catch (error) {
        if (!isApiError(error, "not_found")) throw error;
      }
      apply((books) => books.filter((b) => b.id !== id));
    },

    /**
     * One change to many books (`POST /api/books/bulk`, brief 26): the books
     * it answers replace theirs in place, the ids it deleted leave the list.
     * The server changes all of them or none, so a failure leaves the list
     * alone.
     */
    async bulk(body: BookBulk): Promise<BookBulkResult> {
      const result = await source.bulk(body);
      if (result.books.length > 0 || result.deleted.length > 0) apply((books) => applyBulk(books, result));
      return result;
    },

    /**
     * A cover was stored (`updatedAt`, its `CoverInfo`'s) or removed (`null`)
     * outside these calls (brief 05's cover routes): the book's `hasCover` and
     * `coverUpdatedAt` follow, as the next fetch would say.
     */
    setCover(id: number, updatedAt: string | null): void {
      const hasCover = updatedAt !== null;
      apply((books) =>
        books.map((b) =>
          b.id === id && (b.hasCover !== hasCover || b.coverUpdatedAt !== updatedAt) ? { ...b, hasCover, coverUpdatedAt: updatedAt } : b,
        ),
      );
    },

    /** Forget the list (signed out): the next `ensureLoaded` fetches it afresh. */
    reset(): void {
      generation += 1;
      loaded = false;
      started = false;
      inFlight = null;
      pending = [];
      set(INITIAL);
      hooks.forget?.();
    },
  };
}

export type BooksStore = ReturnType<typeof createBooksStore>;

/** What `resetWhenSignedOut` reads of the session; the vendored auth client fits. */
export interface SessionSource {
  getState(): { status: string };
  subscribe(listener: () => void): () => void;
}

/**
 * The list belongs to a session: reset the store when the session turns
 * signed out, so the next one fetches its own. On the session's word, not on
 * any 401: a 401 makes session.ts ask the server again, and when the answer
 * is still "signed in" the shell stays mounted and nothing would refetch a
 * list reset there, leaving the Library loading for good. Returns the
 * unsubscribe function.
 */
export function resetWhenSignedOut(store: Pick<BooksStore, "reset">, session: SessionSource): () => void {
  let previous = session.getState().status;
  return session.subscribe(() => {
    const status = session.getState().status;
    if (status === "signed_out" && previous !== "signed_out") store.reset();
    previous = status;
  });
}

function replace(books: readonly Book[], book: Book): readonly Book[] {
  return books.map((b) => (b.id === book.id ? book : b));
}

/** A bulk change's answer applied to the list: its books in their places, its deleted ids gone, the rest untouched. */
function applyBulk(books: readonly Book[], result: BookBulkResult): readonly Book[] {
  const changed = new Map(result.books.map((book) => [book.id, book]));
  const deleted = new Set(result.deleted);
  return books.flatMap((book) => (deleted.has(book.id) ? [] : [changed.get(book.id) ?? book]));
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "bad_response", "The books couldn't be loaded.", { cause: error });
}

// --- The app's store ------------------------------------------------------------

// The device keeps a copy of the list for the offline "do I own this?" (offline/library.ts).
const store = createBooksStore(booksApi, {
  persist: (books) => void saveLibraryCopy(books),
  forget: () => void clearLibraryCopy(),
});

resetWhenSignedOut(store, authClient());

export interface BooksView extends BooksState {
  /** Fetch the list again; resolves when the answer is in (it never rejects). */
  refresh: () => Promise<void>;
}

/** Every book, loaded on first use. Re-renders when the list changes. */
export function useBooks(): BooksView {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  useEffect(() => store.ensureLoaded(), []);
  return useMemo(() => ({ ...state, refresh: store.refresh }), [state]);
}

/** One book from the list: `undefined` while it loads, and once loaded when there is no such book. */
export function useBook(id: number): { book: Book | undefined; status: BooksStatus; error: ApiError | null } {
  const { books, status, error } = useBooks();
  const book = useMemo(() => books.find((b) => b.id === id), [books, id]);
  return { book, status, error };
}

/** Save a new book (`POST /api/books`) and add it to the list. Rejects with an `ApiError`. */
export function createBook(body: BookCreate): Promise<Book> {
  return store.create(body);
}

/** Change a book (`PATCH`), sending only the fields in `patch`, and update it in the list. */
export function patchBook(id: number, patch: BookPatch): Promise<Book> {
  return store.patch(id, patch);
}

/** Delete a book and take it out of the list. */
export function deleteBook(id: number): Promise<void> {
  return store.remove(id);
}

/** One change to many books (`POST /api/books/bulk`), applied to the list. Rejects with an `ApiError`; then nothing changed. */
export function bulkChangeBooks(body: BookBulk): Promise<BookBulkResult> {
  return store.bulk(body);
}

/** Fetch the list again, outside a component. */
export function refreshBooks(): Promise<void> {
  return store.refresh();
}

// --- Covers ---------------------------------------------------------------------

/**
 * Tell the app a book's cover changed: after `PUT` or `POST …/cover/fetch`
 * (pass the `CoverInfo` they answer) or `DELETE …/cover` (pass `null`). The
 * book's `hasCover` and `coverUpdatedAt` follow in the list, so every
 * `CoverImage` of it gets the new image's address.
 */
export function coverChanged(id: number, cover: { updatedAt: string } | null): void {
  store.setCover(id, cover?.updatedAt ?? null);
}
