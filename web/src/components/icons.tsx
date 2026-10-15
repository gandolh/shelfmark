import type { ReactNode, SVGProps } from "react";

/**
 * The app's icons, drawn on a 24-unit grid in one stroke (1.9, round caps),
 * coloured by `currentColor`. Decorative: the control around each one
 * carries the name.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 24, strokeWidth = 1.9, ...rest }: IconProps & { children: ReactNode }) {
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
    />
  );
}

/** A closed book: the Library tab. */
export function LibraryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10" />
    </Icon>
  );
}

/** A plus in a circle: the Add a book tab. */
export function AddIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </Icon>
  );
}

/** A head and shoulders: the account button. */
export function AccountIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

/** A small cross, for clearing a field. */
export function ClearIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="M7.5 7.5l9 9M16.5 7.5l-9 9" />
    </Icon>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="M5 12l5 5 9-10" />
    </Icon>
  );
}
