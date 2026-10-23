import type { LookupResponse } from "@shelfmark/shared";
import { useSyncExternalStore } from "react";
import { isApiError } from "../api";
import { addScan, clearQueue, inScanOrder, isQueued, loadQueue, nextWaiting, removeScan, type QueuedScan } from "./queue";

/**
 * The scan queue as the app sees it: the persisted scans plus what this visit
 * has learned about them. Looking up is one scan at a time through the same
 * `POST /api/lookup` a live scan uses, so the server's per-source queues keep
 * the pacing; there is no batch call and no second request in flight. Answers
 * are kept in memory only: a reload asks again, and nothing is saved here.
 */

/** What a queued scan is doing: waiting its turn, in flight, answered (see `lookup`), or refused (a server error). */
export type QueueItemState = "waiting" | "looking" | "answered" | "failed";

export interface QueueItem extends QueuedScan {
  state: QueueItemState;
  /** The server's answer, once `answered`: found, already owned, wishlisted, or nothing. */
  lookup: LookupResponse | null;
}

export interface QueueSnapshot {
  /** False until the stored queue has been read. */
  loaded: boolean;
  items: readonly QueueItem[];
}

export type Lookup = (isbn13: string) => Promise<LookupResponse>;

let entries: QueuedScan[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const answers = new Map<number, LookupResponse>();
const refused = new Set<number>();
let lookingId: number | null = null;
let draining = false;
let listening = false;
// Bumped by a clear: a lookup that was in flight then lands nowhere.
let generation = 0;
let lookup: Lookup | null = null;
let snapshot: QueueSnapshot = { loaded: false, items: [] };
const listeners = new Set<() => void>();

function stateOf(id: number): QueueItemState {
  if (answers.has(id)) return "answered";
  if (refused.has(id)) return "failed";
  return id === lookingId ? "looking" : "waiting";
}

function publish(): void {
  snapshot = {
    loaded,
    items: inScanOrder(entries).map((scan) => ({ ...scan, state: stateOf(scan.id), lookup: answers.get(scan.id) ?? null })),
  };
  for (const listener of listeners) listener();
}

function load(): Promise<void> {
  loading ??= loadQueue().then((stored) => {
    // A scan queued while this was reading is already in `entries`.
    for (const scan of stored) if (!entries.some((e) => e.id === scan.id)) entries.push(scan);
    loaded = true;
    publish();
  });
  return loading;
}

async function drain(): Promise<void> {
  if (draining || lookup === null) return;
  draining = true;
  const mine = generation;
  try {
    while (mine === generation && navigator.onLine) {
      const next = nextWaiting(entries, (id) => answers.has(id) || refused.has(id));
      if (next === null) return;
      lookingId = next.id;
      publish();
      let answer: LookupResponse | null = null;
      let stop = false;
      try {
        answer = await lookup(next.isbn13);
      } catch (error) {
        // No answer at all: the network went again, so wait for the next `online`.
        if (isApiError(error, "network")) stop = true;
        else if (mine === generation) refused.add(next.id);
      }
      if (mine !== generation) return;
      lookingId = null;
      if (answer !== null && entries.some((e) => e.id === next.id)) answers.set(next.id, answer);
      publish();
      if (stop) return;
    }
  } finally {
    draining = false;
    // A clear happened mid-lookup and scans were queued since: they are still waiting.
    if (mine !== generation) void drain();
  }
}

/**
 * Read the stored queue and look its scans up whenever the browser is online:
 * now (app start) and on every `online` event. Safe to call again.
 */
export function startScanQueue(lookupIsbn: Lookup): void {
  lookup = lookupIsbn;
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("online", () => {
      // A refused scan gets another try now that the network has been away.
      refused.clear();
      publish();
      void drain();
    });
  }
  void load().then(drain);
}

/** Queue a scan. `already`: the ISBN is waiting; `failed`: the device wouldn't keep it. Never rejects. */
export async function queueScan(isbn13: string, shelf: string | null): Promise<"queued" | "already" | "failed"> {
  await load();
  if (isQueued(entries, isbn13)) return "already";
  const stored = await addScan({ isbn13, scannedAt: new Date().toISOString(), shelf });
  if (stored === null) return "failed";
  entries.push(stored);
  publish();
  void drain();
  return "queued";
}

/** Take a scan out of the queue: it was opened to confirm, or the owner dropped it. */
export function takeScan(id: number): void {
  entries = entries.filter((scan) => scan.id !== id);
  answers.delete(id);
  refused.delete(id);
  publish();
  void removeScan(id);
}

/** Sign out: forget every scan, here and on the device. Never rejects. */
export async function clearScanQueue(): Promise<void> {
  generation += 1;
  entries = [];
  answers.clear();
  refused.clear();
  lookingId = null;
  publish();
  await clearQueue();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The queue as it stands; re-renders on every change. */
export function useScanQueue(): QueueSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
