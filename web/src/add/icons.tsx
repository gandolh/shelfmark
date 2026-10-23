import type { ReactNode, SVGProps } from "react";

/**
 * Add a book's own icons, drawn like components/icons.tsx (24-unit grid, one
 * 1.9 stroke, round caps, `currentColor`, decorative). Kept here because the
 * shared file is the shell's; promote them if another page needs one.
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

/** A camera body: "Take a photo of the front". */
export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8.5a2 2 0 0 1 2-2h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </Icon>
  );
}

/** A torch, lit or not: the scanner's torch button. */
export function TorchIcon({ on, ...props }: IconProps & { on?: boolean }) {
  return (
    <Icon {...props}>
      <path d="M8 3h8v3.5l-2 3V20a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9.5l-2-3z" fill={on ? "currentColor" : "none"} />
      <path d="M8 6.5h8" />
      {!on && <path d="M12 12.5v2.5" />}
    </Icon>
  );
}

/** A circled exclamation mark: what is wrong with a field, or why a save failed. There is no danger colour. */
export function AlertIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.9" />
      <path d="M12 16.2h.01" strokeWidth={2.6} />
    </Icon>
  );
}

/** A plus, for "New shelf". */
export function PlusIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.1} {...props}>
      <path d="M12 6v12M6 12h12" />
    </Icon>
  );
}

/** The bars of a barcode: "This barcode isn't an ISBN". */
export function BarcodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6v12M8 6v12M11.5 6v12M15 6v12M18.5 6v12" />
    </Icon>
  );
}

/** A page with lines of text in a frame's corners: "Read the CIP block". */
export function TextScanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </Icon>
  );
}
