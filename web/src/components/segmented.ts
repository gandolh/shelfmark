import { cn } from "../lib/cn";

/**
 * The segmented track and its segments, as the Library's Table / Covers
 * switch, the Add page's modes and the top bar's places all wear them. The
 * chosen segment is raised in white: `data-checked` (a `RadioGroup` item),
 * `aria-selected` (a tab) or `aria-current` (a link). Every segment keeps a
 * 44 px target on a phone.
 */
export type SegmentedSize = "regular" | "small" | "nav";

export function segmentedTrack(size: SegmentedSize = "regular", extra?: string): string {
  return cn(
    "inline-flex flex-none rounded-track bg-control p-0.75",
    size === "small" && "rounded-control p-0.5",
    extra,
  );
}

// The label again in the selected weight, invisible and flat (`after:`), so a segment is as wide chosen as not
// and nothing shifts when the choice moves. Segments carry `data-label` for it.
const ITEM = [
  "relative inline-flex min-h-segment flex-col items-center justify-center rounded-control px-3.5",
  "text-meta leading-tight font-regular whitespace-nowrap text-ink-2 no-underline",
  "transition-[background-color,color] duration-(--duration-fast) ease-out",
  "after:pointer-events-none after:invisible after:h-0 after:overflow-hidden after:font-semibold after:select-none after:content-[attr(data-label)]",
  "hover:bg-segment-hover hover:text-ink",
  "data-checked:bg-surface data-checked:font-semibold data-checked:text-ink",
  "aria-selected:bg-surface aria-selected:font-semibold aria-selected:text-ink",
  "aria-[current]:bg-surface aria-[current]:font-semibold aria-[current]:text-ink",
  "max-md:before:absolute max-md:before:inset-x-0 max-md:before:inset-y-[calc((var(--spacing-segment)-var(--spacing-touch))/2)] max-md:before:content-['']",
].join(" ");

const SMALL_ITEM =
  "min-h-segment-small rounded-segment px-3 text-small max-md:px-3.5 max-md:before:inset-y-[calc((var(--spacing-segment-small)-var(--spacing-touch))/2)]";

export function segmentedItem(size: SegmentedSize = "regular", extra?: string): string {
  return cn(ITEM, size === "nav" && "px-4.5", size === "small" && SMALL_ITEM, extra);
}
