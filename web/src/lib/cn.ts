import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, told Shelfmark's @theme names (styles/index.css). Without the `text` list it reads
 * `text-body` as a colour, so `cn("text-ink", "text-body")` would drop one of the two. Keep the lists in step
 * with @theme.
 *
 * The sizes carry no line height (rows inherit the body's, and set their own `leading-*`), so a size must not
 * remove a `leading-*`, which tailwind-merge does by default: `cn("leading-tight", "text-small")` keeps both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "title",
        "title-phone",
        "wordmark",
        "row-title",
        "action-large",
        "input-phone",
        "body",
        "meta",
        "small",
        "label",
        "tab",
      ],
      "font-weight": ["regular", "semibold", "bold"],
      tracking: ["title", "wordmark"],
      leading: ["body", "phone", "tight"],
      // Sizes the app names: tailwind-merge needs them to see that `min-h-0` replaces `min-h-control`.
      spacing: [
        "touch",
        "control",
        "control-large",
        "segment",
        "segment-small",
        "topbar",
        "tabbar",
        "gutter-desktop",
        "gutter-phone",
      ],
      // `max-w-page`: the page column's width, so `max-w-none` replaces it.
      container: ["page"],
      radius: ["cover", "segment", "menu-item", "control", "field", "track", "menu", "container", "sheet", "pill"],
      shadow: ["cover", "float"],
    },
    classGroups: {
      z: [{ z: ["bar", "float"] }],
    },
  },
  override: {
    conflictingClassGroups: { "font-size": [] },
  },
});

/** Joins class names, and lets a later class win over an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
