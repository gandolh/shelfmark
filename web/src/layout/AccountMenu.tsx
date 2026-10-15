import { useEffect, useRef, useState } from "react";
import { changePassword, downloadBackup, linkWard, signOut, unlinkWard, useWardLink } from "../account/actions";
import { AccountIcon } from "../components/icons";
import { Menu, type MenuSection } from "../components/Menu";

const NOTICE_MS = 6000;

/**
 * The account button and its menu, in place of a Settings page (design.md):
 * Change password, Sign in with Ward, Download a backup, then Sign out.
 * `bar` is the 34 px button in the desktop top bar; `header` is the 44 px
 * target beside a phone page's title.
 */
export function AccountMenu({ placement }: { placement: "bar" | "header" }) {
  const ward = useWardLink();
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // An action that fails (or isn't built yet) says so here, for a few seconds.
  const run = (action: () => Promise<void>) => () => {
    clearTimeout(timer.current);
    setNotice("");
    action().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "That didn't work. Try again.");
      timer.current = setTimeout(() => setNotice(""), NOTICE_MS);
    });
  };

  const sections: MenuSection[] = [
    {
      items: [
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
        { label: "Download a backup", detail: "Database file", onSelect: run(downloadBackup) },
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
      <p className="account__notice" role="status" data-shown={notice !== "" || undefined}>
        {notice}
      </p>
    </div>
  );
}
