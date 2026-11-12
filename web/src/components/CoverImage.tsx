import { useState, type CSSProperties } from "react";
import { coverUrl } from "../api";
import { cn } from "../lib/cn";
import { authorLine, coverTint, TINT_CLASS } from "./cover";

/** What a cover needs from a book; a lookup's draft fits as well as a saved `Book`. */
export interface CoverBook {
  title: string;
  authors: readonly string[];
  /** For hyphenating the placeholder's title in the book's own language. */
  language?: string | null;
  /** With `hasCover`, the stored cover is shown. */
  id?: number;
  hasCover?: boolean;
  /** The stored cover's version (`Book.coverUpdatedAt`), in its address so no cache shows an old one. */
  coverUpdatedAt?: string | null;
}

// A cover at 2:3 with the cover shadow. Its width is `--cover-width` (the `width` prop) or the container's.
export const COVER_CLASS =
  "relative block aspect-[2/3] w-[var(--cover-width,100%)] flex-none overflow-hidden rounded-cover bg-control shadow-cover";
// The placeholder is sized off its own width (`cqi`, the container named `cover`); under 72 px it drops the byline.
const FACE =
  "absolute inset-0 flex flex-col justify-between gap-[6cqi] pt-[12cqi] pr-[10cqi] pb-[11cqi] pl-[16cqi] text-left leading-[1.1] before:absolute before:inset-y-0 before:start-[7cqi] before:border-s before:border-current/24 before:content-[''] @max-[72px]/cover:pr-[9cqi] @max-[72px]/cover:pb-[9cqi]";
const TITLE =
  "line-clamp-5 overflow-hidden text-[length:var(--cover-title-size,12.5cqi)] font-bold tracking-[-0.015em] wrap-break-word hyphens-auto text-balance @max-[72px]/cover:line-clamp-4";
const BYLINE =
  "flex flex-col gap-[4.5cqi] before:w-[16cqi] before:border-t-[max(1px,0.8cqi)] before:border-current before:content-[''] @max-[72px]/cover:hidden";
const AUTHOR =
  "line-clamp-2 overflow-hidden text-[7.5cqi] leading-[1.3] font-semibold tracking-[0.06em] wrap-break-word uppercase";

export interface CoverImageProps {
  book: CoverBook;
  /** An image to show instead of the stored cover: a lookup's candidate, a photo before upload. */
  src?: string;
  /** CSS width (a number is px); the height follows at 2:3. Default: the width of the container. */
  width?: number | string;
  /** Empty by default: wherever a cover appears, its title is written beside it. */
  alt?: string;
  loading?: "lazy" | "eager";
  className?: string;
}

/**
 * A book's cover at 2:3 with the cover shadow, the only shadow in the app.
 * Without an image (or when it fails to load) it is the no-cover
 * placeholder: a typographic cover, the title over the author on a tint
 * picked from the title, so a library of Romanian books with no covers in
 * the free databases still reads as a shelf.
 */
export function CoverImage({ book, src, width, alt = "", loading = "lazy", className }: CoverImageProps) {
  const url = src ?? (book.hasCover && book.id !== undefined ? coverUrl(book.id, book.coverUpdatedAt) : null);
  // The address that failed; a new address gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  const style =
    width === undefined
      ? undefined
      : ({ "--cover-width": typeof width === "number" ? `${width}px` : width } as CSSProperties);
  const classes = (...extra: (string | false | undefined)[]) => cn(COVER_CLASS, ...extra, className);

  if (url !== null && failed !== url) {
    return (
      <span className={classes()} style={style}>
        <img
          className="size-full object-cover"
          src={url}
          alt={alt}
          loading={loading}
          decoding="async"
          draggable={false}
          onError={() => setFailed(url)}
        />
      </span>
    );
  }

  const author = authorLine(book.authors);
  const tint = coverTint(book.title);
  return (
    <span
      className={classes("@container/cover", TINT_CLASS[tint - 1])}
      style={{ ...style, "--cover-title-size": titleSize(book.title) } as CSSProperties}
      data-tint={tint}
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
    >
      <span className={FACE} lang={book.language ?? undefined}>
        <span className={TITLE}>{book.title}</span>
        {author && (
          <span className={BYLINE}>
            <span className={AUTHOR}>{author}</span>
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * The placeholder title's size, in the cover's own width (`cqi`): 12.5 unless
 * its longest word would not fit across the face, then smaller, so a word
 * like "Punishment" or "irealitatea" stays whole rather than breaking.
 */
function titleSize(title: string): string {
  const longest = Math.max(1, ...title.split(/\s+/).map((word) => [...word].length));
  return `${Math.max(7, Math.min(12.5, 112 / longest)).toFixed(2)}cqi`;
}
