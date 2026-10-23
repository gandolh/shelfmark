import type { SavedView } from "@shelfmark/shared";
import { useMemo, useState } from "react";
import { Menu, type MenuSection } from "../components/Menu";
import type { Layout, ViewMode } from "./prefs";
import {
  applyView,
  currentStateOf,
  currentViewState,
  forgetView,
  matchingView,
  rememberView,
  updatedViewState,
  useLastViewId,
} from "./savedViews";
import { deleteView, patchView, saveView, useSavedViews } from "./savedViewsStore";
import { useLibraryFilters, useLibraryPrefs } from "./state";
import { DeleteViewDialog, NameDialog } from "./ViewDialog";

type DialogState = { kind: "save" } | { kind: "rename"; view: SavedView } | { kind: "delete"; view: SavedView };

export interface ViewsMenuProps {
  layout: Layout;
  /** Table or covers: in the covers view a view's columns don't count. */
  mode: ViewMode;
  /** The phone's toolbar: accent text instead of the desktop's flat fill. */
  quiet?: boolean;
}

/**
 * Views (brief 27), in the Library's toolbar: the saved views by position
 * (choosing one applies it; the one the page is on says "Current"), "Save
 * current view…", and, for the view the page is on (or was last on, once a
 * filter moved it off), "Update to current", "Rename…" and "Delete…". The
 * button shows the view's name while the page matches it, "Views" otherwise.
 */
export function ViewsMenu({ layout, mode, quiet = false }: ViewsMenuProps) {
  const { views, status, refresh } = useSavedViews();
  const prefs = useLibraryPrefs(layout);
  const filters = useLibraryFilters();
  const lastId = useLastViewId();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const [failed, setFailed] = useState(false);
  const desktop = layout === "desktop";

  const current = useMemo(() => currentViewState(prefs, filters), [prefs, filters]);
  const matched = matchingView(views, current, mode);
  const onView = matched ?? views.find((view) => view.id === lastId);

  const open = (next: DialogState) => {
    // The menu has just handed focus back to its button: the dialog returns it there.
    setReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setFailed(false);
    setDialog(next);
  };

  const update = (view: SavedView) => {
    setFailed(false);
    patchView(view.id, { state: updatedViewState(view, currentStateOf(layout), mode) }).then(
      () => rememberView(view.id),
      () => setFailed(true),
    );
  };

  const sections: MenuSection[] = [];
  if (status === "loading") {
    sections.push({ label: "Loading saved views…", items: [] });
  } else if (status === "error") {
    sections.push({ items: [{ label: "Saved views didn't load. Try again", onSelect: () => void refresh() }] });
  } else if (views.length > 0) {
    sections.push({
      items: views.map((view) => ({
        label: view.name,
        detail: view === matched ? "Current" : undefined,
        onSelect: () => applyView(layout, view),
      })),
    });
  }
  sections.push({
    label: status === "ready" && views.length === 0 ? "No saved views yet" : undefined,
    items: [{ label: "Save current view…", onSelect: () => open({ kind: "save" }) }],
  });
  if (onView) {
    sections.push({
      // In quotes: a section's label is its key, and a bare name could be another section's.
      label: `“${onView.name}”`,
      items: [
        { label: "Update to current", disabled: onView === matched, onSelect: () => update(onView) },
        { label: "Rename…", onSelect: () => open({ kind: "rename", view: onView }) },
        { label: "Delete…", onSelect: () => open({ kind: "delete", view: onView }) },
      ],
    });
  }

  const text = matched?.name ?? "Views";
  return (
    <>
      <Menu
        label="Views"
        sections={sections}
        trigger={
          // The name may be long: it is cut short with an ellipsis, and keeps its width while the open button turns semibold.
          <span className="library-views__label" data-label={text}>
            <span className="library-views__text">{text}</span>
          </span>
        }
        triggerLabel={matched ? `Views, ${matched.name}` : undefined}
        triggerClassName={`button button--${quiet ? "quiet" : "secondary"} button--regular menu-trigger library-views`}
        align={quiet ? "end" : "start"}
      />
      {failed && (
        <span role="alert" className="visually-hidden">
          The view wasn't updated. Try again.
        </span>
      )}
      {dialog?.kind === "save" && (
        <NameDialog
          title="Save current view"
          intro="The tab, filters, sort and columns you have now, under a name, on every device you sign in on."
          submitLabel="Save view"
          desktop={desktop}
          returnFocus={returnFocus}
          // The page's state as it is when Save is pressed.
          onSubmit={async (name) => rememberView((await saveView({ name, state: currentStateOf(layout) })).id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "rename" && (
        <NameDialog
          title="Rename view"
          submitLabel="Rename"
          initialName={dialog.view.name}
          desktop={desktop}
          returnFocus={returnFocus}
          onSubmit={async (name) => void (await patchView(dialog.view.id, { name }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteViewDialog
          name={dialog.view.name}
          desktop={desktop}
          returnFocus={returnFocus}
          onConfirm={async () => {
            await deleteView(dialog.view.id);
            forgetView(dialog.view.id);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
