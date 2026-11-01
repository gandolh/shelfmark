# Task 32: Change the username

## Context

Promoted 2026-10-24 from the todo [change-username](../../todos/change-username.md).
The owner chose to put the rename in the ward-auth library. It is built there as
0.4.0 (`wzd_auth`, brief 37, commit `22251c4`): `accounts.renameUser`,
`POST <routePrefix>/username` (guarded, on by default), `client.renameUser` and
`useRenameUser()`. A rename keeps the user id and every session, and the session
state carries the new name as soon as it resolves. The library's errors are
`invalid_username` (it accepts visible characters with single spaces between,
1 to 256 characters), `username_taken` (any case), and `too_many_attempts` (five
taken names from one address in 15 minutes).

Facts (checked 2026-10-24):

- Shelfmark keys nothing on the username. Books carry no owner
  ([decisions.md](../../wiki/decisions.md), one user), the Ward link is keyed by
  Ward's subject, and the lockout by address. So the route stays on.
- The seed (`server/src/seed.ts`) matches by name. Run again with the old name
  after a rename, it would create a second account.
- The account menu ([`web/src/layout/AccountMenu.tsx`](../../../web/src/layout/AccountMenu.tsx))
  does not show who is signed in anywhere.
- "Change password" is a Base UI `Dialog` in
  [`web/src/account/ChangePassword.tsx`](../../../web/src/account/ChangePassword.tsx),
  a centred panel on the desktop and a sheet on a phone. A second dialog should
  share that shell rather than copy it.

## Files you OWN

- `server/vendor/ward/`, `web/vendor/ward/`: re-vendored to 0.4.0
  (`npm run vendor -- ../shelfmark/<side>/vendor/ward` from `wzd_auth`)
- `server/src/app.test.ts`: the route is guarded and renames through the app
- `web/src/account/`: a `ChangeUsername.tsx` dialog, the shared dialog shell pulled
  out of `ChangePassword.tsx`, `actions.ts`, tests, `account.css`
- `web/src/auth/messages.ts`: words for `invalid_username` and `username_taken`
- `web/src/layout/AccountMenu.tsx`, `web/src/App.tsx`: the menu item and the dialog mount
- `docs/owner-setup.md`: the seed caveat

## Files you must NOT touch

- Any vendored file by hand. Only the vendor script writes them.
- `server/src/seed.ts`: it stays a create-if-missing seed.

## What to do

1. Re-vendor both copies, and check the server and web still typecheck.
2. Add **Change username** to the account menu, above Change password, with the
   current name as its detail, so the menu says who is signed in.
3. The dialog has one field, Username, filled with the current name and selected.
   It checks on the client: empty, and unchanged (a new case of the same name is a
   change). It sends through `useRenameUser`. The Done state names the new name
   and says a browser's saved password may still be under the old one.
4. Words for the two new codes in `accountMessage`, shown under the field.
5. A note in owner-setup: after a rename, give the seed the new name, or run it
   not at all.

## Acceptance

- Renaming `owner` to `Ana` from the menu: the menu's detail says `Ana` at once,
  signing out and in as `ana` works, `owner` no longer does, and the Library is
  unchanged.
- An empty name, the same name, and a name with two spaces in a row each get a
  message under the field and send nothing (the last one from the server).
- Change password still opens and works, on the desktop and on a phone.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-24)

Built as specified, inline (no agent), on ward-auth 0.4.0 (`wzd_auth`
`22251c4`, its brief 37), with these choices:

- Both vendored copies were re-vendored with the library's own script. A
  server test showed that a rename through the app keeps every session, signs
  in under the new name in any case, and refuses the old one. That test went
  the same day with the rest of the app-booting tests (decision "Only
  lightweight tests"); the route's own tests live in ward-auth.
- `account/AccountDialog.tsx` holds the shell both dialogs now share:
  `dialogSwitch()` for the open state kept outside React, `AccountDialog` for
  the Base UI panel or sheet, and `Actions`. The CSS classes went from
  `password-dialog*` to `account-dialog*`.
- **One fix on the way:** after a successful save the form unmounted and focus
  fell to the panel, because `data-autofocus` only counts when the dialog
  opens. Change password had the same gap. Both Done buttons now take
  `autoFocus`.
- Menu details are cut with an ellipsis past 20em, so a long name doesn't
  widen the menu ("Goodreads, Libib, spreadsheet" still fits).
- Checked: typecheck, lint, build, the tests, and a browser walk at 1280 and 390 px on a scratch database. The walk
  covered: the menu showing `owner`; the field selected on open; the unchanged,
  empty and double-space refusals under the field; renames to `Ana`, then
  `Anna`, with the menu updated at once and after a reload; only `anna`
  signing in; focus back on the account button after Done; and a real
  password change on the phone sheet.
