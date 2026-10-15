import type { Book, BookCreate, BookPatch } from "@shelfmark/shared";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { createBooksStore, resetWhenSignedOut, type BooksSource } from "./store";

function makeBook(id: number, title: string, extra: Partial<Book> = {}): Book {
  return {
    id,
    isbn13: null,
    barcode: null,
    title,
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
    currency: "RON",
    metadataSource: "manual",
    tags: [],
    hasCover: false,
    coverUpdatedAt: null,
    createdAt: "2026-10-14T09:00:00.000Z",
    updatedAt: "2026-10-14T09:00:00.000Z",
    ...extra,
  };
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A fake server: `list` answers what each test queues, the rest act on `rows`. */
function fakeSource(initial: Book[] = []) {
  let rows = [...initial];
  let nextId = Math.max(0, ...initial.map((b) => b.id)) + 1;
  const lists: ReturnType<typeof deferred<Book[]>>[] = [];
  const source = {
    list: vi.fn(() => {
      const answer = deferred<Book[]>();
      lists.push(answer);
      return answer.promise;
    }),
    create: vi.fn(async (body: BookCreate) => {
      const book = makeBook(nextId++, body.title);
      rows.push(book);
      return book;
    }),
    patch: vi.fn(async (id: number, patch: BookPatch) => {
      const found = rows.find((b) => b.id === id);
      if (!found) throw new ApiError(404, "not_found", "There is no such book.");
      const book = { ...found, ...(patch as Partial<Book>) };
      rows = rows.map((b) => (b.id === id ? book : b));
      return book;
    }),
    remove: vi.fn(async (id: number) => {
      if (!rows.some((b) => b.id === id)) throw new ApiError(404, "not_found", "There is no such book.");
      rows = rows.filter((b) => b.id !== id);
    }),
  } satisfies BooksSource;
  return {
    source,
    /** Answer the oldest unanswered `list` with the rows as they are now (or as given). */
    answerList: async (books: Book[] = rows) => {
      lists.shift()?.resolve([...books]);
      await flush();
    },
    failList: async (error: unknown) => {
      lists.shift()?.reject(error);
      await flush();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const titles = (books: readonly Book[]) => books.map((b) => b.title);

describe("loading", () => {
  it("fetches once per session, however often it is asked", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    expect(store.getState().status).toBe("loading");

    store.ensureLoaded();
    store.ensureLoaded();
    await server.answerList();
    store.ensureLoaded();

    expect(server.source.list).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ status: "ready", error: null });
    expect(titles(store.getState().books)).toEqual(["Solenoid"]);
  });

  it("fetches again on refresh, sharing one request between callers", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    await server.answerList();

    const first = store.refresh();
    const second = store.refresh();
    expect(first).toBe(second);
    // The list stays on screen while it refreshes.
    expect(store.getState().status).toBe("ready");
    await server.answerList([makeBook(1, "Solenoid"), makeBook(2, "Orbitor")]);
    await first;

    expect(server.source.list).toHaveBeenCalledTimes(2);
    expect(titles(store.getState().books)).toEqual(["Solenoid", "Orbitor"]);
  });

  it("reports a failed first load, and a retry recovers", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    await server.failList(new ApiError(0, "network", "Shelfmark can't be reached."));

    expect(store.getState()).toMatchObject({ status: "error", books: [] });
    expect(store.getState().error?.code).toBe("network");

    const retry = store.refresh();
    expect(store.getState()).toMatchObject({ status: "loading", error: null });
    await server.answerList();
    await retry;
    expect(store.getState().status).toBe("ready");
  });

  it("keeps the list when a refresh fails, and says why", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    await server.answerList();

    void store.refresh();
    await server.failList(new ApiError(500, "internal", "Something broke."));
    expect(store.getState().status).toBe("ready");
    expect(titles(store.getState().books)).toEqual(["Solenoid"]);
    expect(store.getState().error?.code).toBe("internal");
  });

  it("turns a stray failure into an ApiError", async () => {
    const server = fakeSource();
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    await server.failList(new Error("boom"));
    expect(store.getState().error).toBeInstanceOf(ApiError);
  });

  it("tells subscribers about each change until they leave", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    const heard = vi.fn();
    const leave = store.subscribe(heard);
    store.ensureLoaded();
    await server.answerList();
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    leave();
    await store.create({ title: "Orbitor" });
    expect(heard).not.toHaveBeenCalled();
  });
});

