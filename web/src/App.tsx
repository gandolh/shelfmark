import { ChangePasswordDialog } from "./account/ChangePassword";
import { ChangeUsernameDialog } from "./account/ChangeUsername";
import { AuthGate } from "./auth/AuthGate";
import { ToastHost } from "./components/ui/Toast";
import { AppShell } from "./layout/AppShell";
import { OfflineNotice } from "./pwa/OfflineNotice";
import { UpdatePrompt } from "./pwa/UpdatePrompt";

/**
 * The app: signed out, the login page (the auth gate's); signed in, the shell,
 * and the account menu's username and password dialogs, closed until asked for. The offline
 * notice and the update prompt sit outside the gate: the login page needs them too.
 */
export function App() {
  return (
    <>
      <AuthGate>
        <AppShell />
        <ChangeUsernameDialog />
        <ChangePasswordDialog />
      </AuthGate>
      <OfflineNotice />
      {/* The host first: a toast raised before it mounts is lost. */}
      <ToastHost />
      <UpdatePrompt />
    </>
  );
}
