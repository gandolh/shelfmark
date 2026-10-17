import { describe, expect, it } from "vitest";
import { fixtureAnswers, type FixtureName } from "../../testing/fakeLibraries.js";
import { readAnswer } from "./protocol.js";
import { clean, parseRecord, readUnimarc, recordFor } from "./unimarc.js";

function recordsOf(name: FixtureName): Buffer[] {
  const present = fixtureAnswers(name).map(readAnswer).find((answer) => answer.kind === "present");
  return present?.kind === "present" ? present.records : [];
}

function draftOf(name: FixtureName) {
  return readUnimarc(parseRecord(recordsOf(name)[0]!)!);
}

describe("readUnimarc, on the recorded records", () => {
  it("the Academy's Piramida roșie: translator left out, ș with the comma", () => {
    expect(draftOf("biblacad-piramida")).toEqual({
      title: "Piramida roșie",
      subtitle: null,
      authors: ["Rick Riordan"], // 700 "Riordan," with ISBD's comma; 702 is the translator
      publisher: "Editura Arthur",
      publishedYear: 2014,
      pages: 542,
      language: "ro",
      description: null,
      subjects: [],
      coverCandidates: [],
    });
  });

  it("BCU Cluj's: the volume's own title over the series, and its subjects", () => {
    expect(draftOf("bcucluj-piramida")).toMatchObject({
      title: "Piramida roșie", // 200 $a is "Cronicile familiei Kane", $i the volume
      pages: 543,
      subjects: ["Literatură americană", "Roman fantastic"],
    });
  });

  it("a book catalogued under its ISBN-10: non-sorting marks and brackets", () => {
    expect(draftOf("biblacad-provence-isbn10")).toMatchObject({
      title: "Un an în Provence", // "<<Un>> an în Provence"
      authors: ["Peter Mayle"],
      publisher: "RAO",
      publishedYear: 1998, // "[1998]"
      pages: 251, // "251 p. ; 18 cm"
    });
  });

  it("BCU Timișoara's 2026 record: the year where the catalog put it", () => {
    expect(draftOf("bcutimisoara-paleologu")).toMatchObject({
      title: "Ce ne facem cu atîția proști?",
      authors: ["Theodor Paleologu"],
      publisher: "Editura Trei",
      publishedYear: 2026, // 210 $e, and 100's date is "----"
      pages: 151,
      subjects: ["Prostie", "Atitudine (Psihologie)", "Literatură română"],
    });
  });
});

describe("recordFor", () => {
  it("picks the record whose 010 carries the ISBN, in either form", () => {
    const provence = recordsOf("biblacad-provence-isbn10")[0]!;
    const piramida = recordsOf("biblacad-piramida")[0]!;
    expect(readUnimarc(recordFor("9789735761868", [piramida, provence])!).title).toBe("Un an în Provence");
    expect(readUnimarc(recordFor("9786068044873", [provence, piramida])!).title).toBe("Piramida roșie");
  });

  it("falls back on the first record, and on nothing", () => {
    const piramida = recordsOf("biblacad-piramida")[0]!;
    expect(readUnimarc(recordFor("9780547928227", [piramida])!).title).toBe("Piramida roșie");
    expect(recordFor("9780547928227", [Buffer.from("not a record at all")])).toBeUndefined();
    expect(recordFor("9780547928227", [])).toBeUndefined();
  });
});

describe("parseRecord", () => {
  it("refuses what isn't ISO 2709", () => {
    expect(parseRecord(Buffer.from("short"))).toBeNull();
    expect(parseRecord(Buffer.from("x".repeat(40)))).toBeNull();
    const record = Buffer.from(recordsOf("biblacad-piramida")[0]!);
    record.write("ZZZZZ", 12, "latin1"); // base address of data
    expect(parseRecord(record)).toBeNull();
  });
});

describe("clean", () => {
  it("drops non-sorting marks and closing ISBD punctuation, but keeps an initial or an ellipsis", () => {
    expect(clean("<<Un>> an în Provence", true)).toBe("Un an în Provence");
    expect(clean("Riordan,", true)).toBe("Riordan");
    expect(clean("Tragedia Germaniei /", true)).toBe("Tragedia Germaniei");
    expect(clean("973-50-0223-X.", true)).toBe("973-50-0223-X");
    expect(clean("Emil M.", true)).toBe("Emil M.");
    expect(clean("Și totuși...", true)).toBe("Și totuși...");
  });

  it("writes ș and ț with the comma only in Romanian records", () => {
    expect(clean("Bucureşti, Ţara", true)).toBe("București, Țara");
    expect(clean("Kurtuluş", false)).toBe("Kurtuluş");
  });
});
