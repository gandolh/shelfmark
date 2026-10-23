import { readSavedViewState, type SavedView, type SavedViewCreate, type SavedViewPatch } from "@shelfmark/shared";
import type { Db } from "../db/open.js";

/**
 * The saved views store (brief 27): the only module that runs SQL on
 * `saved_views`. Inputs are already parsed with the shared schemas; the store
 * keeps the names unique on their folded key, keeps the positions dense
 * (0, 1, 2… in the menu's order) and sets the times. A stored state is read
 * back through `readSavedViewState`, so a column a later version took away
 * drops out of the view instead of failing it.
 */
export interface ViewStore {
  /** Every view, by position. */
  list(): SavedView[];
  get(id: number): SavedView | undefined;
  /** A new view, last in the menu. Throws `ViewNameTaken` when another view has the name. */
  create(input: SavedViewCreate): SavedView;
  /** `undefined` when there is no such view. Throws `ViewNameTaken` when another view has the new name. */
  patch(id: number, patch: SavedViewPatch): SavedView | undefined;
  /** `false` when there is no such view. The views after it move up one. */
  remove(id: number): boolean;
}

/** Another view already has this name (matched without case). The route answers `409`. */
export class ViewNameTaken extends Error {
  constructor(readonly viewName: string) {
    super(`There is already a view called “${viewName}”.`);
    this.name = "ViewNameTaken";
  }
}

/** The name as uniqueness sees it: in NFC, lower-cased in JS (SQLite's NOCASE folds ASCII only), as tags' `name_key`. */
export function viewNameKey(name: string): string {
  return name.normalize("NFC").trim().toLowerCase();
}

interface ViewRow {
  id: number;
  name: string;
  state: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

function toView(row: ViewRow): SavedView {
  let stored: unknown;
  try {
    stored = JSON.parse(row.state);
  } catch {
    stored = {}; // the CHECK makes this unreachable; an unreadable state opens as the default view
  }
  return {
    id: row.id,
    name: row.name,
    state: readSavedViewState(stored),
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const SELECT = "SELECT id, name, state, position, created_at AS createdAt, updated_at AS updatedAt FROM saved_views";

export function createViewStore(db: Db, now: () => Date = () => new Date()): ViewStore {
  const selectAll = db.prepare<[], ViewRow>(`${SELECT} ORDER BY position, id`);
  const selectOne = db.prepare<[number], ViewRow>(`${SELECT} WHERE id = ?`);
  const findByKey = db.prepare<[string], { id: number; name: string }>("SELECT id, name FROM saved_views WHERE name_key = ?");
  const nextPosition = db.prepare<[], { next: number }>("SELECT COALESCE(MAX(position) + 1, 0) AS next FROM saved_views");
  const insert = db.prepare<[string, string, string, number, string, string]>(
    "INSERT INTO saved_views (name, name_key, state, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const setName = db.prepare<[string, string, number]>("UPDATE saved_views SET name = ?, name_key = ? WHERE id = ?");
  const setState = db.prepare<[string, number]>("UPDATE saved_views SET state = ? WHERE id = ?");
  const setPosition = db.prepare<[number, number]>("UPDATE saved_views SET position = ? WHERE id = ?");
  const touch = db.prepare<[string, number]>("UPDATE saved_views SET updated_at = ? WHERE id = ?");
  const deleteOne = db.prepare<[number]>("DELETE FROM saved_views WHERE id = ?");
  const order = db.prepare<[], { id: number; position: number }>("SELECT id, position FROM saved_views ORDER BY position, id");

  /** Throws when a view other than `except` has the name. */
  function claim(name: string, except?: number): string {
    const key = viewNameKey(name);
    const holder = findByKey.get(key);
    if (holder && holder.id !== except) throw new ViewNameTaken(holder.name);
    return key;
  }

  /** Every view in the menu's order, with `moving` taken out and put back at `to` (past the end is the end). */
  function reorder(moving?: { id: number; to: number }): void {
    const rows = order.all();
    const was = new Map(rows.map((row) => [row.id, row.position]));
    const ids = rows.map((row) => row.id).filter((id) => id !== moving?.id);
    if (moving) ids.splice(Math.min(moving.to, ids.length), 0, moving.id);
    // Positions 0, 1, 2…, writing only the rows that move.
    ids.forEach((id, index) => {
      if (was.get(id) !== index) setPosition.run(index, id);
    });
  }

  const create = db.transaction((input: SavedViewCreate): number => {
    const key = claim(input.name);
    const at = now().toISOString();
    const { next } = nextPosition.get() ?? { next: 0 };
    return Number(insert.run(input.name, key, JSON.stringify(input.state), next, at, at).lastInsertRowid);
  });

  const patch = db.transaction((id: number, change: SavedViewPatch): boolean => {
    if (!selectOne.get(id)) return false;
    if (change.name !== undefined) setName.run(change.name, claim(change.name, id), id);
    if (change.state !== undefined) setState.run(JSON.stringify(change.state), id);
    if (change.position !== undefined) reorder({ id, to: change.position });
    if (change.name !== undefined || change.state !== undefined || change.position !== undefined) {
      touch.run(now().toISOString(), id);
    }
    return true;
  });

  const remove = db.transaction((id: number): boolean => {
    if (deleteOne.run(id).changes === 0) return false;
    reorder();
    return true;
  });

  const get = (id: number): SavedView | undefined => {
    const row = selectOne.get(id);
    return row && toView(row);
  };

  return {
    list: () => selectAll.all().map(toView),
    get,
    create(input) {
      const id = create(input);
      const view = get(id);
      if (!view) throw new Error(`The view ${id} was saved but can't be read back.`);
      return view;
    },
    patch: (id, change) => (patch(id, change) ? get(id) : undefined),
    remove: (id) => remove(id),
  };
}
