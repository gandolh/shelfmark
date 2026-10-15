import { ChangePasswordDialog } from "./account/ChangePassword";
import { AuthGate } from "./auth/AuthGate";
import { AppShell } from "./layout/AppShell";

/**
 * The app: signed out, the login page (the auth gate's); signed in, the shell,
 * and the account menu's password dialog, closed until asked for.
 */
export function App() {
  return (
    <AuthGate>
      <AppShell />
      <ChangePasswordDialog />
    </AuthGate>
  );
}
