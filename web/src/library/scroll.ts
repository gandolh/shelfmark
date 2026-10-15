import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Back from a book lands where the Library was left (layout/Page.tsx's back
 * link uses the browser's Back for that). The browser restores the scroll
 * before the Library has rendered its rows, so it can't; the Library keeps
 * its own scroll position on its history entry and restores it once the
 * books are in. A fresh visit (a new entry) starts at the top.
 */

const KEY = "shelfmarkLibraryScroll";

function savedScroll(): number | null {
  try {
    const state = window.history.state as Record<string, unknown> | null;
    const y = state?.[KEY];
    return typeof y === "number" && y > 0 ? y : null;
  } catch {
    return null;
  }
}

/** Write the scroll position to the current history entry; call it before leaving for a book. */
export function rememberScroll(): void {
  try {
    const state = (window.history.state as Record<string, unknown> | null) ?? {};
    const y = Math.round(window.scrollY);
    if (state[KEY] === y) return;
    window.history.replaceState({ ...state, [KEY]: y }, "");
  } catch {
    // Safari caps replaceState calls; losing a scroll position costs nothing.
  }
}

/** Keeps the position while the page scrolls, and restores it when `ready` first turns true. */
export function useScrollMemory(ready: boolean): void {
  const restored = useRef(false);

  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const y = savedScroll();
    if (y !== null) window.scrollTo(0, y);
  }, [ready]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(rememberScroll, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}
