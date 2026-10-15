import type { ReactNode, SVGProps } from "react";

/**
 * The Library's own small marks, drawn like components/icons.tsx (24-unit
 * grid, one round stroke, `currentColor`, decorative). Candidates for that
 * file once another page needs them.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 16, strokeWidth = 2, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** A row that leads somewhere: the filter list's columns. */
export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 5.5L16 12l-6.5 6.5" />
    </Icon>
  );
}

/** Opens downwards: the sort select. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </Icon>
  );
}

/** A sorted column's direction: up for A to Z, down for Z to A. */
export function SortIcon({ desc, ...props }: IconProps & { desc: boolean }) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      {desc ? <path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" /> : <path d="M12 19V5M6.5 10.5L12 5l5.5 5.5" />}
    </Icon>
  );
}

export function MoveUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 14.5L12 9l5.5 5.5" />
    </Icon>
  );
}

export function MoveDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 9.5L12 15l5.5-5.5" />
    </Icon>
  );
}
