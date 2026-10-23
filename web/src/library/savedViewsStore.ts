import {
  savedViewListSchema,
  savedViewSchema,
  type SavedView,
  type SavedViewCreate,
  type SavedViewPatch,
} from "@shelfmark/shared";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError, apiRequest, isApiError } from "../api";
import { authClient } from "../auth/session";
import { resetWhenSignedOut } from "../books/store";

/**
 * The saved views client (brief 27): `GET /api/views` once per session, the
 * list kept in memory by position, and every change made through here
 * applied to it in place. Like the books, the list belongs to a session and
 * is forgotten on sign-out. Views live on the server only, so they follow
 * the owner from the desktop to the phone; offline the menu says it can't
 * reach them.
 */

/** A name another view has: the server's `409`. */
export const NAME_TAKEN = "conflict";

/** The calls the store makes; `viewsApi` in the app, a fake in tests. */
export interface ViewsSource {
  list(): Promise<SavedView[]>;
  create(body: SavedViewCreate): Promise<SavedView>;
  patch(id: number, patch: SavedViewPatch): Promise<SavedView>;
  remove(id: number): Promise<void>;
}

export const viewsApi: ViewsSource = {
  list: async () => (await apiRequest("/api/views", { schema: savedViewListSchema })).views,
  create: (body) => apiRequest("/api/views", { method: "POST", body, schema: savedViewSchema }),
  patch: (id, patch) => apiRequest(`/api/views/${id}`, { method: "PATCH", body: patch, schema: savedViewSchema }),
  remove: (id) => apiRequest(`/api/views/${id}`, { method: "DELETE" }),
};

/**
 * - `loading`: no list yet (the first fetch, or a retry after it failed).
 * - `ready`: `views` is the list. A refresh that fails keeps it and sets `error`.
 * - `error`: the first fetch failed; `refresh` retries.
 */
export interface ViewsState {
  readonly views: readonly SavedView[];
  readonly status: "loading" | "ready" | "error";
  readonly error: ApiError | null;
}

const INITIAL: ViewsState = { views: [], status: "loading", error: null };

/** By position, renumbered 0, 1, 2…, as the server keeps them. */
function inOrder(views: readonly SavedView[]): SavedView[] {
  return [...views].sort((a, b) => a.position - b.position || a.id - b.id).map((view, position) => (view.position === position ? view : { ...view, position }));
}

export function createViewsStore(source: ViewsSource) {
  let state = INITIAL;
  let started = false;
  let inFlight: Promise<void> | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();

  function set(next: Partial<ViewsState>): void {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function load(): Promise<void> {
    if (inFlight) return inFlight;
    started = true;
    const run = generation;
    if (state.status === "error") set({ status: "loading", error: null });
    const request = source.list().then(
      (views) => {
        if (run === generation) set({ views: inOrder(views), status: "ready", error: null });
      },
      (error: unknown) => {
        if (run !== generation) return;
        set({ status: state.status === "ready" ? "ready" : "error", error: toApiError(error) });
      },
    );
    const tracked: Promise<void> = request.finally(() => {
      if (inFlight === tracked) inFlight = null;
    });
    inFlight = tracked;
    return tracked;
  }

  const put = (view: SavedView) =>
    set({ views: inOrder(state.views.some((v) => v.id === view.id) ? state.views.map((v) => (v.id === view.id ? view : v)) : [...state.views, view]) });

  return {
    getState: (): ViewsState => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Fetch the list unless this session already has (or is fetching it). */
    ensureLoaded(): void {
      if (!started) void load();
    },

    /** Fetch it again if this session has: the app came back to the front, and another device may have changed a view. */
    refreshIfLoaded(): void {
      if (started) void load();
    },

    refresh: load,

    /** Rejects with an `ApiError`; `conflict` when the name is taken. */
    async create(body: SavedViewCreate): Promise<SavedView> {
      const view = await source.create(body);
      put(view);
      return view;
    },

    /** Rejects with an `ApiError`: `conflict` when the name is taken, `not_found` when another device deleted it (the list is fetched again). */
    async patch(id: number, patch: SavedViewPatch): Promise<SavedView> {
      let view: SavedView;
      try {
        view = await source.patch(id, patch);
      } catch (error) {
        if (isApiError(error, "not_found")) void load();
        throw error;
      }
      // A move shifts the others too: the server's list says where each one went.
      if (patch.position !== undefined) await load();
      else put(view);
      return view;
    },

    /** A view that is already gone (a 404) counts as deleted. */
    async remove(id: number): Promise<void> {
      try {
        await source.remove(id);
      } catch (error) {
        if (!isApiError(error, "not_found")) throw error;
      }
      set({ views: inOrder(state.views.filter((v) => v.id !== id)) });
    },

    /** Forget the list (signed out). */
    reset(): void {
      generation += 1;
      started = false;
      inFlight = null;
      set(INITIAL);
    },
  };
}

export type ViewsStore = ReturnType<typeof createViewsStore>;

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "bad_response", "The saved views couldn't be loaded.", { cause: error });
}

// --- The app's store ---------------------------------------------------------------

const store = createViewsStore(viewsApi);
resetWhenSignedOut(store, authClient());

// A phone keeps the app open for days: a view saved on the desktop shows up when the app comes back to the front.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") store.refreshIfLoaded();
  });
}

export interface ViewsView extends ViewsState {
  refresh: () => Promise<void>;
}

/** The saved views, loaded on first use. Re-renders when they change. */
export function useSavedViews(): ViewsView {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  useEffect(() => store.ensureLoaded(), []);
  return useMemo(() => ({ ...state, refresh: store.refresh }), [state]);
}

export const saveView = (body: SavedViewCreate): Promise<SavedView> => store.create(body);
export const patchView = (id: number, patch: SavedViewPatch): Promise<SavedView> => store.patch(id, patch);
export const deleteView = (id: number): Promise<void> => store.remove(id);
