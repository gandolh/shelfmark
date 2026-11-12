import { useEffect, useSyncExternalStore } from "react";
import { lookupIsbn } from "../add/api";
import { startScanQueue } from "../offline/queueStore";

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
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p
      className="fixed md:top-[calc(var(--spacing-topbar)+8px)] top-[calc(env(safe-area-inset-top)_+_8px)] right-0 left-0 z-float w-fit max-w-[calc(100%_-_2_*_var(--spacing-gutter-phone))] mx-auto py-1.5 px-3.5 border border-hairline rounded-pill bg-surface text-ink-2 text-meta leading-tight text-center"
      role="status"
    >
      You&rsquo;re offline. Your library will be back when you are.
    </p>
  );
}
