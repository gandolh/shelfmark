import { describe, expect, it } from "vitest";
import { readDescription, romanian } from "./cip.js";

// Moved from server/src/cip/parse.test.ts with the code (brief 30), unchanged.

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

describe("ISBN and the package's `cip` namespace", () => {
  it("finds ISBNs written with hyphens or spaces, never across a line break", async () => {
    const { ISBN } = await import("./cip.js");
    const text = "ISBN 978-606-40-3136-5\nISBN 978 973 50 9137 8\nISBN 978-\n973-50-9138-5";
    expect([...text.matchAll(ISBN)].map((m) => m[1])).toEqual(["978-606-40-3136-5", "978 973 50 9137 8"]);
  });

  it("is what the server and the web app import", async () => {
    const { cip } = await import("./index.js");
    expect(cip.readDescription).toBe(readDescription);
    expect(cip.romanian).toBe(romanian);
  });
});
