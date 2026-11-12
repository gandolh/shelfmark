import { cn } from "../lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

/** The floating card over the stage: the scan result, the update prompt. */
export const SHEET =
  "absolute right-3 bottom-3 left-3 z-bar mx-auto flex max-h-[calc(100%-24px)] max-w-110 flex-col gap-3.5 overflow-y-auto rounded-sheet bg-surface p-4 text-ink shadow-float motion-safe:animate-sheet-in";

export interface SheetProps extends HTMLAttributes<HTMLElement> {
  /** Names the sheet for screen readers ("Already in your library"), unless `aria-labelledby` points at its heading. */
  label?: string;
  children: ReactNode;
}

/**
 * The floating white sheet: a scan's result over the camera (design.md, the
 * `Covers-Add` mock-up). 20 px corners, 12 px off the edges of its
 * positioned parent, at the bottom, at most 440 px wide; it rises in when
 * it appears. Not modal: what is behind it stays on screen.
 */
export function Sheet({ label, className, children, ...rest }: SheetProps) {
  return (
    <section aria-label={label} {...rest} className={cn(SHEET, className)}>
      {children}
    </section>
  );
}
