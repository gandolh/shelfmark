import { useSyncExternalStore } from "react";
import { Workbox } from "workbox-window";
import { appBase } from "../base";

/*
 * Registers the service worker and tells the UI when a new one is waiting.
 * Applying it is only ever the owner's press on "Reload": the camera on Add a
 * book must not restart under them. (`vite dev` has no worker.)
 */

let waiting = false;
let workbox: Workbox | null = null;
const listeners = new Set<() => void>();

function setWaiting(value: boolean): void {
  waiting = value;
  listeners.forEach((notify) => notify());
}

/** Register the worker once, at startup. A no-op in dev and where workers don't exist. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || workbox !== null) return;
  const base = appBase();
  workbox = new Workbox(`${base}sw.js`, { scope: base });
  // Fires for an update found while the app is open, and for one already
  // waiting when it opens.
  workbox.addEventListener("waiting", () => setWaiting(true));
  void workbox.register();
}

/** Ask the waiting worker to take over, then reload once it controls the page. */
export function applyUpdate(): void {
  const wb = workbox;
  if (wb === null) return;
  wb.addEventListener("controlling", () => window.location.reload());
  wb.messageSkipWaiting();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** True while a new version is waiting for the owner's "Reload". */
export function useUpdateWaiting(): boolean {
  return useSyncExternalStore(subscribe, () => waiting, () => false);
}
