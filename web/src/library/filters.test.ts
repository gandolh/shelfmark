import { describe, expect, it } from "vitest";
import { columnById, type PickColumn } from "./columns";
import { NO_VALUE, applyFilters, describeFilter, isActive, pickOptions, type Filters } from "./filters";
import { book } from "./test-books";

const titles = (books: readonly { title: string }[]) => books.map((b) => b.title);

describe("text filters", () => {
  const books = [
    book({ title: "Solenoid", publisher: "Humanitas", notes: "Semnată de autor" }),
    book({ title: "Inocenții", publisher: "Humanitas" }),
    book({ title: "The Road", publisher: "Vintage", isbn13: "9780307387899" }),
  ];

  it("contains, blind to case and diacritics", () => {
    expect(titles(applyFilters(books, { book: { kind: "text", op: "contains", text: "INOCENTI" } }))).toEqual(["Inocenții"]);
    expect(titles(applyFilters(books, { notes: { kind: "text", op: "contains", text: "semnata" } }))).toEqual(["Solenoid"]);
  });

  it("is empty and is not empty", () => {
    expect(titles(applyFilters(books, { notes: { kind: "text", op: "empty", text: "" } }))).toEqual(["Inocenții", "The Road"]);
    expect(titles(applyFilters(books, { notes: { kind: "text", op: "notEmpty", text: "" } }))).toEqual(["Solenoid"]);
  });

  it("ignores hyphens in an ISBN filter", () => {
    expect(titles(applyFilters(books, { isbn: { kind: "text", op: "contains", text: "978-0307" } }))).toEqual(["The Road"]);
  });

  it("narrows nothing while contains has nothing typed", () => {
    expect(isActive({ kind: "text", op: "contains", text: "  " })).toBe(false);
    expect(applyFilters(books, { book: { kind: "text", op: "contains", text: "" } })).toBe(books);
  });
});

describe("pick-list filters", () => {
  const books = [
    book({ title: "A", shelf: "Bedroom", status: "reading", tags: ["Gift", "Poetry"] }),
    book({ title: "B", shelf: "Study · B1", status: "read", tags: ["Poetry"] }),
    book({ title: "C", shelf: null, status: "read", tags: [] }),
    book({ title: "D", shelf: "Bedroom", status: "unread", tags: ["Gift"] }),
  ];

  it("keeps a book with any chosen value", () => {
    expect(titles(applyFilters(books, { shelf: { kind: "pick", values: ["Bedroom", "Study · B1"] } }))).toEqual(["A", "B", "D"]);
    expect(titles(applyFilters(books, { status: { kind: "pick", values: ["read"] } }))).toEqual(["B", "C"]);
  });

  it("matches a list field (tags) on any of its values", () => {
    expect(titles(applyFilters(books, { tags: { kind: "pick", values: ["Gift"] } }))).toEqual(["A", "D"]);
  });

  it("can ask for the books without a value", () => {
    expect(titles(applyFilters(books, { shelf: { kind: "pick", values: [NO_VALUE] } }))).toEqual(["C"]);
    expect(titles(applyFilters(books, { tags: { kind: "pick", values: [NO_VALUE, "Gift"] } }))).toEqual(["A", "C", "D"]);
  });

  it("offers every value the books have, counted within the other filters", () => {
    const shelf = columnById("shelf") as PickColumn;
    const filters: Filters = { status: { kind: "pick", values: ["read"] }, shelf: { kind: "pick", values: ["Bedroom"] } };
    expect(pickOptions(shelf, books, filters, "")).toEqual([
      { value: "Bedroom", label: "Bedroom", count: 0 },
      { value: "Study · B1", label: "Study · B1", count: 1 },
      { value: NO_VALUE, label: "No shelf", count: 1 },
    ]);
  });

  it("shows a new shelf as soon as one book uses it, and fixed lists in their order", () => {
    const shelf = columnById("shelf") as PickColumn;
    const withAttic = [...books, book({ shelf: "Attic" })];
    expect(pickOptions(shelf, withAttic, {}, "").map((option) => option.value)).toEqual([
      "Attic",
      "Bedroom",
      "Study · B1",
      NO_VALUE,
    ]);
    const status = columnById("status") as PickColumn;
    expect(pickOptions(status, books, {}, "").map((option) => option.label)).toEqual(["Unread", "Reading", "Read"]);
  });

  it("counts within the search too", () => {
    const status = columnById("status") as PickColumn;
    const options = pickOptions(status, books, {}, "A");
    expect(options.find((option) => option.value === "reading")?.count).toBe(1);
    expect(options.find((option) => option.value === "read")?.count).toBe(0);
  });
});

