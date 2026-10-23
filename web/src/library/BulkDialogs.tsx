import { useId, useRef, useState, type FormEvent } from "react";
import { matchShelf, normalizeShelf } from "../add/shelves";
import { AuthField } from "../auth/Field";
import { Button } from "../components/Button";
import { bookCount, parseTags, type Choice } from "./bulk";
import { DialogActions, DialogFailure, DialogFrame, messageOf } from "./ViewDialog";

/**
 * The bulk bar's dialogs (brief 26): move to a shelf, add tags, remove tags,
 * and the delete that asks first. Each is the Views dialogs' frame (a panel
 * in the middle of the window on the desktop, the floating sheet on a
 * phone). Each saves through `onSubmit`, stays open with the reason if that
 * fails, and closes once it is saved.
 */

interface DialogProps {
  desktop: boolean;
  /** Where focus goes back to on close: the bar's button. */
  returnFocus: HTMLElement | null;
  onClose: () => void;
}

/** A dialog's save: pending while it runs, its failure kept to show, closing once it is done. */
function useSave(onClose: () => void, fallback: string) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const save = (run: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setFailure(null);
    run().then(
      () => onClose(),
      (error: unknown) => {
        setPending(false);
        setFailure(messageOf(error, fallback));
      },
    );
  };
  return { pending, failure, save };
}

const NEW_SHELF = "\u0000new";
const NO_SHELF = "\u0000none";

export interface ShelfDialogProps extends DialogProps {
  /** How many owned books are selected: the ones that move. */
  owned: number;
  /** How many selected books are on the wishlist, and stay as they are. */
  wishlist: number;
  /** The shelves in use (`shelfChoices`). */
  shelves: readonly Choice[];
  /** `null` takes the books off their shelf. */
  onSubmit: (shelf: string | null) => Promise<void>;
}

/** "Move to shelf…": a shelf in use, a new one, or none. */
export function ShelfDialog({ owned, wishlist, shelves, desktop, returnFocus, onClose, onSubmit }: ShelfDialogProps) {
  const id = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const { pending, failure, save } = useSave(onClose, "The books weren't moved. Try again.");
  const names = shelves.map((shelf) => shelf.name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choice === null) {
      setFieldError("Choose a shelf.");
      return;
    }
    let shelf: string | null = choice === NO_SHELF ? null : choice;
    if (choice === NEW_SHELF) {
      const typed = normalizeShelf(text);
      if (typed === null) {
        setFieldError("Name the new shelf.");
        input.current?.focus();
        return;
      }
      shelf = matchShelf(typed, names);
    }
    save(() => onSubmit(shelf));
  };

  const pick = (value: string) => {
    setChoice(value);
    setFieldError(undefined);
  };

  return (
    <DialogFrame title={`Move ${bookCount(owned)} to a shelf`} desktop={desktop} returnFocus={returnFocus} onClose={onClose}>
      <form className="library-dialog__form" onSubmit={submit} noValidate>
        {wishlist > 0 && (
          <p className="library-dialog__text">
            {wishlist === 1 ? "1 selected book is on the wishlist and stays" : `${wishlist} selected books are on the wishlist and stay`}{" "}
            as {wishlist === 1 ? "it is" : "they are"}: only owned books sit on shelves.
          </p>
        )}
        <fieldset className="library-options" aria-describedby={fieldError && choice !== NEW_SHELF ? `${id}-error` : undefined}>
          <legend className="visually-hidden">Shelf</legend>
          {shelves.map((shelf, index) => (
            <label key={shelf.name} className="library-option">
              <input
                type="radio"
                name={`${id}-shelf`}
                checked={choice === shelf.name}
                onChange={() => pick(shelf.name)}
                data-autofocus={index === 0 ? "" : undefined}
              />
              <span className="library-option__label">{shelf.name}</span>
              {/* Heard as "Bedroom · B1, 5 books", not "Bedroom · B1 5". */}
              <span className="library-option__count tabular">
                <span className="visually-hidden">, </span>
                {shelf.count}
                <span className="visually-hidden"> {shelf.count === 1 ? "book" : "books"}</span>
              </span>
            </label>
          ))}
          <label className="library-option">
            <input
              type="radio"
              name={`${id}-shelf`}
              checked={choice === NEW_SHELF}
              onChange={() => {
                pick(NEW_SHELF);
                // After the re-render that shows the field.
                requestAnimationFrame(() => input.current?.focus());
              }}
              data-autofocus={shelves.length === 0 ? "" : undefined}
            />
            <span className="library-option__label">A new shelf</span>
          </label>
          <label className="library-option">
            <input type="radio" name={`${id}-shelf`} checked={choice === NO_SHELF} onChange={() => pick(NO_SHELF)} />
            <span className="library-option__label library-option__label--none">No shelf</span>
          </label>
        </fieldset>
        {choice === NEW_SHELF && (
          <AuthField
            ref={input}
            label="New shelf"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={500}
            placeholder="Room · shelf"
            hint="Room, then shelf: Living room · A2. A dash works too."
            value={text}
            error={fieldError}
            onChange={(event) => {
              setText(event.target.value);
              setFieldError(undefined);
            }}
          />
        )}
        {fieldError && choice !== NEW_SHELF && (
          <p id={`${id}-error`} className="auth-field__error" role="alert">
            {fieldError}
          </p>
        )}
        {failure !== null && <DialogFailure>{failure}</DialogFailure>}
        <DialogActions desktop={desktop} cancel="Cancel" onCancel={onClose}>
          <Button type="submit" variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending}>
            {pending ? "Moving…" : `Move ${bookCount(owned)}`}
          </Button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}

