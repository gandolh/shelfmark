import { useSession, useWardResult, type SessionState } from "../../vendor/ward/ward-auth-react.js";
import { apiUrl } from "../api";
import { accountMessage } from "../auth/messages";
import { authClient } from "../auth/session";
import { clearLibraryCopy } from "../offline/library";
import { COVER_CACHE } from "../pwa/routes";
import { LOGIN, pathFor } from "../router";
import { openChangePassword } from "./ChangePassword";

/**
 * What the account menu (layout/AccountMenu.tsx) does. Each action resolves
 * when done; a rejection's `message` is shown to the owner under the account
 * button, so it says what went wrong and what to do. An action that opens its
 * own dialog resolves once it has opened it. The backup is brief 11's.
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

/** The menu's Ward row, from a session state: nothing to offer unless signed in to a server with Ward. */
export function wardLinkOf(state: SessionState): WardLink {
  return state.status === "signed_in"
    ? { available: state.ward.enabled, linked: state.ward.linked }
    : { available: false, linked: false };
}

/** The Ward state for the menu, from the session. */
export function useWardLink(): WardLink {
  return wardLinkOf(useSession());
}

/** Open the change-password dialog (account/ChangePassword.tsx). */
export async function changePassword(): Promise<void> {
  openChangePassword();
}

/**
 * Link this account to a Ward account, so "Sign in with Ward" works: off to
 * Ward, which comes back to the Library with the result (`useWardNotice`).
 * Rejects only when it couldn't get to Ward.
 */
export async function linkWard(): Promise<void> {
  const result = await authClient().startWardLink();
  if (!result.ok) throw new Error(accountMessage(result.error));
}

/**
 * Unlink Ward from this account; the password still signs in. Refused until
 * the account has a password. A session that began with Ward ends with it,
 * and then the login page loads afresh, as on signing out.
 */
export async function unlinkWard(): Promise<void> {
  const client = authClient();
  const result = await client.unlinkWard();
  if (!result.ok) throw new Error(accountMessage(result.error));
  if (client.getState().status === "signed_out") window.location.replace(pathFor(LOGIN));
}

/**
 * Download the whole database, the SQLite file, as a backup. Fetched rather
 * than navigated to, so a signed-out session (401) takes the same road as any
 * other call and a failure reaches the menu as a message. The file's name is
 * the server's (`shelfmark-<date>.db`).
 */
export async function downloadBackup(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/backup"), { credentials: "same-origin" });
  } catch {
    throw new Error("The backup could not be downloaded. Check the connection and try again.");
  }
  if (response.status === 401) {
    window.location.replace(pathFor(LOGIN));
    throw new Error("You are signed out. Sign in and try again.");
  }
  if (!response.ok) throw new Error("The backup could not be made. Try again.");

  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "shelfmark.db";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * End the session, then load the login page afresh, so nothing of the
 * library (the book list, the covers) stays in the page's memory. Signs out
 * of Shelfmark only; a Ward session stays signed in at Ward.
 */
export async function signOut(): Promise<void> {
  const result = await authClient().logout();
  if (!result.ok) throw new Error(accountMessage(result.error));
  // The worker serves cached covers with no session; drop them, but never let
  // a storage failure keep the owner signed in.
  try {
    if (typeof caches !== "undefined") await caches.delete(COVER_CACHE.name);
  } catch {
    // Nothing to do: the reload below still ends the session's page.
  }
  // The device's offline copy of the library goes too (it never rejects).
  await clearLibraryCopy();
  window.location.replace(pathFor(LOGIN));
}

/**
 * What a Ward round trip that landed on this page has to say, for the account
 * notice: a link made, or why a link or a confirmation failed (`failed`).
 * Empty when there is nothing; a confirmation that worked is the password
 * dialog's. `clear` dismisses it for good.
 */
export function useWardNotice(): { message: string; failed: boolean; clear: () => void } {
  const { result, error, clear } = useWardResult();
  if (error !== undefined) return { message: accountMessage(error), failed: true, clear };
  const message = result === "linked" ? "Ward is linked. You can sign in with Ward now." : "";
  return { message, failed: false, clear };
}
