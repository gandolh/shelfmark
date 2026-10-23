import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { isApiError } from "../api";
import { AuthField } from "../auth/Field";
import { AlertIcon } from "../auth/icons";
import { Button } from "../components/Button";
import { NAME_TAKEN } from "./savedViewsStore";
import "../auth/auth.css";

/**
 * The Views menu's dialogs (brief 27): name a view (save, rename) and
 * confirm a delete. A modal Base UI `Dialog`, as Change password is: a white
 * panel in the middle of the window on the desktop, the floating sheet over
 * the bottom of a phone. A name another view has is said under the field
 * (the server's `409`); any other failure under the form.
 */

/** As the server allows (shared/src/views.ts). */
const NAME_MAX = 80;

interface FrameProps {
  title: string;
  desktop: boolean;
  /** Where focus goes back to on close: the Views button. */
  returnFocus: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}

function Frame({ title, desktop, returnFocus, onClose, children }: FrameProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open
      onOpenChange={(next, details) => {
        // Esc, and a press on the backdrop, close it; an Esc a field already used doesn't.
        if (!next && !(details.reason === "escape-key" && details.event.defaultPrevented)) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="library-dialog-backdrop" />
        <Dialog.Popup
          ref={popupRef}
          className={desktop ? "library-dialog library-dialog--centered" : "library-dialog library-dialog--sheet"}
          initialFocus={() => popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? true}
          finalFocus={() => (returnFocus?.isConnected ? returnFocus : true)}
        >
          <div className="library-dialog__frame">
            <Dialog.Title className="library-dialog__title">{title}</Dialog.Title>
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Cancel and the action: on the desktop a row on the right, the action last; on a phone the action on top, full width. */
function Actions({ desktop, cancel, onCancel, children }: { desktop: boolean; cancel: string; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="library-dialog__actions">
      <Button variant="quiet" size={desktop ? "regular" : "large"} block={!desktop} onClick={onCancel}>
        {cancel}
      </Button>
      {children}
    </div>
  );
}

function Failure({ children }: { children: string }) {
  return (
    <p className="auth-error" role="alert">
      <AlertIcon />
      <span className="auth-error__text">{children}</span>
    </p>
  );
}

function messageOf(error: unknown, fallback: string): string {
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
export function NameDialog({ title, intro, submitLabel, initialName = "", desktop, returnFocus, onSubmit, onClose }: NameDialogProps) {
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
    <Frame title={title} desktop={desktop} returnFocus={returnFocus} onClose={onClose}>
      <form className="library-dialog__form" onSubmit={submit} noValidate>
        {intro && <p className="library-dialog__text">{intro}</p>}
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
        {failure !== null && <Failure>{failure}</Failure>}
        <Actions desktop={desktop} cancel="Cancel" onCancel={onClose}>
          <Button type="submit" variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </Actions>
      </form>
    </Frame>
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
    <Frame title={`Delete “${name}”?`} desktop={desktop} returnFocus={returnFocus} onClose={onClose}>
      <div className="library-dialog__form">
        <p className="library-dialog__text">
          Only the saved view goes, on every device. Your books, and what the Library shows now, stay as they are.
        </p>
        {failure !== null && <Failure>{failure}</Failure>}
        <Actions desktop={desktop} cancel="Keep it" onCancel={onClose}>
          <Button variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending} data-autofocus onClick={confirm}>
            {pending ? "Deleting…" : "Delete view"}
          </Button>
        </Actions>
      </div>
    </Frame>
  );
}
