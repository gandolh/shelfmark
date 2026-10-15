import { useState, type CSSProperties } from "react";
import { coverUrl } from "../api";
import { authorLine, coverTint } from "./cover";

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
  const style = width === undefined ? undefined : ({ "--cover-width": typeof width === "number" ? `${width}px` : width } as CSSProperties);
  const classes = (...extra: string[]) => ["cover", ...extra, className].filter(Boolean).join(" ");

  if (url !== null && failed !== url) {
    return (
      <span className={classes("cover--image")} style={style}>
        <img
          className="cover__img"
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
  return (
    <span
      className={classes("cover--placeholder")}
      style={{ ...style, "--cover-title-size": titleSize(book.title) } as CSSProperties}
      data-tint={coverTint(book.title)}
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
    >
      <span className="cover__face" lang={book.language ?? undefined}>
        <span className="cover__title">{book.title}</span>
        {author && (
          <span className="cover__byline">
            <span className="cover__author">{author}</span>
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
