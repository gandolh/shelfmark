import type { ImportJob, Recommendation, RecommendationImport } from "@shelfmark/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, recommendationsApi } from "../api";

/** How often the import's progress is asked for while it runs. */
const POLL_MS = 1500;

export interface RecommendationsState {
  items: readonly Recommendation[];
  status: "loading" | "ready" | "error";
  error: string | null;
  job: ImportJob | null;
  /** Starts the check of Claude's picks; resolves with a message when it could not start. */
  startImport(picks: RecommendationImport): Promise<string | null>;
  dismiss(key: string): Promise<void>;
  /** Asks the server for the list again (after a book was added). */
  reload(): Promise<void>;
}

/** The Wishlist's recommendations: the list, the import's progress, and "Not interested". */
export function useRecommendations(): RecommendationsState {
  const [items, setItems] = useState<readonly Recommendation[]>([]);
  const [status, setStatus] = useState<RecommendationsState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
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
    // A check may be running from before the page was opened.
    void recommendationsApi.importProgress().then(
      (now) => alive.current && now.state === "running" && setJob(now),
      () => undefined,
    );
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const running = job?.state === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void recommendationsApi.importProgress().then(
        (now) => {
          if (!alive.current) return;
          setJob(now);
          if (now.state === "done") void reload();
        },
        () => undefined,
      );
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, reload]);

  const startImport = useCallback(async (picks: RecommendationImport) => {
    try {
      setJob(await recommendationsApi.startImport(picks));
      return null;
    } catch (e) {
      return e instanceof ApiError && e.code === "conflict"
        ? e.message
        : e instanceof Error
          ? e.message
          : "The import did not start.";
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

  return { items, status, error, job, startImport, dismiss, reload };
}
