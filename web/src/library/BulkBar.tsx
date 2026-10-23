import { STATUSES, type Book, type BulkChange } from "@shelfmark/shared";
import { useMemo, useState } from "react";
import { STATUS_LABELS } from "../add/StatusPicker";
import { ApiError, isApiError } from "../api";
import { bulkChangeBooks, refreshBooks } from "../books/store";
import { Button } from "../components/Button";
import { Menu, type MenuItem, type MenuSection } from "../components/Menu";
import { bookCount, describeResult, shelfChoices, tagChoices } from "./bulk";
import { AddTagsDialog, DeleteBooksDialog, RemoveTagsDialog, ShelfDialog } from "./BulkDialogs";
import { summarizeSelection, withoutIds } from "./selection";
import { clearSelection, getSelection, setSelection } from "./state";
import { messageOf } from "./ViewDialog";

type DialogKind = "shelf" | "addTags" | "removeTags" | "delete";

/** A line for the page to show under the bar, or only to say (`visible: false`): a delete's, whose bar is gone. */
export interface BulkNotice {
  text: string;
  visible: boolean;
}

export interface BulkBarProps {
  /** The selected books still in the list, in its order. */
  selected: readonly Book[];
  /** The rows on show, to count the selected books they leave out. */
  rows: readonly Book[];
  /** Every book: the shelves and tags in use. */
  books: readonly Book[];
  desktop: boolean;
  /** Tell the page what a change did, for its line under the bar. */
  onNotice: (notice: BulkNotice) => void;
}

/** The answer to a bulk change that named a book the server no longer has: deleted on another device. */
const STALE = "Nothing was changed: some of these books are no longer in your library. The list is up to date now, so try again.";

/**
 * The bulk bar (brief 26): in place of the Library's toolbar while books are
 * selected. "3 selected" (and how many of them are out of sight), then, on
 * the desktop, Move to shelf, Set status, Add tags, Remove tags, Delete and
 * Clear; on a phone, where six don't fit a row, an Actions menu and Clear.
 * Each change is one `POST /api/books/bulk`. The selection stays after a
 * change, so another can follow; a delete lets go of the deleted books.
 */
export function BulkBar({ selected, rows, books, desktop, onNotice }: BulkBarProps) {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const summary = summarizeSelection(selected, rows);
  const shelves = useMemo(() => shelfChoices(books), [books]);
  const tagsOnSelected = useMemo(() => tagChoices(selected), [selected]);
  const allTags = useMemo(() => tagChoices(books).map((tag) => tag.name), [books]);

  const open = (kind: DialogKind) => {
    // A button keeps focus when pressed, and the menu hands it back to its button before this runs.
    setReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDialog(kind);
  };
  const close = () => setDialog(null);

  /** Save one change for every selected book. Rejects with an `ApiError` whose message is the owner's to read. */
  const run = async (change: BulkChange): Promise<void> => {
    const ids = selected.map((book) => book.id);
    let result;
    try {
      result = await bulkChangeBooks({ ids, change });
    } catch (error) {
      if (!isApiError(error, "validation")) throw error;
      // The only 400 this page can cause: a book deleted elsewhere. The list drops it, and the selection with it.
      void refreshBooks();
      throw new ApiError(error.status, error.code, STALE, { cause: error });
    }
    const text = describeResult(change, result);
    if (change.kind === "delete") {
      setSelection(withoutIds(getSelection(), result.deleted));
      onNotice({ text, visible: false });
    } else {
      onNotice({ text, visible: true });
    }
  };

  const setStatus = (status: (typeof STATUSES)[number]) => {
    run({ kind: "status", status }).catch((error: unknown) =>
      onNotice({ text: messageOf(error, "The status wasn't changed. Try again."), visible: true }),
    );
  };
  const statusItems: MenuItem[] = STATUSES.map((status) => ({ label: STATUS_LABELS[status], onSelect: () => setStatus(status) }));

  const noOwned = summary.owned === 0;
  const noTags = tagsOnSelected.length === 0;

  const count = (
    <p className="library-bulk__count">
      <span className="tabular">{summary.count.toLocaleString("en-GB")}</span> selected
      {summary.hidden > 0 && (
        <span className="library-bulk__hidden">
          , <span className="tabular">{summary.hidden.toLocaleString("en-GB")}</span> not shown
        </span>
      )}
    </p>
  );

  const clear = (
    <Button variant="quiet" onClick={clearSelection}>
      Clear
    </Button>
  );

  let bar;
  if (desktop) {
    bar = (
      <>
        {count}
        <Button onClick={() => open("shelf")} disabled={noOwned} title={noOwned ? "Only owned books sit on shelves" : undefined}>
          Move to shelf…
        </Button>
        <Menu label="Set status" sections={[{ items: statusItems }]} trigger="Set status" />
        <Button onClick={() => open("addTags")}>Add tags…</Button>
        <Button onClick={() => open("removeTags")} disabled={noTags} title={noTags ? "None of these books has a tag" : undefined}>
          Remove tags…
        </Button>
        <Button onClick={() => open("delete")}>Delete…</Button>
        {clear}
      </>
    );
  } else {
    const sections: MenuSection[] = [
      {
        items: [
          { label: "Move to shelf…", disabled: noOwned, onSelect: () => open("shelf") },
          { label: "Add tags…", onSelect: () => open("addTags") },
          { label: "Remove tags…", disabled: noTags, onSelect: () => open("removeTags") },
        ],
      },
      { label: "Set status", items: statusItems },
      { items: [{ label: "Delete…", onSelect: () => open("delete") }] },
    ];
    bar = (
      <>
        {count}
        <div className="library-toolbar__end">
          <Menu
            label={`Change ${bookCount(summary.count)}`}
            sections={sections}
            trigger="Actions"
            triggerClassName="button button--quiet button--regular menu-trigger"
            align="end"
          />
          {clear}
        </div>
      </>
    );
  }

  const shared = { desktop, returnFocus, onClose: close };
  return (
    <>
      {bar}
      {dialog === "shelf" && (
        <ShelfDialog
          {...shared}
          owned={summary.owned}
          wishlist={summary.count - summary.owned}
          shelves={shelves}
          onSubmit={(shelf) => run({ kind: "shelf", shelf })}
        />
      )}
      {dialog === "addTags" && (
        <AddTagsDialog {...shared} count={summary.count} suggestions={allTags} onSubmit={(tags) => run({ kind: "addTags", tags })} />
      )}
      {dialog === "removeTags" && (
        <RemoveTagsDialog {...shared} count={summary.count} tags={tagsOnSelected} onSubmit={(tags) => run({ kind: "removeTags", tags })} />
      )}
      {dialog === "delete" && (
        <DeleteBooksDialog {...shared} count={summary.count} hidden={summary.hidden} onConfirm={() => run({ kind: "delete" })} />
      )}
    </>
  );
}
