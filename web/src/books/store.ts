import type { Book, BookCreate, BookPatch } from "@shelfmark/shared";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError, booksApi, isApiError, onSignedOut } from "../api";

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
}

type Update = (books: readonly Book[]) => readonly Book[];

const INITIAL: BooksState = { books: [], status: "loading", error: null };

export function createBooksStore(source: BooksSource) {
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

    /** A cover was stored or removed outside these calls (brief 05's cover routes). */
    setHasCover(id: number, hasCover: boolean): void {
      apply((books) => books.map((b) => (b.id === id && b.hasCover !== hasCover ? { ...b, hasCover } : b)));
    },

    /** Forget the list (signed out): the next `ensureLoaded` fetches it afresh. */
    reset(): void {
      generation += 1;
      loaded = false;
      started = false;
      inFlight = null;
      pending = [];
      set(INITIAL);
    },
  };
}

export type BooksStore = ReturnType<typeof createBooksStore>;

function replace(books: readonly Book[], book: Book): readonly Book[] {
  return books.map((b) => (b.id === book.id ? book : b));
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "bad_response", "The books couldn't be loaded.", { cause: error });
}

// --- The app's store ------------------------------------------------------------

const store = createBooksStore(booksApi);

// Signed out: the list belongs to the session, and the next one fetches its own.
onSignedOut(() => store.reset());

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

/** Fetch the list again, outside a component. */
export function refreshBooks(): Promise<void> {
  return store.refresh();
}

// --- Covers ---------------------------------------------------------------------

// A cover's version per book, for the image address: the server caches a
// cover for a day, so a replaced one needs a new address to show.
const coverVersions = new Map<number, string>();
const coverListeners = new Set<() => void>();

function subscribeCovers(listener: () => void): () => void {
  coverListeners.add(listener);
  return () => {
    coverListeners.delete(listener);
  };
}

/**
 * Tell the app a book's cover changed: after `PUT` or `POST …/cover/fetch`
 * (pass the `CoverInfo` they answer) or `DELETE …/cover` (pass `null`). The
 * list's `hasCover` follows, and every `CoverImage` of the book shows the new
 * image, past the browser's cache.
 */
export function coverChanged(id: number, cover: { updatedAt: string } | null): void {
  coverVersions.set(id, cover?.updatedAt ?? new Date().toISOString());
  for (const listener of coverListeners) listener();
  store.setHasCover(id, cover !== null);
}

/** The version `coverChanged` last gave a book's cover, if any (CoverImage's default `version`). */
export function useCoverVersion(id: number | undefined): string | undefined {
  return useSyncExternalStore(subscribeCovers, () => (id === undefined ? undefined : coverVersions.get(id)));
}
