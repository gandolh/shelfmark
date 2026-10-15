import { useRef, type KeyboardEvent } from "react";
import type { Mode } from "./flow";

export const MODES: readonly { value: Mode; label: string }[] = [
  { value: "scan", label: "Scan" },
  { value: "isbn", label: "Type ISBN" },
  { value: "manual", label: "By hand" },
];

export interface ModeSwitchProps {
  value: Mode;
  /** `viaKeyboard`: chosen with the arrow keys, so focus stays on the tabs. */
  onChange: (mode: Mode, viaKeyboard: boolean) => void;
  /** The panel the tabs control, and the prefix of the tabs' own ids. */
  panelId: string;
  /** Over the camera: the track on a translucent ground instead of the flat fill. */
  overCamera?: boolean;
}

/** The id of a mode's tab, for the panel's `aria-labelledby`. */
export function modeTabId(panelId: string, mode: Mode): string {
  return `${panelId}-${mode}`;
}

/**
 * Scan, Type ISBN, By hand: the segmented track of the world, as tabs (the
 * page shows one way of adding at a time). ← → Home End move between them;
 * switching is React state, never a route, so the camera's page never
 * navigates.
 */
export function ModeSwitch({ value, onChange, panelId, overCamera }: ModeSwitchProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = MODES.findIndex((mode) => mode.value === value);
    const last = MODES.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % MODES.length
        : event.key === "ArrowLeft"
          ? (index + last) % MODES.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const mode = MODES[next];
    if (!mode) return;
    onChange(mode.value, true);
    tabs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="How to add the book"
      className={["segmented", "add-modes", overCamera ? "add-modes--over-camera" : null].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {MODES.map((mode, index) => {
        const selected = mode.value === value;
        return (
          <button
            key={mode.value}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={modeTabId(panelId, mode.value)}
            className="segmented__item"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            data-label={mode.label}
            onClick={() => {
              if (!selected) onChange(mode.value, false);
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
