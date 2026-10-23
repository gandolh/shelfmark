import { inOrder, inStore, STORES } from "./db";

/**
 * Scans made offline of books not in the device's copy, kept to be looked up
 * when the network is back: `{ id, isbn13, scannedAt, shelf }`, one record per
 * ISBN, in the `queue` store. The pure parts (`isQueued`, `inScanOrder`,
 * `nextWaiting`) are tested; the IndexedDB calls below are thin, and none of
 * them rejects (no IndexedDB means an empty queue).
 */

export interface QueuedScan {
  /** The store's key, handed out in the order scans were queued. */
  id: number;
  isbn13: string;
  /** When it was scanned, ISO. */
  scannedAt: string;
  /** The shelf chosen at the time, if any. */
  shelf: string | null;
}

export type NewScan = Omit<QueuedScan, "id">;

/** A second scan of a queued ISBN is not queued again. */
export function isQueued(list: readonly QueuedScan[], isbn13: string): boolean {
  return list.some((scan) => scan.isbn13 === isbn13);
}

/** Oldest scan first; the key breaks a tie. */
export function inScanOrder(list: readonly QueuedScan[]): QueuedScan[] {
  return [...list].sort((a, b) => (a.scannedAt < b.scannedAt ? -1 : a.scannedAt > b.scannedAt ? 1 : a.id - b.id));
}

/** The next scan to look up: the oldest one `settled` doesn't already cover. `null` when none is waiting. */
export function nextWaiting(list: readonly QueuedScan[], settled: (id: number) => boolean): QueuedScan | null {
  return inScanOrder(list).find((scan) => !settled(scan.id)) ?? null;
}

/** Keep `scan`; resolves the stored record, or `null` when the device wouldn't store it. */
export function addScan(scan: NewScan): Promise<QueuedScan | null> {
  return inOrder(() => inStore<IDBValidKey>(STORES.queue, "readwrite", (store) => store.add(scan))).then(
    (key) => ({ ...scan, id: Number(key) }),
    () => null,
  );
}

/** Every queued scan, oldest first; empty when there is none or no IndexedDB. */
export function loadQueue(): Promise<QueuedScan[]> {
  return inOrder(() => inStore<QueuedScan[]>(STORES.queue, "readonly", (store) => store.getAll())).then(
    (list) => inScanOrder(list),
    () => [],
  );
}

/** Drop one scan (confirmed, discarded or opened). */
export function removeScan(id: number): Promise<void> {
  return inOrder(() => inStore(STORES.queue, "readwrite", (store) => store.delete(id))).then(
    () => undefined,
    () => undefined,
  );
}

/** Forget the whole queue (sign out). */
export function clearQueue(): Promise<void> {
  return inOrder(() => inStore(STORES.queue, "readwrite", (store) => store.clear())).then(
    () => undefined,
    () => undefined,
  );
}