describe("changes", () => {
  async function loadedStore(books: Book[]) {
    const server = fakeSource(books);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    await server.answerList();
    return { server, store };
  }

  it("adds a new book at the end, without fetching the list again", async () => {
    const { server, store } = await loadedStore([makeBook(1, "Solenoid")]);
    const created = await store.create({ title: "Orbitor" });
    expect(created.id).toBe(2);
    expect(titles(store.getState().books)).toEqual(["Solenoid", "Orbitor"]);
    expect(server.source.list).toHaveBeenCalledTimes(1);
  });

  it("replaces a patched book in place", async () => {
    const { store } = await loadedStore([makeBook(1, "Solenoid"), makeBook(2, "Orbitor")]);
    const before = store.getState().books;
    await store.patch(1, { status: "reading" });
    const after = store.getState().books;
    expect(after.map((b) => [b.id, b.status])).toEqual([
      [1, "reading"],
      [2, "unread"],
    ]);
    expect(after[1]).toBe(before[1]); // untouched rows keep their identity
  });

  it("takes a deleted book out, and counts one already gone as deleted", async () => {
    const { server, store } = await loadedStore([makeBook(1, "Solenoid"), makeBook(2, "Orbitor")]);
    await store.remove(1);
    expect(titles(store.getState().books)).toEqual(["Orbitor"]);

    await server.source.remove(2); // gone behind the store's back
    await expect(store.remove(2)).resolves.toBeUndefined();
    expect(store.getState().books).toEqual([]);
  });

  it("updates a book's cover in place: stored, replaced, removed", async () => {
    const { server, store } = await loadedStore([makeBook(1, "Solenoid"), makeBook(2, "Orbitor")]);
    const before = store.getState().books;
    const cover = (b: Book | undefined) => [b?.hasCover, b?.coverUpdatedAt];

    store.setCover(1, "2026-10-15T08:00:00.000Z");
    expect(store.getState().books.map(cover)).toEqual([
      [true, "2026-10-15T08:00:00.000Z"],
      [false, null],
    ]);
    expect(store.getState().books[1]).toBe(before[1]); // untouched rows keep their identity

    // A replaced cover is a new version: a new image address everywhere the book shows.
    store.setCover(1, "2026-10-15T08:05:00.000Z");
    expect(cover(store.getState().books[0])).toEqual([true, "2026-10-15T08:05:00.000Z"]);

    store.setCover(1, null);
    expect(cover(store.getState().books[0])).toEqual([false, null]);
    expect(server.source.list).toHaveBeenCalledTimes(1);
  });

  it("replays a cover change made while the list was loading onto the answer", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    store.setCover(1, "2026-10-15T08:00:00.000Z");
    await server.answerList([makeBook(1, "Solenoid")]); // read before the cover landed
    expect(store.getState().books[0]).toMatchObject({ hasCover: true, coverUpdatedAt: "2026-10-15T08:00:00.000Z" });
  });

  it("leaves the list alone when a change fails", async () => {
    const { store } = await loadedStore([makeBook(1, "Solenoid")]);
    await expect(store.patch(9, { status: "read" })).rejects.toMatchObject({ code: "not_found" });
    expect(titles(store.getState().books)).toEqual(["Solenoid"]);
  });

  it("replays a change saved while the list was loading onto the answer", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    const stale = [makeBook(1, "Solenoid")]; // what the server read before the changes landed

    await store.create({ title: "Orbitor" });
    await store.patch(1, { status: "read" });
    await server.answerList(stale);

    const books = store.getState().books;
    expect(books.map((b) => [b.title, b.status])).toEqual([
      ["Solenoid", "read"],
      ["Orbitor", "unread"],
    ]);
  });

  it("doesn't add a book twice when the answer already has it", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    await store.create({ title: "Orbitor" });
    await server.answerList(); // read after the create: it has Orbitor already
    expect(titles(store.getState().books)).toEqual(["Solenoid", "Orbitor"]);
  });
});

describe("reset (signed out)", () => {
  it("forgets the list, drops a fetch still in flight, and fetches afresh next time", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    store.ensureLoaded();
    store.reset();
    await server.answerList(); // the old session's answer arrives late
    expect(store.getState()).toMatchObject({ status: "loading", books: [] });

    store.ensureLoaded();
    expect(server.source.list).toHaveBeenCalledTimes(2);
    await server.answerList();
    expect(store.getState().status).toBe("ready");
  });
});

describe("resetWhenSignedOut", () => {
  /** A session the test moves by hand, shaped like the auth client. */
  function fakeSession(status: string) {
    const listeners = new Set<() => void>();
    return {
      getState: () => ({ status }),
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      move(next: string) {
        status = next;
        for (const listener of listeners) listener();
      },
    };
  }

  it("keeps the list through a 401 the session survives", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    const session = fakeSession("signed_in");
    resetWhenSignedOut(store, session);
    store.ensureLoaded();
    await server.answerList();

    // A 401 makes session.ts ask again; the answer is still "signed in".
    session.move("signed_in");
    expect(store.getState()).toMatchObject({ status: "ready" });
    expect(titles(store.getState().books)).toEqual(["Solenoid"]);
  });

  it("forgets the list once the session ends, and the next session fetches its own", async () => {
    const server = fakeSource([makeBook(1, "Solenoid")]);
    const store = createBooksStore(server.source);
    const session = fakeSession("signed_in");
    const stop = resetWhenSignedOut(store, session);
    store.ensureLoaded();
    await server.answerList();

    session.move("signed_out");
    expect(store.getState()).toMatchObject({ status: "loading", books: [] });

    session.move("signed_in");
    store.ensureLoaded(); // the shell mounts again
    await server.answerList();
    expect(store.getState().status).toBe("ready");
    expect(server.source.list).toHaveBeenCalledTimes(2);

    stop();
    session.move("signed_out");
    expect(store.getState().status).toBe("ready");
  });

  it("resets once per sign-out, not on every word from a signed-out session", () => {
    const server = fakeSource();
    const store = createBooksStore(server.source);
    const session = fakeSession("loading");
    resetWhenSignedOut(store, session);
    const heard = vi.fn();
    store.subscribe(heard);
    session.move("signed_out");
    session.move("signed_out");
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
