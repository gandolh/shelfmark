import { useId, type InputHTMLAttributes, type Ref } from "react";
import { AlertIcon } from "./icons";

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  /** What is wrong with the value, under the field; marks it invalid. */
  error?: string;
  /** A quiet note under the field, when there is no error. */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A label over a filled field, in the vocabulary of the Add page's form
 * (`add/ManualForm.tsx`): the login page's fields and the password dialog's.
 */
export function AuthField({ label, error, hint, ref, ...input }: AuthFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-label leading-tight font-semibold text-muted" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        ref={ref}
        id={id}
        className="h-10.5 w-full appearance-none rounded-field bg-field px-3 text-input-phone text-ink focus-visible:outline-2 focus-visible:outline-offset-[0] focus-visible:outline-focus-ring aria-invalid:outline-[1.5px] aria-invalid:outline-offset-[-1.5px] aria-invalid:outline-ink-2 focus-visible:aria-invalid:outline-2 focus-visible:aria-invalid:outline-offset-[0] focus-visible:aria-invalid:outline-focus-ring"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {error !== undefined ? (
        <p
          id={noteId}
          className="flex items-start gap-1.5 text-small leading-tight font-semibold text-ink [&_svg]:-mt-0.25 [&_svg]:flex-none"
        >
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="text-small leading-tight text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
