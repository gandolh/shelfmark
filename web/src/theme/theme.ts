import { useSyncExternalStore } from "react";
import { browserStorage, type PrefsStorage } from "../library/prefs";

/** What the owner picked. `system` follows the operating system, live (CSS: `color-scheme: light dark`). */
export type Theme = "light" | "dark" | "system";

export const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Kept on this device only, as the Library's prefs are. The boot script in index.html reads the same key. */
export const THEME_KEY = "shelfmark.theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** The theme in force: light on a first visit, even where the system prefers dark; `system` follows the system. */
export function resolveTheme(choice: Theme, systemPrefersDark: boolean): "light" | "dark" {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/** The saved choice; light when there is none, it is not one of the three, or storage throws. */
export function readTheme(storage: PrefsStorage | null = browserStorage()): Theme {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isTheme(value) ? value : "light";
  } catch {
    return "light";
  }
}

/** Keeps the choice; false where storage is blocked (it then lasts until the tab closes). */
export function writeTheme(theme: Theme, storage: PrefsStorage | null = browserStorage()): boolean {
  try {
    if (storage === null) return false;
    storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

let current: Theme = typeof window === "undefined" ? "light" : readTheme();
const listeners = new Set<() => void>();

/** Applies a choice to <html> (before the first paint the boot script did the same), keeps it, and tells subscribers. */
export function setTheme(theme: Theme): void {
  current = theme;
  document.documentElement.dataset.theme = theme;
  writeTheme(theme);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The saved choice, re-rendering when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "light",
  );
}
