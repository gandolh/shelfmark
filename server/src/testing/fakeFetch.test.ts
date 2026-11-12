import { describe, expect, it } from "vitest";
import { fakeFetch, fixture, hasFixture, recordedInternet } from "./fakeFetch.js";
import { FIXTURE_NAMES, loadFixture } from "./fakeLibraries.js";

// `hasFixture` answers false for a name it can't find, and the recorded Internet then answers `{}` ("not
// found") for every ISBN: a stale fixtures path would turn the lookup tests into "nothing found" quietly.
describe("the recorded fixtures are found where the fakes look", () => {
  it("finds Open Library's and Google Books' recorded answers", () => {
    expect(hasFixture("openlibrary-data-9780547928227")).toBe(true);
    expect(hasFixture("googlebooks-9780547928227")).toBe(true);
    expect(hasFixture("openlibrary-data-0000000000000")).toBe(false);
    expect(fixture("googlebooks-9780547928227")).toBeTruthy();
  });

  it("answers a recorded ISBN with its fixture and an unknown one with nothing", async () => {
    const fetch = fakeFetch(recordedInternet);
    const url = (isbn: string) => `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;
    const known = (await (await fetch(url("9780547928227"))).json()) as Record<string, unknown>;
    expect(Object.keys(known)).toEqual(["ISBN:9780547928227"]);
    expect(await (await fetch(url("9780306406157"))).json()).toEqual({});
  });

  it("loads every recorded library conversation", () => {
    for (const name of FIXTURE_NAMES) expect(loadFixture(name).answers.length).toBeGreaterThan(0);
  });
});
