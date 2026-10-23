import { useEffect, useSyncExternalStore } from "react";
import { lookupIsbn } from "../add/api";
import { startScanQueue } from "../offline/queueStore";
import "./pwa.css";

function subscribe(notify: () => void): () => void {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

/** A quiet line under the top bar while the network is gone. The shell and covers still work. */
export function OfflineNotice() {
  // App start: scans queued offline last time are looked up now (and on every `online`), whichever page is open.
  useEffect(() => startScanQueue(lookupIsbn), []);
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <p className="offline-notice" role="status">
      You&rsquo;re offline. Your library will be back when you are.
    </p>
  );
}
