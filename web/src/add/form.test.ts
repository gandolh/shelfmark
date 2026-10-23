import { describe, expect, it } from "vitest";
import { EMPTY_FORM, firstInvalid, joinAuthors, readForm, splitAuthors } from "./form";
import { matchShelf, normalizeShelf, shelvesInUse } from "./shelves";

describe("readForm", () => {
  it("needs only a title", () => {
    expect(readForm({ ...EMPTY_FORM, title: "  O vară   cu Isidor " })).toEqual({
      ok: true,
      fields: {
        title: "O vară cu Isidor",
        subtitle: null,
        authors: [],
        publisher: null,
        publishedYear: null,
        isbn13: null,
        shelf: null,
        status: "unread",
      },
    });
    expect(readForm(EMPTY_FORM)).toEqual({ ok: false, errors: { title: "A book needs a title." } });
  });

  it("reads subtitle, authors, publisher, year, shelf and status", () => {
    const read = readForm({
      title: "Ochiul căprui al dragostei noastre",
      subtitle: "  roman   ",
      author: "Mircea Eliade & Ioan Petru Culianu",
      publisher: " Humanitas ",
      year: "2021",
      isbn: "",
      shelf: "Study · B1",
      status: "reading",
    });
    expect(read).toMatchObject({
      ok: true,
      fields: {
        subtitle: "roman",
        authors: ["Mircea Eliade", "Ioan Petru Culianu"],
        publisher: "Humanitas",
        publishedYear: 2021,
        shelf: "Study · B1",
        status: "reading",
      },
    });
  });

  it("validates an ISBN when one is given, and stores the 13-digit form", () => {
    expect(readForm({ ...EMPTY_FORM, title: "t", isbn: "978-606-320-558-3" })).toMatchObject({
      ok: true,
      fields: { isbn13: "9786063205583" },
    });
    expect(readForm({ ...EMPTY_FORM, title: "t", isbn: "0-8044-2957-x" })).toMatchObject({
      ok: true,
      fields: { isbn13: "9780804429573" },
    });
    expect(readForm({ ...EMPTY_FORM, title: "t", isbn: "9786063205584" })).toEqual({
      ok: false,
      errors: { isbn: "Check digit doesn't match. One of the digits is off." },
    });
  });

  it("says every field at fault, and which comes first", () => {
    const read = readForm({ ...EMPTY_FORM, year: "two thousand", isbn: "12345" });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.errors).toEqual({
      title: "A book needs a title.",
      year: "Digits only, such as 2021.",
      isbn: "An ISBN has 10 or 13 digits; this has 5.",
    });
    expect(firstInvalid(read.errors)).toBe("title");
    expect(firstInvalid({ isbn: "x", year: "y" })).toBe("year");
    expect(firstInvalid({})).toBeNull();
  });

  it("refuses year 0 and five-digit years", () => {
    expect(readForm({ ...EMPTY_FORM, title: "t", year: "0" }).ok).toBe(false);
    expect(readForm({ ...EMPTY_FORM, title: "t", year: "20211" }).ok).toBe(false);
    expect(readForm({ ...EMPTY_FORM, title: "t", year: "868" })).toMatchObject({ fields: { publishedYear: 868 } });
  });
});

describe("authors", () => {
  it("splits on & and ;, keeping a comma inside a name", () => {
    expect(splitAuthors("García Márquez, Gabriel")).toEqual(["García Márquez, Gabriel"]);
    expect(splitAuthors("A &  B ; C &")).toEqual(["A", "B", "C"]);
    expect(splitAuthors("  ")).toEqual([]);
  });

  it("joins with & so a draft's list round-trips", () => {
    const authors = ["Mircea Eliade", "Ioan Petru Culianu"];
    expect(splitAuthors(joinAuthors(authors))).toEqual(authors);
  });
});

describe("shelves", () => {
  const at = (shelf: string | null, createdAt: string, collection: "owned" | "wishlist" = "owned") => ({
    shelf,
    createdAt,
    collection,
  });

  it("lists the shelves in use, the one added to last first", () => {
    expect(
      shelvesInUse([
        at("Study · B1", "2026-10-01T10:00:00.000Z"),
        at("Living room · A2", "2026-10-03T10:00:00.000Z"),
        at("Bedroom", "2026-09-01T10:00:00.000Z"),
        at("Study · B1", "2026-10-02T10:00:00.000Z"),
        at(null, "2026-10-04T10:00:00.000Z"),
        at("Shop window", "2026-10-05T10:00:00.000Z", "wishlist"),
      ]),
    ).toEqual(["Living room · A2", "Study · B1", "Bedroom"]);
  });

  it("writes room and shelf with a middle dot", () => {
    expect(normalizeShelf("Living room - A2")).toBe("Living room · A2");
    expect(normalizeShelf("  Living   room/A2 ")).toBe("Living room · A2");
    expect(normalizeShelf("Study • B1")).toBe("Study · B1");
    expect(normalizeShelf("Hall · A-2")).toBe("Hall · A-2");
    expect(normalizeShelf("Bedroom ·")).toBe("Bedroom");
    expect(normalizeShelf("   ")).toBeNull();
  });

  it("matches a typed shelf to the library's spelling", () => {
    expect(matchShelf("living room · a2", ["Living room · A2"])).toBe("Living room · A2");
    expect(matchShelf("Attic", ["Living room · A2"])).toBe("Attic");
  });
});
