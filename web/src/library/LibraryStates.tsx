import type { ReactNode } from "react";
import type { ViewMode } from "./prefs";

/**
 * What the Library shows when it has no rows to show: the books on their
 * way (a quiet skeleton of the view, after a beat so a fast load never
 * flickers), and a short message with the one way forward.
 */

export function LibrarySkeleton({ mode }: { mode: ViewMode }) {
  if (mode === "covers") {
    return (
      <div className="library-skeleton library-skeleton--covers" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="library-skeleton__cover-item">
            <span className="library-skeleton__cover" />
            <span className="library-skeleton__line" />
            <span className="library-skeleton__line library-skeleton__line--short" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="library-skeleton library-skeleton--table" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="library-skeleton__row">
          <span className="library-skeleton__thumb" />
          <span className="library-skeleton__text">
            <span className="library-skeleton__line" />
            <span className="library-skeleton__line library-skeleton__line--short" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function LibraryMessage({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="library-message" aria-labelledby="library-message-title">
      <h2 id="library-message-title" className="library-message__title">
        {title}
      </h2>
      {children && <p className="library-message__text">{children}</p>}
      {action && <div className="library-message__action">{action}</div>}
    </section>
  );
}
