import { useEffect, useRef, useState } from "react";
import {
  changePassword,
  changeUsername,
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
import { Menu, type MenuSection } from "../components/Menu";
import type { ExportFormat } from "../export/exportLibrary";
import { IMPORT_CSV, STATS, navigate } from "../router";
import "../account/account.css";

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
    <div className={`account account--${placement}`}>
      <Menu
        label="Account"
        triggerLabel="Account"
        triggerClassName="account__button"
        align="end"
        trigger={
          <span className="account__disc">
            <AccountIcon size={17} />
          </span>
        }
        sections={sections}
      />
      <p
        className={failed ? "account__notice account__notice--error" : "account__notice"}
        role="status"
        data-shown={shown !== "" || undefined}
      >
        {failed && shown !== "" && <AlertIcon size={16} />}
        {shown}
      </p>
    </div>
  );
}
