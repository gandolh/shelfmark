import { describe, expect, it } from "vitest";
import { cipValues, fillFromCip } from "./cip";
import { EMPTY_FORM } from "./form";

const READ = cipValues({
  title: "Ferestrele Clujului",
  subtitle: "exerciții de memorie culturală",
  authors: ["Mircea Popa"],
  publisher: "Editura Școala Ardeleană",
  year: 2026,
  isbn13: "9786303143477",
});

describe("cipValues", () => {
  it("writes the fields as the form does, and leaves out what the block didn't have", () => {
    expect(READ).toEqual({
      title: "Ferestrele Clujului",
      subtitle: "exerciții de memorie culturală",
      author: "Mircea Popa",
      publisher: "Editura Școala Ardeleană",
      year: "2026",
      isbn: "9786303143477",
    });
    expect(cipValues({ title: "Mineiul", subtitle: null, authors: ["A", "B"], publisher: null, year: null, isbn13: null })).toEqual({
      title: "Mineiul",
      author: "A & B",
    });
  });
});

describe("fillFromCip", () => {
  it("fills the empty fields and never one the owner typed", () => {
    const typed = { ...EMPTY_FORM, title: "Ferestrele", year: " " };
    const out = fillFromCip(typed, READ, {});
    expect(out.values).toEqual({
      ...typed,
      subtitle: "exerciții de memorie culturală",
      author: "Mircea Popa",
      publisher: "Editura Școala Ardeleană",
      year: "2026",
      isbn: "9786303143477",
    });
    expect(out.changed).toEqual(["subtitle", "author", "publisher", "year", "isbn"]);
    expect(Object.keys(out.filled)).toEqual(["subtitle", "author", "publisher", "year", "isbn"]);
  });

  it("a second read replaces what the first put there, unless the owner has changed it since", () => {
    const first = fillFromCip(EMPTY_FORM, { title: "Ferestrele Clujului", author: "Mircea Popa re" }, {});
    const corrected = { ...first.values, title: "Ferestrele Clujului (ed. 3)" };
    const second = fillFromCip(corrected, { title: "Ferestrele", author: "Mircea Popa" }, first.filled);
    expect(second.values).toMatchObject({ title: "Ferestrele Clujului (ed. 3)", author: "Mircea Popa" });
    expect(second.changed).toEqual(["author"]);
    expect(second.filled).toEqual({ author: "Mircea Popa" });
  });

  it("keeps an earlier fill marked when the new read has nothing for it", () => {
    const first = fillFromCip(EMPTY_FORM, { title: "Roz", publisher: "For You" }, {});
    const second = fillFromCip(first.values, { title: "Roz" }, first.filled);
    expect(second.filled).toEqual({ title: "Roz", publisher: "For You" });
    expect(second.changed).toEqual([]);
  });
});
