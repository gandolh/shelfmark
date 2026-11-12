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
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-muted text-label font-semibold leading-tight" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        ref={ref}
        id={id}
        className="w-full h-10.5 px-3 rounded-field bg-field text-ink text-input-phone appearance-none focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[0] aria-invalid:outline-[1.5px] aria-invalid:outline-ink-2 aria-invalid:outline-offset-[-1.5px] focus-visible:aria-invalid:outline-2 focus-visible:aria-invalid:outline-focus-ring focus-visible:aria-invalid:outline-offset-[0]"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {error !== undefined ? (
        <p
          id={noteId}
          className="flex items-start gap-1.5 text-ink text-small font-semibold leading-tight [&_svg]:flex-none [&_svg]:-mt-0.25"
        >
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="text-muted text-small leading-tight">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
