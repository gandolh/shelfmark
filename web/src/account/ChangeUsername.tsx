import { useRef, useState, type FormEvent } from "react";
import { useRenameUser, useSession, type AuthError } from "../../vendor/ward/ward-auth-react.js";
import { AuthField } from "../auth/Field";
import { AlertIcon } from "../auth/icons";
import { accountMessage } from "../auth/messages";
// The hooks below need the client set up; the session module does that when it loads.
import "../auth/session";
import { Button } from "../components/Button";
import { useIsDesktop } from "../layout/viewport";
import { Dialog, DialogActions } from "../components/ui/Dialog";
import { dialogSwitch } from "./dialogSwitch";

/**
 * The account menu's "Change username", in the account dialog
 * shell (`components/ui/Dialog.tsx`). One field, holding the current name and
 * selected, so typing replaces it. The rename is ward-auth's (0.4.0): the
 * user id and every session stay, and the session, the menu included, carries
 * the new name as soon as it is saved.
 */

const usernameDialog = dialogSwitch();

/** Show the dialog (the account menu's action). Focus goes back to what had it, the account button, on close. */
export function openChangeUsername(): void {
  usernameDialog.show();
}

// --- Checking the name before it is sent -------------------------------------------

/**
 * What is wrong with the new name, or undefined when it can be sent. The rest
 * (two spaces in a row, a name someone has) is the server's to say. A new case
 * of the same name is a change: it is how the name is shown.
 */
export function checkUsername(next: string, current: string): string | undefined {
  const name = next.trim();
  if (name === "") return "Enter a username.";
  if (name === current) return "That's already your username.";
  return undefined;
}

/** The server's answers that are about the name, shown under the field; anything else is the form's. */
const NAME_CODES = new Set(["invalid_username", "username_taken"]);

// --- The dialog --------------------------------------------------------------------

/** Mount once inside the auth gate (`App.tsx`). Renders nothing while closed. */
export function ChangeUsernameDialog() {
  if (!usernameDialog.useOpen()) return null;
  return <UsernameDialog onClose={() => usernameDialog.set(false)} />;
}

function UsernameDialog({ onClose }: { onClose: () => void }) {
  const desktop = useIsDesktop();
  const session = useSession();
  const username = session.status === "signed_in" ? session.user.username : "";
  const rename = useRenameUser();

  return (
    <Dialog
      title={rename.done ? "Username changed" : "Change username"}
      onClose={onClose}
      returnFocus={usernameDialog.takeReturnFocus}
      pending={rename.pending}
    >
      {rename.done ? (
        <Done username={username} desktop={desktop} onClose={onClose} />
      ) : (
        <UsernameForm
          current={username}
          pending={rename.pending}
          failure={rename.error}
          desktop={desktop}
          onSubmit={rename.renameUser}
          onEdit={rename.reset}
          onCancel={onClose}
        />
      )}
    </Dialog>
  );
}

interface UsernameFormProps {
  current: string;
  pending: boolean;
  failure: AuthError | null;
  desktop: boolean;
  /** Resolves true when the name was saved. */
  onSubmit: (username: string) => Promise<boolean>;
  /** The field changed: the last failure no longer applies. */
  onEdit: () => void;
  onCancel: () => void;
}

function UsernameForm({ current, pending, failure, desktop, onSubmit, onEdit, onCancel }: UsernameFormProps) {
  const [name, setName] = useState(current);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const fieldRef = useRef<HTMLInputElement>(null);
  const selected = useRef(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const found = checkUsername(name, current);
    setProblem(found);
    if (found !== undefined) {
      fieldRef.current?.focus();
      return;
    }
    void onSubmit(name.trim()).then((saved) => {
      if (!saved) fieldRef.current?.focus();
    });
  };

  const aboutName = failure !== null && NAME_CODES.has(failure.code);
  const fieldError = problem ?? (failure !== null && aboutName ? accountMessage(failure) : undefined);
  const blockFailure = failure !== null && !aboutName ? accountMessage(failure) : null;

  return (
    <form className="library-dialog__form" onSubmit={submit} noValidate>
      <AuthField
        ref={fieldRef}
        label="Username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        data-autofocus
        value={name}
        error={fieldError}
        hint="You sign in with it. Capital letters don't matter there."
        // The first focus selects the name, so typing replaces it; later ones leave the caret be.
        onFocus={(event) => {
          if (selected.current) return;
          selected.current = true;
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setName(event.target.value);
          setProblem(undefined);
          onEdit();
        }}
      />
      {blockFailure !== null && (
        <p className="auth-error" role="alert">
          <AlertIcon />
          <span className="auth-error__text">{blockFailure}</span>
        </p>
      )}
      <DialogActions desktop={desktop} onCancel={onCancel}>
        <Button
          type="submit"
          variant="primary"
          size={desktop ? "regular" : "large"}
          block={!desktop}
          disabled={pending}
        >
          {pending ? "Saving…" : "Change username"}
        </Button>
      </DialogActions>
    </form>
  );
}

function Done({ username, desktop, onClose }: { username: string; desktop: boolean; onClose: () => void }) {
  return (
    <div className="library-dialog__form">
      <p className="library-dialog__text" role="status">
        You're now <strong>{username}</strong>. Sign in with that name from now on; you're still signed in everywhere.
        If your browser saved your password, it may still list it under the old name.
      </p>
      <div className="library-dialog__actions">
        <Button variant="primary" size={desktop ? "regular" : "large"} block={!desktop} autoFocus onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
