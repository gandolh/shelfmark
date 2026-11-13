import { to10, type Book, type MetadataSource } from "@shelfmark/shared";
import type { ReactNode } from "react";
import { priceLine } from "./money";
import { StarIcon } from "./RatingField";

const SOURCES: Record<MetadataSource, string> = {
  openlibrary: "Open Library",
  biblacad: "The Romanian Academy Library's catalog",
  bcucluj: "BCU Cluj's catalog",
  bcutimisoara: "BCU Timișoara's catalog",
  cip: "The national library's CIP lists",
  googlebooks: "Google Books",
  manual: "Typed in by hand",
  import: "Imported",
};

export const FORMAT_LABELS = { hardcover: "Hardcover", paperback: "Paperback", other: "Other" } as const;
export const CONDITION_LABELS = { new: "New", good: "Good", worn: "Worn", damaged: "Damaged" } as const;

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "2026-03-14" as "14 Mar 2026"; read as a calendar day, not a moment in some time zone. */
export function dayText(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return y && m && d ? DAY.format(new Date(y, m - 1, d)) : date;
}

/** "ro" as "Romanian"; the code itself when the browser doesn't know it. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames("en", { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[152px_minmax(0,1fr)] gap-4 border-b border-divider py-3 last:border-b-0 last:pb-0 max-md:grid-cols-[minmax(0,1fr)] max-md:gap-1 [&_dd]:max-w-[60ch] [&_dd]:min-w-0 [&_dd]:wrap-anywhere [&_dd]:text-ink [&_dt]:text-meta [&_dt]:leading-body [&_dt]:text-muted">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Everything the book holds, in two flat cards: about this copy (what the
 * owner knows about the one on the shelf), then about the book (what is
 * printed in it). The shelf and the status are set large above them, in
 * BookPage. A fact the book doesn't have is left out.
 */
export function BookDetails({ book }: { book: Book }) {
  const isbn10 = book.isbn13 === null ? null : to10(book.isbn13);
  const acquired = [
    book.acquiredOn ? dayText(book.acquiredOn) : null,
    book.acquiredFrom ? `from ${book.acquiredFrom}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <section className="min-w-0 rounded-container bg-surface p-5 max-md:p-4" aria-labelledby="book-about-copy">
        <h2 className="font-book text-heading leading-heading font-semibold text-ink" id="book-about-copy">
          About this copy
        </h2>
        <dl className="mt-2 flex flex-col">
          {book.collection === "wishlist" && <Fact label="Collection">Wishlist</Fact>}
          {book.rating !== null && (
            <Fact label="Rating">
              <span className="inline-flex gap-0.5 align-middle text-accent">
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} on={n <= (book.rating ?? 0)} size={16} />
                ))}
              </span>
              <span className="ml-2 text-ink-2">{book.rating} of 5</span>
            </Fact>
          )}
          {book.format && <Fact label="Format">{FORMAT_LABELS[book.format]}</Fact>}
          {book.condition && <Fact label="Condition">{CONDITION_LABELS[book.condition]}</Fact>}
          {book.signed && <Fact label="Signed">Signed by the author</Fact>}
          {acquired !== "" && <Fact label="Acquired">{acquired}</Fact>}
          {book.priceMinor !== null && <Fact label="Price">{priceLine(book.priceMinor, book.currency)}</Fact>}
          {book.tags.length > 0 && (
            <Fact label="Tags">
              <ul className="flex list-none flex-wrap gap-1.5">
                {book.tags.map((tag) => (
                  <li
                    key={tag}
                    className="inline-flex h-7 items-center rounded-pill bg-control px-3 text-meta text-ink"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </Fact>
          )}
          {book.notes && (
            <Fact label="Notes">
              <span className="block whitespace-pre-line">{book.notes}</span>
            </Fact>
          )}
          <Fact label="Added">{dayText(book.createdAt.slice(0, 10))}</Fact>
          <Fact label="Details from">{SOURCES[book.metadataSource]}</Fact>
        </dl>
      </section>

      <section className="min-w-0 rounded-container bg-surface p-5 max-md:p-4" aria-labelledby="book-about-book">
        <h2 className="font-book text-heading leading-heading font-semibold text-ink" id="book-about-book">
          About the book
        </h2>
        <dl className="mt-2 flex flex-col">
          {book.publisher && <Fact label="Publisher">{book.publisher}</Fact>}
          {book.publishedYear !== null && (
            <Fact label="Year">
              <span className="text-muted">{book.publishedYear}</span>
            </Fact>
          )}
          {book.pages !== null && <Fact label="Pages">{book.pages}</Fact>}
          {book.language && <Fact label="Language">{languageName(book.language)}</Fact>}
          {book.series && (
            <Fact label="Series">
              {book.series}
              {book.seriesNumber ? ` · No. ${book.seriesNumber}` : ""}
            </Fact>
          )}
          {book.isbn13 && <Fact label="ISBN-13">{book.isbn13}</Fact>}
          {isbn10 && <Fact label="ISBN-10">{isbn10}</Fact>}
          {book.barcode && book.barcode !== book.isbn13 && <Fact label="Barcode">{book.barcode}</Fact>}
          {book.subjects.length > 0 && <Fact label="Subjects">{book.subjects.join(", ")}</Fact>}
          {book.description && (
            <Fact label="Description">
              <span className="block whitespace-pre-line">{book.description}</span>
            </Fact>
          )}
        </dl>
        {!book.publisher && book.publishedYear === null && book.pages === null && !book.description && (
          <p className="text-meta text-muted">
            Nothing recorded about this book yet. Edit adds details; Re-run lookup finds them from the ISBN.
          </p>
        )}
      </section>
    </>
  );
}
