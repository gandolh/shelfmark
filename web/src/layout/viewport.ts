import { useCallback, useSyncExternalStore } from "react";

/** From here up the shell is the desktop one: the top bar instead of the tab bar (design.md). */
export const DESKTOP_QUERY = "(min-width: 768px)";

/** Whether a media query matches now; re-renders when that changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True on the desktop layout (768 px and wider), false on a phone. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
