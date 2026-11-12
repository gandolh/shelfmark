import { buttonClass } from "../components/Button";

/**
 * A list tool (Views, Filter, Columns; "Filter and sort" and Views on a phone): an icon and its label in ink-2
 * with no fill, the control fill on hover, and the open menu button's teal wash while its menu or panel is open.
 */
const TOOL =
  "px-2.5 text-ink-2 hover:bg-control hover:text-ink aria-expanded:bg-accent-tint aria-expanded:font-semibold aria-expanded:text-accent-press max-md:px-2";

export function toolClass(extra?: string): string {
  return buttonClass({ variant: null, size: "regular" }, extra ? `${TOOL} ${extra}` : TOOL);
}
