/**
 * The keys that say two records are one book (dedup.ts): the title key and
 * the work key's short form.
 */

/** Lower case, without diacritics: NFD, then every combining mark dropped (web/src/library/search.ts's `fold`). */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// A leading article in the languages the library reads. "A" is English only; Romanian has none in front of a title.
const LEADING_ARTICLE = /^(?:the|an|a|le|la|les|l|el|los|las|un|una|der|die|das|ein|eine)\s+/;

/** The surname of an author: "Mircea Cărtărescu" and "Cărtărescu, Mircea" are both "cartarescu". */
export function surname(author: string): string {
  const [first = ""] = author.split(",");
  const name = author.includes(",") ? first : author;
  const words = fold(name)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.at(-1) ?? "";
}

/** A title without its subtitle (after ":"), punctuation or leading article, folded. */
export function titleStem(title: string): string {
  const main = title.split(":")[0] ?? title;
  const words = fold(main)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return words.replace(LEADING_ARTICLE, "");
}

/** The title key: the stem plus the first author's surname. A book with no author is its stem alone. */
export function titleKey(title: string, authors: readonly string[]): string {
  const stem = titleStem(title);
  const by = authors[0] === undefined ? "" : surname(authors[0]);
  return by === "" ? stem : `${stem}|${by}`;
}

/** `/works/OL45883W` → `OL45883W`; anything else is not a work key. */
export function workKeyOf(key: unknown): string | null {
  if (typeof key !== "string") return null;
  return /^\/works\/(OL\d+W)$/.exec(key)?.[1] ?? null;
}