describe("number and date filters", () => {
  const books = [
    book({ title: "old", publishedYear: 1990, acquiredOn: "2016-03-01", priceMinor: 2500 }),
    book({ title: "mid", publishedYear: 2005, acquiredOn: "2020-06-15", priceMinor: 5990 }),
    book({ title: "new", publishedYear: 2021, acquiredOn: null, priceMinor: null }),
    book({ title: "none" }),
  ];

  it("keeps a number range, either end open, both ends included", () => {
    expect(titles(applyFilters(books, { year: { kind: "number", min: 2000, max: 2021 } }))).toEqual(["mid", "new"]);
    expect(titles(applyFilters(books, { year: { kind: "number", min: 2005, max: null } }))).toEqual(["mid", "new"]);
    expect(titles(applyFilters(books, { year: { kind: "number", min: null, max: 1990 } }))).toEqual(["old"]);
  });

  it("compares a price in its stored units", () => {
    expect(titles(applyFilters(books, { price: { kind: "number", min: 3000, max: null } }))).toEqual(["mid"]);
  });

  it("keeps a date range by calendar day, both ends included", () => {
    expect(titles(applyFilters(books, { acquiredOn: { kind: "date", from: "2016-03-01", to: "2020-06-15" } }))).toEqual([
      "old",
      "mid",
    ]);
    expect(titles(applyFilters(books, { acquiredOn: { kind: "date", from: "2017-01-01", to: null } }))).toEqual(["mid"]);
  });

  it("filters Added by the local day of the timestamp", () => {
    const added = [
      book({ title: "first", createdAt: new Date(2026, 9, 1, 12).toISOString() }),
      book({ title: "second", createdAt: new Date(2026, 9, 14, 23, 30).toISOString() }),
    ];
    expect(titles(applyFilters(added, { added: { kind: "date", from: "2026-10-14", to: "2026-10-14" } }))).toEqual(["second"]);
  });
});

describe("yes/no filters", () => {
  it("keeps the yes or the no books", () => {
    const books = [book({ title: "signed", signed: true }), book({ title: "plain" })];
    expect(titles(applyFilters(books, { signed: { kind: "yesno", value: true } }))).toEqual(["signed"]);
    expect(titles(applyFilters(books, { signed: { kind: "yesno", value: false } }))).toEqual(["plain"]);
  });
});

describe("applyFilters", () => {
  it("wants every filter and the search", () => {
    const books = [
      book({ title: "Solenoid", shelf: "Bedroom", publishedYear: 2015 }),
      book({ title: "Orbitor", shelf: "Bedroom", publishedYear: 1996 }),
      book({ title: "Nostalgia", shelf: "Study · B1", publishedYear: 1993 }),
    ];
    const filters: Filters = {
      shelf: { kind: "pick", values: ["Bedroom"] },
      year: { kind: "number", min: 1990, max: 2000 },
    };
    expect(titles(applyFilters(books, filters))).toEqual(["Orbitor"]);
    expect(titles(applyFilters(books, filters, "solenoid"))).toEqual([]);
  });

  it("ignores a filter saved for another kind of column", () => {
    const books = [book({ title: "A" })];
    expect(titles(applyFilters(books, { shelf: { kind: "number", min: 1, max: 2 } }))).toEqual(["A"]);
  });
});

describe("describeFilter", () => {
  it("words a chip", () => {
    expect(describeFilter(columnById("shelf"), { kind: "pick", values: ["Bedroom", "Study · B1"] })).toBe(
      "Shelf: Bedroom, Study · B1",
    );
    expect(describeFilter(columnById("shelf"), { kind: "pick", values: ["Bedroom", "Study · B1", NO_VALUE] })).toBe(
      "Shelf: Bedroom, Study · B1 and 1 more",
    );
    expect(describeFilter(columnById("status"), { kind: "pick", values: ["reading"] })).toBe("Status: Reading");
    expect(describeFilter(columnById("notes"), { kind: "text", op: "empty", text: "" })).toBe("Notes is empty");
    expect(describeFilter(columnById("book"), { kind: "text", op: "contains", text: " road " })).toBe("Title contains “road”");
    expect(describeFilter(columnById("year"), { kind: "number", min: 2000, max: 2010 })).toBe("Year: 2000 to 2010");
    expect(describeFilter(columnById("pages"), { kind: "number", min: 300, max: null })).toBe("Pages: at least 300");
    expect(describeFilter(columnById("price"), { kind: "number", min: null, max: 5050 })).toBe("Price: at most 50.50");
    expect(describeFilter(columnById("acquiredOn"), { kind: "date", from: "2016-03-01", to: null })).toBe(
      "Acquired: from 1 Mar 2016",
    );
    expect(describeFilter(columnById("signed"), { kind: "yesno", value: false })).toBe("Signed: no");
  });
});
