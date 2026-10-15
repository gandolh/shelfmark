import { ChangePasswordDialog } from "./account/ChangePassword";
import { AuthGate } from "./auth/AuthGate";
import { AppShell } from "./layout/AppShell";
import { OfflineNotice } from "./pwa/OfflineNotice";
import { UpdatePrompt } from "./pwa/UpdatePrompt";

/**
 * The app: signed out, the login page (the auth gate's); signed in, the shell,
 * and the account menu's password dialog, closed until asked for. The offline
 * notice and the update prompt sit outside the gate: the login page needs them too.
 */
export function App() {
  return (
    <>
      <AuthGate>
        <AppShell />
        <ChangePasswordDialog />
      </AuthGate>
      <OfflineNotice />
      <UpdatePrompt />
    </>
  );
}
