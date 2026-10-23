/**
 * The page's one IndexedDB database. Every offline feature keeps its data in
 * a store of this database, so there is one `open` and one upgrade path:
 * a new store means a new `DB_VERSION` and a new `if (oldVersion < N)` block
 * in `upgrade`, never a second database.
 *
 * IndexedDB can be missing or refuse (a private window, blocked site data):
 * `openOfflineDb` rejects then, and callers treat that as "no offline data".
 */

export const DB_NAME = "shelfmark-offline";
export const DB_VERSION = 2;

/** Version 1: the library copy. Version 2: the scan queue. Add a store per version below. */
export const STORES = { library: "library", queue: "queue" } as const;

function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) db.createObjectStore(STORES.library);
  if (oldVersion < 2) db.createObjectStore(STORES.queue, { keyPath: "id", autoIncrement: true });
  // if (oldVersion < 3) db.createObjectStore("...");
}

export function openOfflineDb(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  if (factory === undefined) return Promise.reject(new Error("IndexedDB is not available."));
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading (or a delete) needs this connection gone.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
  });
}

/** Run `work` on one store in one transaction; resolves with its request's result once the transaction commits. */
export async function inStore<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openOfflineDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB failed."));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB failed."));
    });
  } finally {
    db.close();
  }
}

// Writes and clears of every store run one after another, so a clear (sign
// out) is never overtaken by a write that was started before it.
let chain: Promise<unknown> = Promise.resolve();

/** Run `task` after every task given here before it has settled. Never leaves the chain rejected. */
export function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}
