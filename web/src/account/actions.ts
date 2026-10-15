/**
 * What the account menu (layout/AccountMenu.tsx) does. Stubs for now: brief
 * 06 fills in the password, Ward and sign-out actions, brief 11 the backup.
 * Each action resolves when done; a rejection's `message` is shown to the
 * owner under the account button, so it should say what went wrong and what
 * to do. An action that opens its own dialog resolves once it has opened it.
 */

/** Thrown by an action that isn't built yet. */
export class NotYet extends Error {
  constructor(what: string) {
    super(`Not yet: ${what}`);
    this.name = "NotYet";
  }
}

/** Whether "Sign in with Ward" is offered (the server has the WARD_OIDC_* settings) and linked to this account. */
export interface WardLink {
  available: boolean;
  linked: boolean;
}

/** The Ward state for the menu. Brief 06 reads it from the session. */
export function useWardLink(): WardLink {
  return { available: true, linked: false };
}

/** Open the change-password dialog (brief 06). */
export async function changePassword(): Promise<void> {
  throw new NotYet("changing the password comes with sign-in.");
}

/** Link this account to Ward, so "Sign in with Ward" works (brief 06). */
export async function linkWard(): Promise<void> {
  throw new NotYet("Sign in with Ward comes with sign-in.");
}

/** Unlink Ward from this account; the password still signs in (brief 06). */
export async function unlinkWard(): Promise<void> {
  throw new NotYet("Sign in with Ward comes with sign-in.");
}

/** Download the whole database, the SQLite file, as a backup (brief 11). */
export async function downloadBackup(): Promise<void> {
  throw new NotYet("backups come with export.");
}

/** End the session and show the login page (brief 06). */
export async function signOut(): Promise<void> {
  throw new NotYet("signing out comes with sign-in.");
}
