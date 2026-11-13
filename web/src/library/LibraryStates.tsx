import type { ReactNode } from "react";
import type { ViewMode } from "./prefs";

/**
 * What the Library shows when it has no rows to show: the books on their
 * way (a still skeleton of the view, after a beat so a fast load never
 * flickers), and a short message with the one way forward.
 */

export function LibrarySkeleton({ mode }: { mode: ViewMode }) {
  if (mode === "covers") {
    return (
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-6 gap-y-7 motion-safe:animate-fade-in motion-safe:[animation-delay:350ms] motion-safe:[animation-fill-mode:backwards] max-md:grid-cols-[repeat(3,minmax(0,1fr))] max-md:gap-x-3.5 max-md:gap-y-4.5"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="mb-2.5 block aspect-[2/3] w-full rounded-cover bg-control" />
            <span className="block h-2.75 w-[80%] rounded-pill bg-control" />
            <span className="block h-2.75 w-[55%] rounded-pill bg-control" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className="rounded-container bg-surface pt-9.5 motion-safe:animate-fade-in motion-safe:[animation-delay:350ms] motion-safe:[animation-fill-mode:backwards]"
      aria-hidden="true"
    >
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex h-23.5 items-center gap-3 border-t border-divider px-6 py-3 max-md:pl-4">
          <span className="block aspect-[2/3] w-11.5 flex-none rounded-cover bg-control" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="block h-2.75 w-[min(260px,60%)] rounded-pill bg-control" />
            <span className="block h-2.75 w-[min(150px,35%)] rounded-pill bg-control" />
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
      className="flex flex-col items-center gap-1.5 rounded-container bg-surface pt-16 pr-6 pb-18 pl-6 text-center max-md:pt-12 max-md:pr-5 max-md:pb-14 max-md:pl-5"
      aria-labelledby="library-message-title"
    >
      <h2 id="library-message-title" className="font-book text-heading leading-heading font-semibold">
        {title}
      </h2>
      {children && <p className="max-w-[46ch] text-body text-muted">{children}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </section>
  );
}
