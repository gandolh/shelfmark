import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../lib/cn";
import { Link, type LinkProps } from "./Link";

/**
 * The three buttons of the world (design.md):
 *
 * - `primary`: the accent pill, one per view ("Add a book", "Save and scan the next one").
 * - `secondary`: a flat fill on `control` ("Filter", "Add another copy"); `pill` rounds it fully.
 * - `quiet`: accent text, no fill ("Filter and sort").
 *
 * Sizes: `regular` is 34 px on the desktop and 44 px on a phone; `large` is
 * 48 px everywhere (a sheet's primary action); `compact` stays 34 px and
 * keeps a 44 px target on a phone with an invisible margin, for toolbar rows.
 */
export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "compact" | "regular" | "large";

interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fully round ends for a secondary button (the primary always has them). */
  pill?: boolean;
  /** Drawn before the label. */
  icon?: ReactNode;
  /** Take the whole width of the row. */
  block?: boolean;
}

const BASE = [
  "relative inline-flex min-h-control flex-none items-center justify-center gap-1.5 rounded-control px-3",
  "text-center text-meta leading-tight font-regular whitespace-nowrap text-ink no-underline select-none",
  "transition-[background-color,color] duration-(--duration-fast) ease-out",
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
  "[&_svg]:flex-none",
].join(" ");

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent px-4 font-semibold text-on-accent hover:bg-accent-press hover:text-on-accent active:bg-accent-press active:text-on-accent",
  secondary:
    "bg-control text-ink hover:bg-control-hover hover:text-ink active:bg-control-press aria-expanded:bg-accent-tint aria-expanded:font-semibold aria-expanded:text-accent-press",
  quiet: "px-1 text-body text-accent hover:text-accent-press active:text-accent-press",
};

// A compact button keeps its 34 px look and gets a 44 px target on a phone.
const SIZE: Record<ButtonSize, string> = {
  regular: "max-md:min-h-touch max-md:px-4.5 max-md:text-body",
  compact:
    "max-md:before:absolute max-md:before:inset-x-0 max-md:before:inset-y-[calc((var(--spacing-control)-var(--spacing-touch))/2)] max-md:before:content-['']",
  large: "min-h-control-large px-6 text-action-large font-semibold",
};

/** The classes of a button, for a control that is not a `Button` (a Base UI trigger). `variant: null` is no variant. */
export function buttonClass(
  {
    variant = "secondary",
    size = "regular",
    pill,
    block,
  }: Omit<ButtonLook, "variant"> & { variant?: ButtonVariant | null },
  extra?: string,
): string {
  return cn(
    BASE,
    (pill || variant === "primary") && "rounded-pill",
    block && "flex w-full flex-[1_1_auto]",
    variant && VARIANT[variant],
    SIZE[size],
    variant === "quiet" && size === "regular" && "max-md:px-1",
    extra,
  );
}

export interface ButtonProps extends ButtonLook, ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
}

/** A real `<button>`, `type="button"` unless a form asks for `submit`. */
export function Button({
  variant,
  size,
  pill,
  icon,
  block,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={buttonClass({ variant, size, pill, block }, className)}>
      {icon}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends ButtonLook, LinkProps {}

/** An in-app link that looks like a button ("Add a book", "Open the book"). */
export function ButtonLink({ variant, size, pill, icon, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={buttonClass({ variant, size, pill, block }, className)}>
      {icon}
      {children}
    </Link>
  );
}
