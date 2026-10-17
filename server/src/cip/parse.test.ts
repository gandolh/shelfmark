import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIssue, readDescription, romanian } from "./parse.js";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("parseIssue, on excerpts of real issues", () => {
  const feb2026 = parseIssue(fixture("cip-2026-02-excerpt.txt"));
  const mar2019 = parseIssue(fixture("cip-2019-03-excerpt.txt"));
  const byIsbn = (records: typeof feb2026, isbn13: string) => records.find((r) => r.isbn13 === isbn13);

  it("reads every ISBN in the excerpt, across a page break and section headings", () => {
    expect(feb2026.map((r) => r.entry)).toEqual([28, 29, 30, 31, 32, 33, 34, 35, 267, 268, 268]);
  });

  it("an author heading: title, subtitle, author from the statement, imprint", () => {
    expect(byIsbn(feb2026, "9786066398121")).toEqual({
      isbn13: "9786066398121",
      entry: 28,
      title: "Roz",
      subtitle: "istoria unei culori diafane",
      authors: ["Michel Pastoureau"], // "; trad. din lb. franceză de Ana-Maria Datcu" left out
      publisher: "For You", // "For\nYou" across the line
      city: "București",
      year: 2026,
    });
  });

  it("comma-below ș and ț, though the lists type cedillas", () => {
    expect(byIsbn(feb2026, "9786064031365")).toMatchObject({
      title: "Ce ne facem cu atîția proști?",
      authors: ["Theodor Paleologu"],
      publisher: "Editura Trei",
      year: 2026,
    });
  });

  it("an edition statement before the imprint", () => {
    expect(byIsbn(feb2026, "9786066398084")).toMatchObject({ title: "Verde", publisher: "For You", city: "București" });
    expect(byIsbn(feb2026, "9786303143477")).toMatchObject({ publisher: "Editura Școala Ardeleană", city: "Cluj-Napoca" });
  });

  it("anonymous works and editors name no author", () => {
    expect(byIsbn(feb2026, "9786064916341")).toMatchObject({ title: "Jurnalismul tradițional și noile media", authors: [] });
    expect(byIsbn(feb2026, "9786306632176")).toMatchObject({ title: "30 ani de lumină în fraternitate", authors: [] });
  });

  it("a multi-volume work: the set's ISBN, and a volume's broken across lines with its own subtitle", () => {
    expect(byIsbn(feb2026, "9789735091378")).toMatchObject({ title: "Opera integrală", subtitle: null, authors: ["Platon"] });
    expect(byIsbn(feb2026, "9789735091385")).toMatchObject({
      title: "Opera integrală",
      subtitle: expect.stringMatching(/^Vol\. 1 : Apărarea lui Socrate, Criton, .*, Lysis$/),
      publisher: "Humanitas",
      year: 2026,
    });
  });

  it("a 2019 volume with its own imprint, and titles before a name", () => {
    expect(byIsbn(mar2019, "9786066231084")?.authors).toEqual(["Cristiana Sîrbu"]); // "assoc. prof. PhD. eng."
    expect(byIsbn(mar2019, "9789731088754")).toMatchObject({
      title: "Valea Almăjului - oameni și fapte",
      subtitle: "Cartea 4 : Valea Almăjului - oameni și fapte",
      publisher: "Artpress", // the volume's, not the set's Excelsior Art
      city: "Timișoara",
      year: 2019,
    });
    expect(byIsbn(mar2019, "9789735923662")).toMatchObject({ publisher: "Excelsior Art", year: 2016 });
  });

  it("gives nothing for text that isn't an issue", () => {
    expect(parseIssue("")).toEqual([]);
    expect(parseIssue("        1. Descrierile CIP sunt realizate exclusiv pe baza informaţiilor\nfurnizate de către editori.")).toEqual([]);
  });
});

describe("readDescription", () => {
  it("a heading with an epithet, and a statement led by a phrase", () => {
    expect(
      readDescription("THEOPHYLACT, sfânt. Tîlcuirea Epistolelor / de Sfîntul Teofilact. - Bucureşti : Editura Sophia, 2019"),
    ).toMatchObject({ title: "Tîlcuirea Epistolelor", authors: ["Sfîntul Teofilact"], publisher: "Editura Sophia" });
    expect(readDescription("Cele mai ciudate locuri / prezentate de Dan-Silviu Boerescu. - Bucureşti : Integral, 2019").authors).toEqual(
      ["Dan-Silviu Boerescu"],
    );
    expect(readDescription("Mineiul / publicat cu binecuvântarea Preafericitului Părinte Daniel. - Bucureşti : IBMO, 2026").authors).toEqual(
      [],
    );
  });

  it("falls back on a person's heading when the statement names nobody", () => {
    expect(readDescription("ODELL, AMY. Anna - biografia. - Piteşti : Paralela 45, 2026")).toMatchObject({
      title: "Anna - biografia",
      authors: ["Amy Odell"],
    });
    // A body or an event isn't an author.
    expect(
      readDescription("SALONUL NAŢIONAL DE PLASTICĂ MICĂ (2019 ; Brăila). Salonul Naţional : ediţia a XX-a, 2019 - Brăila : Istros, 2019"),
    ).toMatchObject({ title: "Salonul Naţional", authors: [], publisher: "Istros", city: "Brăila" });
  });

  it("imprints with no year, no place, or a second place", () => {
    expect(readDescription("Depăşirea dependenţei / John Brian Bransfield. - Roman : Serafica.")).toMatchObject({
      city: "Roman",
      publisher: "Serafica",
      year: null,
    });
    expect(readDescription("Soartă amară : roman / Balogh Ernest. - Editura Andromeda, 2019")).toMatchObject({
      city: null,
      publisher: "Editura Andromeda",
      year: 2019,
    });
    expect(readDescription("Managementul proiectelor / Mihai Botezatu. - Bârlad : Universul academic ; Bucureşti : X, 2019").publisher).toBe(
      "Universul academic",
    );
    expect(readDescription("1918 - 2018 : centenar / Ion Pop. - Cluj-Napoca : Eikon, 2018")).toMatchObject({
      title: "1918 - 2018",
      subtitle: "centenar",
      publisher: "Eikon",
    });
  });

  it("several authors, titles and roles in the statement", () => {
    expect(
      readDescription(
        "Culegere / conf. univ. dr. Cristian Uţă, conf. univ. dr. Mariana Iatagan, prof. univ. dr. Daniela Paşnicu. - Bucureşti : X, 2026",
      ).authors,
    ).toEqual(["Cristian Uţă", "Mariana Iatagan", "Daniela Paşnicu"]);
    expect(readDescription("Libertate / Angela Merkel cu Beate Baumann ; trad. de X. - Bucureşti : Litera, 2024").authors).toEqual([
      "Angela Merkel",
      "Beate Baumann",
    ]);
    expect(readDescription("Ghid / coord.: Alina Popa. - Bucureşti : Media Med, 2026").authors).toEqual([]);
  });
});

describe("romanian", () => {
  it("swaps the cedilla forms for the comma-below ones", () => {
    expect(romanian("Bucureşti, Ţara Haţegului, ŞCOALA")).toBe("București, Țara Hațegului, ȘCOALA");
  });
});
