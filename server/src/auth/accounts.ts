import { createAccounts, createSqliteStore, seedUsers, type Accounts } from "../../vendor/ward/ward-auth.js";
import type { Db } from "../db/open.js";

/**
 * Shelfmark's local accounts, on the vendored ward-auth library (brief 06).
 * Shelfmark is for one person and has no roles; the library keeps a role on
 * every user, and this is the only one. A user made by a first "Sign in with
 * Ward" gets it too (`app.ts`), whatever Ward's grant names.
 */
export const OWNER_ROLE = "owner";

/**
 * The accounts on the app's own database. The library migrates its own tables
 * (`auth_users`, `auth_sessions`, `auth_ward_links`, tracked in
 * `auth_migrations`) on this call, beside Shelfmark's; it never reads or sets
 * `PRAGMA user_version`, which is Shelfmark's (`db/migrations.ts`).
 */
export function openAccounts(db: Db): Accounts {
  return createAccounts({ store: createSqliteStore(db) });
}

/**
 * Create the owner, unless a user of that name (case-folded) exists, which is
 * then left exactly as it is: no password reset. True when it was created.
 * Throws the library's `UsernamePolicyError` or `PasswordPolicyError` (fewer
 * than 8 characters, say) for a value it won't store.
 */
export async function seedOwner(accounts: Accounts, owner: { username: string; password: string }): Promise<boolean> {
  const result = await seedUsers(accounts, [{ ...owner, role: OWNER_ROLE }]);
  return result.created.length > 0;
}
