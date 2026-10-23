import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCipBlock, tidyOcr, type CipFields } from "./block";

/*
 * fixtures/: five CIP blocks with the real descriptions of five books from the
 * national library's lists (server/src/cip/fixtures), set as a book prints them
 * and photographed-looking (tilt, perspective, blur, noise, a shadow, heavy
 * JPEG), with what Tesseract read from each in `<name>.txt` (fixtures/record.ts,
 * the app's settings). The brief's acceptance: title, author and publisher right
 * on at least four of five, the ISBN on all five.
 */
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.txt`, import.meta.url), "utf8");

const EXPECTED: Record<string, Omit<CipFields, "year"> & { year: number }> = {
  "1-pastoureau": { title: "Roz", subtitle: "istoria unei culori diafane", authors: ["Michel Pastoureau"], publisher: "For You", year: 2026, isbn13: "9786066398121" },
  "2-popa": { title: "Ferestrele Clujului", subtitle: "exerciții de memorie culturală", authors: ["Mircea Popa"], publisher: "Editura Școala Ardeleană", year: 2026, isbn13: "9786303143477" },
  // "coord.:" names editors, not authors.
  "3-jurnalismul": { title: "Jurnalismul tradițional și noile media", subtitle: "delimitări, practici și controverse", authors: [], publisher: "Eikon", year: 2026, isbn13: "9786064916341" },
  "4-odell": { title: "Anna - biografia", subtitle: null, authors: ["Amy Odell"], publisher: "Paralela 45", year: 2026, isbn13: "9789734744312" },
  "5-paleologu": { title: "Ce ne facem cu atîția proști?", subtitle: null, authors: ["Theodor Paleologu"], publisher: "Editura Trei", year: 2026, isbn13: "9786064031365" },
};

describe("readCipBlock, on what Tesseract read from the fixture photos", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    it(name, () => {
      const read = readCipBlock(fixture(name));
      expect(read.found).toBe(true);
      if (read.found) expect(read.fields).toEqual(expected);
    });
  }
});

describe("readCipBlock, on OCR's usual faults", () => {
  it("marks at a line's end, blank lines, and the main heading's line with no full stop", () => {
    const read = readCipBlock(
      [
        "Toate drepturile asupra acestei ediţii sunt rezervate editurii. = :",
        "Descrierea CIP a Bibliotecii Naţionale a României NR",
        "POPA, MIRCEA re",
        "",
        "Ferestrele Clujului : exerciţii de memorie culturală /",
        "Mircea Popa. - Ed. a 3-a, rev. - Cluj-",
        "Napoca : Editura Şcoala Ardeleană, 2026",
        "",
        "ISBN 978-630-314-347-7 - ul =",
        "008 : ci",
      ].join("\n"),
    );
    expect(read).toMatchObject({
      found: true,
      description:
        "POPA, MIRCEA re. Ferestrele Clujului : exerciții de memorie culturală / Mircea Popa. - Ed. a 3-a, rev. - Cluj-Napoca : Editura Școala Ardeleană, 2026",
      fields: { title: "Ferestrele Clujului", authors: ["Mircea Popa"], publisher: "Editura Școala Ardeleană", isbn13: "9786303143477" },
    });
  });

  it("stops at the imprint's year, so a note after it stays out", () => {
    const read = readCipBlock(
      "Descrierea CIP a Bibliotecii Naţionale a României\nODELL, AMY\nAnna - biografia / Amy Odell. - Piteşti :\nParalela 45, 2026\nTit. orig.: Anna, 2022\nISBN 978-973-47-4431-2",
    );
    expect(read.found && read.fields).toMatchObject({ publisher: "Paralela 45", year: 2026 });
  });

  it("stops at a note when the imprint has no year", () => {
    const read = readCipBlock(
      "Descrierea CIP a Bibliotecii Naţionale\na României\nDepăşirea dependenţei / John Brian Bransfield. - Roman :\nSerafica\nConţine bibliografie\nISBN 978-606-623-108-4",
    );
    expect(read.found && read.fields).toMatchObject({ title: "Depășirea dependenței", authors: ["John Brian Bransfield"], publisher: "Serafica" });
  });

  it("reads the ISBN through 1SBN, a colon, O for 0, and a line break inside it", () => {
    expect(tidyOcr("1SBN: 978-6O6-40-3136-5")).toBe("ISBN 978-606-40-3136-5");
    const text = (isbn: string) => `Descrierea CIP a Bibliotecii Naţionale a României\nCe ne facem / Theodor Paleologu. - Bucureşti : Editura Trei, 2026\n${isbn}`;
    expect(readCipBlock(text("lSBN 978-606-40-3136-5"))).toMatchObject({ fields: { isbn13: "9786064031365" } });
    expect(readCipBlock(text("ISBN 978-606-40-\n3136-5"))).toMatchObject({ fields: { isbn13: "9786064031365" } });
    // An ISBN-10 (books before 2007) is filled as its ISBN-13.
    expect(readCipBlock(text("ISBN 973-50-0478-X"))).toMatchObject({ fields: { isbn13: "9789735004781" } });
  });

  it("leaves the ISBN out when it doesn't check out, or when a set and its volumes give several", () => {
    const text = (tail: string) => `Descrierea CIP a Bibliotecii Naţionale a României\nPLATO\nOpera integrală / Platon. - Bucureşti : Humanitas, 2026-\n${tail}`;
    expect(readCipBlock(text("ISBN 976-973-50-9137-8"))).toMatchObject({ isbns: [], fields: { isbn13: null } });
    expect(readCipBlock(text("6 vol.\nISBN 978-973-50-9137-8\nVol. 1 : Apărarea lui Socrate. - 2026. - ISBN 978-973-50-9138-5"))).toMatchObject({
      isbns: ["9789735091378", "9789735091385"],
      fields: { title: "Opera integrală", authors: ["Platon"], isbn13: null },
    });
  });

  it("says when there is no CIP heading", () => {
    expect(readCipBlock("Toate drepturile rezervate.\nISBN 978-606-40-3136-5")).toEqual({ found: false });
    expect(readCipBlock("")).toEqual({ found: false });
  });
});
