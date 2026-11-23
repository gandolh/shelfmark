import type { ImportJob, Recommendation, RecommendationImport, RefreshJob } from "@shelfmark/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, recommendationsApi } from "../api";

/** How often a running import's or refresh's progress is asked for. */
const POLL_MS = 1500;

export interface RecommendationsState {
  items: readonly Recommendation[];
  status: "loading" | "ready" | "error";
  error: string | null;
  /** The check of Claude's picks, once one has run in this visit or was running when the page opened. */
  job: ImportJob | null;
  /** The Similar refresh, likewise. */
  refresh: RefreshJob | null;
  /** Starts the check of Claude's picks; resolves with a message when it could not start. */
  startImport(picks: RecommendationImport): Promise<string | null>;
  /** Starts the Similar refresh; resolves with a message when it could not start. */
  startRefresh(): Promise<string | null>;
  dismiss(key: string): Promise<void>;
  /** Asks the server for the list again (after a book was added). */
  reload(): Promise<void>;
}

const startFailure = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.code === "conflict" ? e.message : e instanceof Error ? e.message : fallback;

/**
 * Polls `progress` while `running`, hands each answer to `onState`, and
 * reloads the list when the job stops running.
 */
function usePoll<T extends { state: string }>(
  running: boolean,
  progress: () => Promise<T>,
  onState: (now: T) => void,
  reload: () => Promise<void>,
  alive: { current: boolean },
) {
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void progress().then(
        (now) => {
          if (!alive.current) return;
          onState(now);
          if (now.state !== "running") void reload();
        },
        () => undefined,
      );
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, progress, onState, reload, alive]);
}

/** The Wishlist's recommendations: the list, the import's and the refresh's progress, and "Not interested". */
export function useRecommendations(): RecommendationsState {
  const [items, setItems] = useState<readonly Recommendation[]>([]);
  const [status, setStatus] = useState<RecommendationsState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [refresh, setRefresh] = useState<RefreshJob | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const list = await recommendationsApi.list();
      if (!alive.current) return;
      setItems(list);
      setStatus("ready");
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "The recommendations did not load.");
      setStatus((was) => (was === "loading" ? "error" : was));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // Not called in the effect's own turn: the answer sets state.
    void Promise.resolve().then(reload);
    // An import or a refresh may be running from before the page was opened.
    void recommendationsApi.importProgress().then(
      (now) => alive.current && now.state === "running" && setJob(now),
      () => undefined,
    );
    void recommendationsApi.refreshProgress().then(
      (now) => alive.current && now.state === "running" && setRefresh(now),
      () => undefined,
    );
    return () => {
      alive.current = false;
    };
  }, [reload]);

  usePoll(job?.state === "running", recommendationsApi.importProgress, setJob, reload, alive);
  usePoll(refresh?.state === "running", recommendationsApi.refreshProgress, setRefresh, reload, alive);

  const startImport = useCallback(async (picks: RecommendationImport) => {
    try {
      setJob(await recommendationsApi.startImport(picks));
      return null;
    } catch (e) {
      return startFailure(e, "The import did not start.");
    }
  }, []);

  const startRefresh = useCallback(async () => {
    try {
      setRefresh(await recommendationsApi.startRefresh());
      return null;
    } catch (e) {
      return startFailure(e, "Finding similar books did not start.");
    }
  }, []);

  const dismiss = useCallback(
    async (key: string) => {
      // The card leaves at once; a failed call puts the list back as the server has it.
      setItems((now) => now.filter((item) => item.key !== key));
      try {
        await recommendationsApi.dismiss(key);
      } catch {
        await reload();
      }
    },
    [reload],
  );

  return { items, status, error, job, refresh, startImport, startRefresh, dismiss, reload };
}
