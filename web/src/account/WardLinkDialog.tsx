import { useRef, useState, type FormEvent } from "react";
import { useSession } from "../../vendor/ward/ward-auth-react.js";
import { AuthField } from "../auth/Field";
import { AlertIcon } from "../auth/icons";
import { accountMessage } from "../auth/messages";
import "../auth/session";
import { Button } from "../components/Button";
import { Dialog, DialogActions } from "../components/ui/Dialog";
import { useIsDesktop } from "../layout/viewport";
import { AccountActionError, linkWard, unlinkWard } from "./actions";
import { openChangePassword } from "./ChangePassword";
import { dialogSwitch } from "./dialogSwitch";

/**
 * The account menu's "Sign in with Ward", link or unlink: a small dialog that
 * asks for the account's current password first (Ward's library requires it),
 * in the account dialog shell (`components/ui/Dialog.tsx`). A refusal stays
 * here, beside the field, which keeps focus. An account with no password yet is
 * sent to "Change password" instead: the server would answer `no_local_password`
 * whatever is typed.
 */

export type WardLinkMode = "link" | "unlink";

const linkDialog = dialogSwitch();
const unlinkDialog = dialogSwitch();

/** Show the link dialog (the account menu's action). Focus goes back to the account button on close. */
export function openWardLink(): void {
  linkDialog.show();
}

/** Show the unlink dialog (the account menu's action). */
export function openWardUnlink(): void {
  unlinkDialog.show();
}

/** Words for each mode: the title, what it does, and the button. */
const COPY: Record<WardLinkMode, { title: string; intro: string; button: string; pending: string }> = {
  link: {
    title: "Link Ward",
    intro: "Type your Shelfmark password to link a Ward account. Ward opens next, so you can sign in with it.",
    button: "Link Ward",
    pending: "Opening Ward…",
  },
  unlink: {
    title: "Unlink Ward",
    intro: "Type your Shelfmark password to unlink Ward. Your password still signs you in.",
    button: "Unlink Ward",
    pending: "Unlinking…",
  },
};

/** Codes that belong to the password field; any other refusal is the form's. */
const PASSWORD_CODES = new Set(["invalid_credentials", "invalid_request", "too_many_attempts"]);

/** Mount once inside the auth gate (`App.tsx`). Renders nothing while closed. */
export function WardLinkDialogs() {
  const linkOpen = linkDialog.useOpen();
  const unlinkOpen = unlinkDialog.useOpen();
  if (linkOpen) return <WardLinkDialog mode="link" source={linkDialog} />;
  if (unlinkOpen) return <WardLinkDialog mode="unlink" source={unlinkDialog} />;
  return null;
}

function WardLinkDialog({ mode, source }: { mode: WardLinkMode; source: ReturnType<typeof dialogSwitch> }) {
  const copy = COPY[mode];
  const desktop = useIsDesktop();
  const session = useSession();
  const hasPassword = session.status === "signed_in" ? session.user.hasPassword : true;
  const username = session.status === "signed_in" ? session.user.username : "";
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onClose = () => source.set(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (password === "") {
      setFailure({ code: "invalid_request", message: "Enter your current password." });
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setFailure(null);
    (mode === "link" ? linkWard : unlinkWard)(password).then(
      () => {
        // A link is on its way to Ward (the page leaves); an unlink is done.
        if (mode === "unlink") onClose();
      },
      (error: unknown) => {
        const code = error instanceof AccountActionError ? error.error.code : "unknown";
        const message = error instanceof Error ? error.message : accountMessage({ code: "unknown" });
        setPending(false);
        setFailure({ code, message });
        if (PASSWORD_CODES.has(code)) {
          setPassword("");
          inputRef.current?.focus();
        }
      },
    );
  };

  if (!hasPassword) {
    return (
      <Dialog title={copy.title} onClose={onClose} returnFocus={source.takeReturnFocus}>
        <div className="flex flex-col gap-4">
          <p className="text-body leading-body text-ink-2">{accountMessage({ code: "no_local_password" })}</p>
          <DialogActions desktop={desktop} onCancel={onClose}>
            <Button
              variant="primary"
              size={desktop ? "regular" : "large"}
              block={!desktop}
              data-autofocus
              onClick={() => {
                onClose();
                openChangePassword();
              }}
            >
              Set a password
            </Button>
          </DialogActions>
        </div>
      </Dialog>
    );
  }

  const aboutPassword = failure !== null && PASSWORD_CODES.has(failure.code);
  const blockError = failure !== null && !aboutPassword ? failure.message : null;

  return (
    <Dialog title={copy.title} onClose={onClose} returnFocus={source.takeReturnFocus} pending={pending}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <p className="text-body leading-body text-ink-2">{copy.intro}</p>
        <input
          className="sr-only"
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
        <AuthField
          ref={inputRef}
          label="Current password"
          type="password"
          autoComplete="current-password"
          data-autofocus
          value={password}
          error={aboutPassword ? failure.message : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            if (failure !== null) setFailure(null);
          }}
        />
        {blockError !== null && (
          <p
            className="flex items-start gap-2 rounded-control bg-field px-3 py-2.5 text-meta leading-tight font-semibold text-ink [&_svg]:-mt-0.25 [&_svg]:flex-none"
            role="alert"
          >
            <AlertIcon />
            <span className="min-w-0 flex-1">{blockError}</span>
          </p>
        )}
        <DialogActions desktop={desktop} onCancel={onClose}>
          <Button
            type="submit"
            variant="primary"
            size={desktop ? "regular" : "large"}
            block={!desktop}
            disabled={pending}
          >
            {pending ? copy.pending : copy.button}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
