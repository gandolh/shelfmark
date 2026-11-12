import { DialogActions, Dialog } from "../components/ui/Dialog";
import { Radio, RadioGroup } from "../components/ui/RadioGroup";
import { useIsDesktop } from "../layout/viewport";
import { setTheme, THEMES, useTheme } from "../theme/theme";
import { dialogSwitch } from "./dialogSwitch";

/**
 * The account menu's "Theme": Light, Dark or System, in a dialog on the shared
 * `Dialog` wrapper. The choice is kept on this device only (theme/theme.ts), so
 * it is a `RadioGroup`: one Tab stop, the arrows move and choose, and the page
 * changes as it does. Light is the choice on a first visit.
 */

const themeDialog = dialogSwitch();

/** Show the dialog (the account menu's action). Focus goes back to the account button on close. */
export function openTheme(): void {
  themeDialog.show();
}

/** Mount once inside the auth gate (`App.tsx`). Renders nothing while closed. */
export function ThemeDialog() {
  if (!themeDialog.useOpen()) return null;
  return <ThemePicker onClose={() => themeDialog.set(false)} />;
}

function ThemePicker({ onClose }: { onClose: () => void }) {
  const desktop = useIsDesktop();
  const theme = useTheme();
  return (
    <Dialog title="Theme" onClose={onClose} returnFocus={themeDialog.takeReturnFocus}>
      <RadioGroup<typeof theme> aria-label="Theme" value={theme} onChoose={setTheme} className="flex flex-col gap-1">
        {THEMES.map((option) => (
          <label
            key={option.value}
            className="flex min-h-touch items-center gap-3 rounded-control px-2 text-body text-ink md:min-h-control"
          >
            <Radio
              value={option.value}
              className="flex size-5 flex-none items-center justify-center rounded-pill border-2 border-muted bg-surface data-checked:border-accent data-checked:bg-accent data-checked:before:size-2 data-checked:before:rounded-pill data-checked:before:bg-on-accent data-checked:before:content-['']"
            />
            {option.label}
          </label>
        ))}
      </RadioGroup>
      <DialogActions desktop={desktop} cancel="Done" onCancel={onClose} />
    </Dialog>
  );
}
