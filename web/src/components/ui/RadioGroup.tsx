import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ComponentProps } from "react";

/**
 * One choice from a few, one always chosen: Tab enters the group once, and the
 * arrow keys move and choose (base-ui rule 16). For a switch between ways of
 * showing one thing and for a choice kept only on the device (the Library's
 * Table / Covers, the theme). A picker that writes to the server on each
 * choice would need the guarded `ToggleGroup`.
 */
export interface RadioGroupProps<Value extends string> extends Omit<
  ComponentProps<typeof BaseRadioGroup>,
  "value" | "defaultValue" | "onValueChange"
> {
  value: Value;
  onChoose: (value: Value) => void;
}

export function RadioGroup<Value extends string>({ value, onChoose, ...props }: RadioGroupProps<Value>) {
  return <BaseRadioGroup<Value> {...props} value={value} onValueChange={(next) => onChoose(next)} />;
}

/** One option inside a `RadioGroup` (`value` is its name). Styled on `data-checked`. */
export const Radio = BaseRadio.Root;
