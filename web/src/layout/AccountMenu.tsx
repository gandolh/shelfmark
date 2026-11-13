import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { resolveTheme, THEMES, useTheme, type Theme } from "../theme/theme";
import { useMediaQuery } from "./viewport";
import {
  changePassword,
  changeUsername,
  chooseTheme,
  downloadBackup,
  linkWard,
  signOut,
  unlinkWard,
  useUsername,
  useWardLink,
  useWardNotice,
} from "../account/actions";
import { AlertIcon } from "../auth/icons";
import { useBooks } from "../books/store";
import { AccountIcon } from "../components/icons";
import { Menu, type MenuSection } from "../components/ui/Menu";
import type { ExportFormat } from "../export/exportLibrary";
import { IMPORT_CSV, STATS, navigate } from "../router";

/** "Light", "Dark", or "System, dark now". */
function themeDetail(theme: Theme, systemDark: boolean): string {
  const label = THEMES.find((option) => option.value === theme)?.label ?? "Light";
  return theme === "system" ? `${label}, ${resolveTheme(theme, systemDark)} now` : label;
}

const NOTICE_MS = 6000;

/**
 * The account button and its menu, in place of a Settings page (design.md):
 * Change username (its detail says who is signed in), Change password, Sign in
 * with Ward, Import a CSV, Stats, Download a backup, then "Export library"
 * (every book, as Excel or CSV, whatever the Library shows), then Sign out.
 * `bar` is the 34 px button in the desktop top bar; `header` is the 44 px
 * target beside a phone page's title.
 */
export function AccountMenu({ placement }: { placement: "bar" | "header" }) {
  const ward = useWardLink();
  const { books, status } = useBooks();
  const username = useUsername();
  const theme = useTheme();
  // The page follows the system on its own (color-scheme); this keeps the menu's words in step with it.
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A Ward link comes back to this page with its result; it shows here like an action's, then goes.
  const { message: wardMessage, failed: wardFailed, clear: clearWardMessage } = useWardNotice();

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (wardMessage === "") return;
    const wardTimer = setTimeout(clearWardMessage, NOTICE_MS);
    return () => clearTimeout(wardTimer);
  }, [wardMessage, clearWardMessage]);
  const shown = notice || wardMessage;
  // Every action's notice is a failure; a Ward round trip's may be good news.
  const failed = notice !== "" || wardFailed;

  // An action that fails (or isn't built yet) says so here, for a few seconds.
  const run = (action: () => Promise<void>) => () => {
    clearTimeout(timer.current);
    setNotice("");
    action().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "That didn't work. Try again.");
      timer.current = setTimeout(() => setNotice(""), NOTICE_MS);
    });
  };

  // The export's code loads only when it is chosen.
  const exportAs = (format: ExportFormat) =>
    run(async () => {
      const { exportLibrary } = await import("../export/exportLibrary");
      await exportLibrary(books, format);
    });
  const nothingToExport = status !== "ready" || books.length === 0;

  const sections: MenuSection[] = [
    {
      items: [
        { label: "Change username", detail: username, onSelect: run(changeUsername) },
        { label: "Change password", onSelect: run(changePassword) },
        { label: "Theme", detail: themeDetail(theme, systemDark), onSelect: run(chooseTheme) },
        ...(ward.available
          ? [
              {
                label: "Sign in with Ward",
                detail: ward.linked ? "Linked" : "Not linked",
                onSelect: run(ward.linked ? unlinkWard : linkWard),
              },
            ]
          : []),
        { label: "Import a CSV", detail: "Goodreads, Libib, spreadsheet", onSelect: () => navigate(IMPORT_CSV) },
        { label: "Stats", onSelect: () => navigate(STATS) },
        { label: "Download a backup", detail: "Database file", onSelect: run(downloadBackup) },
      ],
    },
    {
      label: "Export library",
      items: [
        { label: "Excel workbook (.xlsx)", onSelect: exportAs("xlsx"), disabled: nothingToExport },
        { label: "CSV", onSelect: exportAs("csv"), disabled: nothingToExport },
      ],
    },
    { items: [{ label: "Sign out", onSelect: run(signOut) }] },
  ];

  return (
    <div className="relative flex flex-none">
      <Menu
        label="Account"
        triggerLabel="Account"
        triggerClassName={cn(
          "group/account flex items-center justify-center rounded-pill text-ink-2",
          placement === "bar" ? "size-control" : "size-control-large",
        )}
        align="end"
        trigger={
          <span
            className={cn(
              "flex items-center justify-center rounded-pill bg-control transition-[background-color,color] duration-(--duration-fast) ease-out group-hover/account:bg-control-hover group-aria-expanded/account:bg-accent-tint group-aria-expanded/account:text-on-accent-tint",
              "size-full",
            )}
          >
            <AccountIcon size={18} />
          </span>
        }
        sections={sections}
      />
      <p
        className={cn(
          "absolute top-[calc(100%+8px)] right-0 z-float w-max max-w-[min(300px,calc(100vw-32px))] text-meta leading-tight text-ink",
          "data-shown:rounded-menu data-shown:bg-surface data-shown:px-3 data-shown:py-2.5 data-shown:shadow-float data-shown:motion-safe:animate-panel-in",
          failed &&
            "data-shown:flex data-shown:items-start data-shown:gap-2 data-shown:font-semibold [&_svg]:mt-[-1px] [&_svg]:flex-none",
        )}
        role="status"
        data-shown={shown !== "" || undefined}
      >
        {failed && shown !== "" && <AlertIcon size={16} />}
        {shown}
      </p>
    </div>
  );
}