export interface AddTagsDialogProps extends DialogProps {
  count: number;
  /** Every tag the library uses, offered as the owner types. */
  suggestions: readonly string[];
  onSubmit: (tags: string[]) => Promise<void>;
}

/** "Add tags…": one line, tags separated by commas. */
export function AddTagsDialog({ count, suggestions, desktop, returnFocus, onClose, onSubmit }: AddTagsDialogProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const { pending, failure, save } = useSave(onClose, "The tags weren't added. Try again.");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const tags = parseTags(text);
    if (tags.length === 0) {
      setFieldError("Type a tag to add.");
      input.current?.focus();
      return;
    }
    save(() => onSubmit(tags));
  };

  return (
    <DialogFrame title={`Add tags to ${bookCount(count)}`} desktop={desktop} returnFocus={returnFocus} onClose={onClose}>
      <form className="library-dialog__form" onSubmit={submit} noValidate>
        <AuthField
          ref={input}
          label="Tags"
          data-autofocus
          autoComplete="off"
          enterKeyHint="done"
          maxLength={2000}
          placeholder="signed, first edition"
          hint="Separate tags with commas. A tag the library already has keeps its spelling, and no book gets it twice."
          list={`${id}-tags`}
          value={text}
          error={fieldError}
          onChange={(event) => {
            setText(event.target.value);
            setFieldError(undefined);
          }}
        />
        <datalist id={`${id}-tags`}>
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        {failure !== null && <DialogFailure>{failure}</DialogFailure>}
        <DialogActions desktop={desktop} cancel="Cancel" onCancel={onClose}>
          <Button type="submit" variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending}>
            {pending ? "Adding…" : "Add tags"}
          </Button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}

export interface RemoveTagsDialogProps extends DialogProps {
  count: number;
  /** The tags the selected books carry (`tagChoices`). */
  tags: readonly Choice[];
  onSubmit: (tags: string[]) => Promise<void>;
}

/** "Remove tags…": the tags the selected books carry, each with how many of them have it. */
export function RemoveTagsDialog({ count, tags, desktop, returnFocus, onClose, onSubmit }: RemoveTagsDialogProps) {
  const id = useId();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [fieldError, setFieldError] = useState<string | undefined>();
  const { pending, failure, save } = useSave(onClose, "The tags weren't removed. Try again.");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (chosen.size === 0) {
      setFieldError("Choose a tag to remove.");
      return;
    }
    save(() => onSubmit(tags.map((tag) => tag.name).filter((name) => chosen.has(name))));
  };

  const toggle = (name: string, on: boolean) => {
    setChosen((old) => {
      const next = new Set(old);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
    setFieldError(undefined);
  };

  return (
    <DialogFrame title={`Remove tags from ${bookCount(count)}`} desktop={desktop} returnFocus={returnFocus} onClose={onClose}>
      <form className="library-dialog__form" onSubmit={submit} noValidate>
        <fieldset className="library-options" aria-describedby={fieldError ? `${id}-error` : undefined}>
          <legend className="visually-hidden">Tags</legend>
          {tags.map((tag, index) => (
            <label key={tag.name} className="library-option">
              <input
                type="checkbox"
                checked={chosen.has(tag.name)}
                onChange={(event) => toggle(tag.name, event.target.checked)}
                data-autofocus={index === 0 ? "" : undefined}
              />
              <span className="library-option__label">{tag.name}</span>
              <span className="library-option__count tabular">
                <span className="visually-hidden">, on </span>
                {tag.count === count ? "all" : `${tag.count} of ${count}`}
              </span>
            </label>
          ))}
        </fieldset>
        {fieldError && (
          <p id={`${id}-error`} className="auth-field__error" role="alert">
            {fieldError}
          </p>
        )}
        {failure !== null && <DialogFailure>{failure}</DialogFailure>}
        <DialogActions desktop={desktop} cancel="Cancel" onCancel={onClose}>
          <Button type="submit" variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending}>
            {pending ? "Removing…" : chosen.size > 1 ? `Remove ${chosen.size} tags` : "Remove tag"}
          </Button>
        </DialogActions>
      </form>
    </DialogFrame>
  );
}

export interface DeleteBooksDialogProps extends DialogProps {
  count: number;
  /** How many of them the page doesn't show now. */
  hidden: number;
  onConfirm: () => Promise<void>;
}

/** "Delete…": asks first, naming the count, and says there is no undo. Focus starts on "Keep them". */
export function DeleteBooksDialog({ count, hidden, desktop, returnFocus, onClose, onConfirm }: DeleteBooksDialogProps) {
  const { pending, failure, save } = useSave(onClose, "The books weren't deleted. Try again.");
  return (
    <DialogFrame title={`Delete ${bookCount(count)}?`} desktop={desktop} returnFocus={returnFocus} onClose={onClose}>
      <div className="library-dialog__form">
        <p className="library-dialog__text">
          {count === 1 ? "It leaves" : "They leave"} your library with {count === 1 ? "its cover and notes" : "their covers and notes"}, on
          every device. There is no undo.
        </p>
        {hidden > 0 && (
          <p className="library-dialog__text">
            {hidden === 1 ? "1 of them isn't" : `${hidden} of them aren't`} on show now: the search, a filter or the other tab hides{" "}
            {hidden === 1 ? "it" : "them"}.
          </p>
        )}
        {failure !== null && <DialogFailure>{failure}</DialogFailure>}
        <DialogActions desktop={desktop} cancel={count === 1 ? "Keep it" : "Keep them"} onCancel={onClose}>
          <Button variant="primary" size={desktop ? "regular" : "large"} block={!desktop} disabled={pending} onClick={() => save(onConfirm)}>
            {pending ? "Deleting…" : `Delete ${bookCount(count)}`}
          </Button>
        </DialogActions>
      </div>
    </DialogFrame>
  );
}
