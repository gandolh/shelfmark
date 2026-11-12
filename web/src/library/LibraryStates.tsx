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
      <div
        className="motion-safe:animate-fade-in motion-safe:[animation-delay:350ms] motion-safe:[animation-fill-mode:backwards] grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-y-7 gap-x-6 max-md:grid-cols-[repeat(3,minmax(0,1fr))] max-md:gap-y-4.5 max-md:gap-x-3.5"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="block bg-control motion-safe:animate-pulse w-full mb-2.5 aspect-[2/3] rounded-cover" />
            <span className="block bg-control motion-safe:animate-pulse w-[80%] h-2.75 rounded-pill" />
            <span className="block bg-control motion-safe:animate-pulse h-2.75 rounded-pill w-[55%]" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className="motion-safe:animate-fade-in motion-safe:[animation-delay:350ms] motion-safe:[animation-fill-mode:backwards] pt-9.5 rounded-container bg-surface"
      aria-hidden="true"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 h-23.5 py-3 px-6 border-t border-divider max-md:pl-4">
          <span className="block bg-control motion-safe:animate-pulse flex-none w-11.5 aspect-[2/3] rounded-cover" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="block bg-control motion-safe:animate-pulse w-[min(260px,60%)] h-2.75 rounded-pill" />
            <span className="block bg-control motion-safe:animate-pulse h-2.75 rounded-pill w-[min(150px,35%)]" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function LibraryMessage({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className="flex flex-col items-center gap-1.5 pt-16 pr-6 pb-18 pl-6 rounded-container bg-surface text-center max-md:pt-12 max-md:pr-5 max-md:pb-14 max-md:pl-5"
      aria-labelledby="library-message-title"
    >
      <h2
        id="library-message-title"
        className="text-[length:calc(var(--text-row-title)*1.25)] font-bold tracking-wordmark leading-tight"
      >
        {title}
      </h2>
      {children && <p className="max-w-[46ch] text-muted text-body">{children}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </section>
  );
}
