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
// The placeholder is sized off its own width (`cqi`, the container named `cover`); at 72 px and under it is the title's first letter.
const FACE =
  "absolute inset-0 flex flex-col justify-between pt-[11cqi] pr-[10cqi] pb-[11cqi] pl-[17cqi] text-left leading-[1.12] before:absolute before:inset-y-0 before:start-[7cqi] before:border-s before:border-current/24 before:content-[''] @max-[72px]/cover:pt-[9cqi] @max-[72px]/cover:pr-[8cqi] @max-[72px]/cover:pb-[9cqi] @max-[72px]/cover:pl-[20cqi]";
const TITLE =
  "line-clamp-5 overflow-hidden font-book text-[length:var(--cover-title-size,13cqi)] font-semibold wrap-break-word hyphens-auto text-balance @max-[72px]/cover:hidden";
// At 72 px and under the title would be too small to read: the placeholder shows the title's first letter.
const INITIAL = "hidden font-book text-[44cqi] leading-none font-semibold @max-[72px]/cover:block";
const BYLINE =
  "line-clamp-2 overflow-hidden border-t border-current pt-[4cqi] font-book text-[8.5cqi] leading-[1.2] wrap-break-word @max-[72px]/cover:hidden";

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
        <span className={INITIAL}>{[...book.title.trim()][0]?.toUpperCase()}</span>
        <span className={TITLE}>{book.title}</span>
        {author && <span className={BYLINE}>{author}</span>}
      </span>
    </span>
  );
}

/**
 * The placeholder title's size, in the cover's own width (`cqi`): 13 unless
 * its longest word would not fit across the face, then smaller, so a word
 * like "Punishment" or "irealitatea" stays whole rather than breaking.
 */
function titleSize(title: string): string {
  const longest = Math.max(1, ...title.split(/\s+/).map((word) => [...word].length));
  return `${Math.max(7, Math.min(13, 112 / longest)).toFixed(2)}cqi`;
}
