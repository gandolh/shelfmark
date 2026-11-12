import { useRef, useState, type FormEvent } from "react";
import { isApiError } from "../api";
import { AuthField } from "../auth/Field";
import { AlertIcon } from "../auth/icons";
import { Button } from "../components/Button";
import { Dialog, DialogActions } from "../components/ui/Dialog";
import { NAME_TAKEN } from "./savedViewsStore";

/**
 * The Views menu's dialogs: name a view (save, rename) and
 * confirm a delete. A modal Base UI `Dialog`, as Change password is: a white
 * panel in the middle of the window on the desktop, the floating sheet over
 * the bottom of a phone. A name another view has is said under the field
 * (the server's `409`); any other failure under the form. The bulk bar's
 * dialogs (BulkDialogs.tsx) are built from the same `Dialog` wrapper,
 * `DialogActions` and `DialogFailure`.
 */

/** As the server allows (shared/src/views.ts). */
const NAME_MAX = 80;

export function DialogFailure({ children }: { children: string }) {
  return (
    <p
      className="flex items-start gap-2 rounded-control bg-field px-3 py-2.5 text-meta leading-tight font-semibold text-ink [&_svg]:-mt-0.25 [&_svg]:flex-none"
      role="alert"
    >
      <AlertIcon />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

export function messageOf(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}

export interface NameDialogProps {
  title: string;
  /** A line under the title: what saving keeps. */
  intro?: string;
  submitLabel: string;
  /** The name already there (rename); empty for a new view. */
  initialName?: string;
  desktop: boolean;
  returnFocus: HTMLElement | null;
  /** Saves under the trimmed name; rejects with the server's `ApiError`. Closes when it resolves. */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

/** "Save current view…" and "Rename…": one name field. */
export function NameDialog({
  title,
  intro,
  submitLabel,
  initialName = "",
  desktop,
  returnFocus,
  onSubmit,
  onClose,
}: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = name.trim();
    if (trimmed === "") {
      setFieldError("Give the view a name.");
      input.current?.focus();
      return;
    }
    if (trimmed === initialName) {
      onClose();
      return;
    }
    setPending(true);
    setFailure(null);
    onSubmit(trimmed).then(
      () => onClose(),
      (error: unknown) => {
        setPending(false);
        if (isApiError(error, NAME_TAKEN)) {
          setFieldError(`${error.message} Choose another name.`);
          input.current?.focus();
        } else {
          setFailure(messageOf(error, "The view wasn't saved. Try again."));
        }
      },
    );
  };

  return (
    <Dialog title={title} returnFocus={returnFocus} onClose={onClose} pending={pending}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {intro && <p className="text-body leading-body text-ink-2">{intro}</p>}
        <AuthField
          ref={input}
          label="Name"
          data-autofocus
          autoComplete="off"
          enterKeyHint="done"
          maxLength={NAME_MAX}
          placeholder="Unread, living room"
          value={name}
          error={fieldError}
          onChange={(event) => {
            setName(event.target.value);
            setFieldError(undefined);
          }}
        />
        {failure !== null && <DialogFailure>{failure}</DialogFailure>}
        <DialogActions desktop={desktop} cancel="Cancel" onCancel={onClose}>
          <Button
            type="submit"
            variant="primary"
            size={desktop ? "regular" : "large"}
            block={!desktop}
            disabled={pending}
          >
            {pending ? "Saving…" : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export interface DeleteViewDialogProps {
  name: string;
  desktop: boolean;
  returnFocus: HTMLElement | null;
  /** Rejects with the server's `ApiError`. Closes when it resolves. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** "Delete…": asks first, naming the view. Only the view goes; the books stay. */
export function DeleteViewDialog({ name, desktop, returnFocus, onConfirm, onClose }: DeleteViewDialogProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const confirm = () => {
    if (pending) return;
    setPending(true);
    setFailure(null);
    onConfirm().then(
      () => onClose(),
      (error: unknown) => {
        setPending(false);
        setFailure(messageOf(error, "The view wasn't deleted. Try again."));
      },
    );
  };

  return (
    <Dialog title={`Delete “${name}”?`} returnFocus={returnFocus} onClose={onClose} pending={pending}>
      <div className="flex flex-col gap-4">
        <p className="text-body leading-body text-ink-2">
          Only the saved view goes, on every device. Your books, and what the Library shows now, stay as they are.
        </p>
        {failure !== null && <DialogFailure>{failure}</DialogFailure>}
        <DialogActions desktop={desktop} cancel="Keep it" onCancel={onClose}>
          <Button
            variant="primary"
            size={desktop ? "regular" : "large"}
            block={!desktop}
            disabled={pending}
            data-autofocus
            onClick={confirm}
          >
            {pending ? "Deleting…" : "Delete view"}
          </Button>
        </DialogActions>
      </div>
    </Dialog>
  );
}
