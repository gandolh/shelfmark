# Task 27: Saved views

## Context

Promoted 2026-10-23 from the todo [saved-views](../../todos/saved-views.md) (v1.x in
[features.md](../../wiki/features.md)).

Save the table's current filters, sort and columns under a name ("Unread", "Unread,
living room") on the server, so they follow the owner across devices. Today the
column layout and sort are remembered per layout in `localStorage`
([`web/src/library/prefs.ts`](../../../web/src/library/prefs.ts), `LibraryPrefs`,
"a convenience; losing it costs nothing"), and the filters live in the page state
([`state.ts`](../../../web/src/library/state.ts), [`filters.ts`](../../../web/src/library/filters.ts)).

## Files you OWN

- `server/src/db/migrations.ts` (a **new** migration at the end: `saved_views`
  with `id`, `name` unique, `state` JSON text, `position`, timestamps)
- `server/src/store/` (a `views.ts` module and its test), `server/src/routes/`
  (a `views.ts` route file and its test), `server/src/app.ts` (registering it)
- `shared/src/` (the view schema: filters, sort, visible columns and order, and the
  collection tab once brief 23 lands)
- `web/src/library/` (a Views menu in the toolbar; applying a view)

## Files you must NOT touch

- How `localStorage` remembers the last layout: it stays, for the unsaved state.
- The backup format in `server/src/routes/backup.ts`, unless a saved view must be in
  the backup; if it must, add it there and say so in the outcome.

## What to do

1. `GET /api/views`, `POST /api/views`, `PATCH /api/views/:id` (rename, reorder,
   overwrite with the current state), `DELETE /api/views/:id`. The stored state is
   validated against the shared schema on the way in, and a view whose state names a
   column that no longer exists drops that column on read rather than failing.
2. A **Views** menu in the toolbar: the saved views by position, "Save current
   view…", and on each view "Update to current", "Rename" and "Delete".
3. Applying a view sets filters, sort and columns exactly; the page then shows that
   the current state matches the view by name until something changes.
4. On a phone, a view's columns apply to the table only; the covers view takes its
   filters and sort.

## Acceptance

- Save "Unread, living room" on the desktop; open the app on a phone: the view is in
  the menu and applying it shows the same rows.
- Change a filter: the name no longer shows as current; "Update to current" saves it.
- Two views can't share a name (a `409`, said in the dialog).
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-23)

Built in `2b422c7` as migration 3, `saved_views` (id, name, `name_key` UNIQUE folded in
JS like tags, `state` JSON checked as an object, dense positions, timestamps), with
`server/src/store/views.ts` and `GET/POST /api/views`, `PATCH/DELETE /api/views/:id`.
A name another view holds, in any case, is a `409 conflict` (sent by the route, since
`ERROR_STATUS` in `errors.ts` has no 409 yet). `shared/src/views.ts` holds
`SavedViewState` and is now the home of the Library column ids and the filter type. A
state is checked strictly on the way in and read leniently, so a column that no longer
exists drops out. A view holds the tab, filters, sort and shown columns, not the search
text. Applying sets tab, sort and columns, then filters. Update, Rename and Delete act
on the view the page is on or was last on (the menu is flat). Desktop has Views in the
toolbar; on a phone it sits at the end of the Owned / Wishlist row, because the toolbar
row has no room (root `DESIGN.md` still describes the old toolbar). The backup needed no
change: it copies the whole database file. Checked in a browser at 1280 and 390; 727
tests at the time.
