import { browserStorage, type PrefsStorage } from "../library/prefs";

/** The Recommendations card's two tabs, one per source. */
export type SourceTab = "similar" | "claude";

const TAB_KEY = "shelfmark.recommendations.tab";

/** The tab last chosen on this device, or `null` when there is none or storage throws. */
export function readTab(storage: PrefsStorage | null = browserStorage()): SourceTab | null {
  try {
    const value = storage?.getItem(TAB_KEY);
    return value === "similar" || value === "claude" ? value : null;
  } catch {
    return null;
  }
}

/** Keeps the tab on this device; where storage is blocked it lasts until the page closes. */
export function writeTab(tab: SourceTab, storage: PrefsStorage | null = browserStorage()): void {
  try {
    storage?.setItem(TAB_KEY, tab);
  } catch {
    // Blocked storage: the choice still holds for this visit.
  }
}

/**
 * The tab to open on: the one chosen last on this device, else the first
 * that has books, else Similar books.
 */
export function initialTab(remembered: SourceTab | null, counts: Record<SourceTab, number>): SourceTab {
  if (remembered !== null) return remembered;
  if (counts.similar === 0 && counts.claude > 0) return "claude";
  return "similar";
}
