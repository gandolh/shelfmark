import type { HTMLAttributes, ReactNode } from "react";

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
    <section aria-label={label} {...rest} className={["sheet", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
