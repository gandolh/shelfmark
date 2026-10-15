import type { Book } from "@shelfmark/shared";

/**
 * Books for the Library's tests: `book()` with only the fields a test cares
 * about, and `syntheticLibrary()` for the 3,000-book timing. Test-only; the
 * app never imports this file.
 */

let nextId = 1;

export function book(fields: Partial<Book> = {}): Book {
  const id = fields.id ?? nextId++;
  return {
    id,
    isbn13: null,
    barcode: null,
    title: `Book ${id}`,
    subtitle: null,
    authors: [],
    authorSort: null,
    publisher: null,
    publishedYear: null,
    pages: null,
    language: null,
    series: null,
    seriesNumber: null,
    description: null,
    subjects: [],
    collection: "owned",
    format: null,
    condition: null,
    shelf: null,
    signed: false,
    status: "unread",
    rating: null,
    notes: null,
    acquiredOn: null,
    acquiredFrom: null,
    priceMinor: null,
    currency: "RON",
    metadataSource: "manual",
    tags: [],
    hasCover: false,
    coverUpdatedAt: null,
    createdAt: `2026-01-01T10:00:${String(id % 60).padStart(2, "0")}.000Z`,
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...fields,
  };
}

const AUTHORS = [
  ["Mircea Cărtărescu", "Cărtărescu, Mircea"],
  ["Ioana Pârvulescu", "Pârvulescu, Ioana"],
  ["Doina Ruști", "Ruști, Doina"],
  ["Veronica D. Niculescu", "Niculescu, Veronica D."],
  ["Mihail Sebastian", "Sebastian, Mihail"],
  ["Ana Blandiana", "Blandiana, Ana"],
  ["Cormac McCarthy", "McCarthy, Cormac"],
  ["Fyodor Dostoevsky", "Dostoevsky, Fyodor"],
  ["Daniel Kahneman", "Kahneman, Daniel"],
  ["Yuval Noah Harari", "Harari, Yuval Noah"],
] as const;
const WORDS = ["vară", "noapte", "țara", "orașul", "inocenții", "drumul", "pădurea", "șoapte", "lumina", "umbra", "casa", "marea"];
const PUBLISHERS = ["Polirom", "Humanitas", "Litera", "Vintage", "Penguin", "Nemira", "Art", "Curtea Veche"];
const SHELVES = ["Living room · A1", "Living room · A2", "Living room · A3", "Bedroom", "Study · B1", "Study · B2", null];
const STATUSES = ["unread", "reading", "read", "abandoned"] as const;
const TAGS = ["Romanian", "Gift", "Signed copy", "Poetry", "History", "Classics"];

/** `count` owned books, the same every run, with diacritics, notes and shelves like a real library's. */
export function syntheticLibrary(count = 3000): Book[] {
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pickOne = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

  return Array.from({ length: count }, (_, index) => {
    const [author, authorSort] = pickOne(AUTHORS);
    const title = `${pickOne(WORDS)} ${pickOne(WORDS)} ${index}`;
    const created = new Date(Date.UTC(2020, 0, 1) + index * 3_600_000 * 7).toISOString();
    return book({
      id: index + 1,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      authors: [author],
      authorSort,
      publisher: pickOne(PUBLISHERS),
      publishedYear: 1950 + Math.floor(random() * 76),
      pages: 80 + Math.floor(random() * 900),
      isbn13: `978${String(Math.floor(random() * 1e10)).padStart(10, "0")}`,
      shelf: pickOne(SHELVES),
      status: pickOne(STATUSES),
      tags: random() < 0.3 ? [pickOne(TAGS)] : [],
      notes: random() < 0.4 ? `Notă: ${pickOne(WORDS)} ${pickOne(WORDS)} — cumpărată la ${pickOne(PUBLISHERS)}. `.repeat(4) : null,
      priceMinor: random() < 0.5 ? Math.floor(random() * 15000) : null,
      createdAt: created,
      updatedAt: created,
    });
  });
}
