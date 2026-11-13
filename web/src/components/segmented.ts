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
    "inline-flex flex-none gap-1 rounded-track bg-control p-1",
    size === "small" && "rounded-control p-0.5",
    extra,
  );
}

// The label again in the selected weight, invisible and flat (`after:`), so a segment is as wide chosen as not
// and nothing shifts when the choice moves. Segments carry `data-label` for it.
const ITEM = [
  "relative inline-flex min-h-segment flex-col items-center justify-center rounded-control px-4",
  "text-meta leading-tight font-regular whitespace-nowrap text-ink-2 no-underline",
  "transition-[background-color,color] duration-(--duration-fast) ease-out",
  "after:pointer-events-none after:invisible after:h-0 after:overflow-hidden after:font-semibold after:select-none after:content-[attr(data-label)]",
  "hover:bg-segment-hover hover:text-ink",
  "data-checked:bg-control-raised data-checked:font-semibold data-checked:text-ink data-checked:ring-1 data-checked:ring-hairline",
  "aria-selected:bg-control-raised aria-selected:font-semibold aria-selected:text-ink aria-selected:ring-1 aria-selected:ring-hairline",
  "aria-[current]:bg-control-raised aria-[current]:font-semibold aria-[current]:text-ink aria-[current]:ring-1 aria-[current]:ring-hairline",
  "max-md:min-h-10 max-md:before:absolute max-md:before:inset-x-0 max-md:before:inset-y-[calc((40px-var(--spacing-touch))/2)] max-md:before:content-['']",
].join(" ");

const SMALL_ITEM =
  "min-h-segment-small rounded-segment px-3 text-small max-md:px-3.5 max-md:before:inset-y-[calc((var(--spacing-segment-small)-var(--spacing-touch))/2)]";

export function segmentedItem(size: SegmentedSize = "regular", extra?: string): string {
  return cn(ITEM, size === "nav" && "px-4", size === "small" && SMALL_ITEM, extra);
}
