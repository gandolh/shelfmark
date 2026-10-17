import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createQueue } from "../lookup/queue.js";
import { fakeFetch, json } from "../testing/fakeFetch.js";
import { issueMonth, issuesIn, listIssues } from "./issues.js";

/** Eleven entries of the real media listing, 2026-10-17: issues in every spelling, and documents that aren't. */
const MEDIA = JSON.parse(readFileSync(new URL("./fixtures/media-page.json", import.meta.url), "utf8")) as unknown[];

describe("issueMonth", () => {
  it.each([
    ["https://bibnat.ro/wp-content/uploads/2026/08/CIP_februarie-2026.pdf", "2026-02"],
    ["https://bibnat.ro/wp-content/uploads/2025/10/CIP-martie_2025.pdf", "2025-03"],
    ["https://bibnat.ro/wp-content/uploads/2024/03/CIP_iulie-2023_site.pdf", "2023-07"],
    ["https://bibnat.ro/wp-content/uploads/2025/03/BIBLIOGR-CIP-SEP-2024.pdf", "2024-09"],
    ["https://bibnat.ro/wp-content/uploads/2023/09/Bibliografia-cartilor-in-curs-de-aparitie-CIP-ianuarie-2019.pdf", "2019-01"],
  ])("reads %s as %s", (url, month) => {
    expect(issueMonth(url)).toBe(month);
  });

  it.each([
    "https://bibnat.ro/wp-content/uploads/2025/06/Regulament-CIP.pdf",
    "https://bibnat.ro/wp-content/uploads/2026/07/Info-GDPR-CIP.pdf",
    "https://bibnat.ro/wp-content/uploads/2025/05/CIP-Actualizari-site-2025.doc",
    "https://bibnat.ro/wp-content/uploads/2023/09/Declaratie-aderare-principii-SNA-2021-2025_mai-2023.pdf",
    "https://example.com/wp-content/uploads/2026/08/CIP_februarie-2026.pdf", // not the library's site
    "http://bibnat.ro/wp-content/uploads/2026/08/CIP_februarie-2026.pdf", // not https
    "https://bibnat.ro/elsewhere/CIP_februarie-2026.pdf",
    "not a url",
  ])("refuses %s", (url) => {
    expect(issueMonth(url)).toBeNull();
  });
});

describe("issuesIn", () => {
  it("keeps one issue per month, the later upload, newest month first", () => {
    expect(issuesIn(MEDIA)).toEqual([
      { month: "2026-03", url: "https://bibnat.ro/wp-content/uploads/2026/08/CIP_martie-2026.pdf", uploaded: "2026-08-27T12:03:21" },
      { month: "2026-02", url: "https://bibnat.ro/wp-content/uploads/2026/08/CIP_februarie-2026.pdf", uploaded: "2026-08-18T10:00:51" },
      { month: "2026-01", url: "https://bibnat.ro/wp-content/uploads/2026/08/CIP_ianuarie-2026.pdf", uploaded: "2026-08-18T10:00:56" },
      { month: "2025-03", url: "https://bibnat.ro/wp-content/uploads/2025/10/CIP-martie_2025.pdf", uploaded: "2025-10-27T10:15:54" },
      // Uploaded twice; the later one.
      { month: "2024-09", url: "https://bibnat.ro/wp-content/uploads/2025/04/CIP-septembrie_2024.pdf", uploaded: "2025-04-03T10:56:57" },
      { month: "2023-07", url: "https://bibnat.ro/wp-content/uploads/2024/03/CIP_iulie-2023_site.pdf", uploaded: "2024-03-19T12:59:29" },
      {
        month: "2019-01",
        url: "https://bibnat.ro/wp-content/uploads/2023/09/Bibliografia-cartilor-in-curs-de-aparitie-CIP-ianuarie-2019.pdf",
        uploaded: "2023-09-05T18:24:39",
      },
    ]);
  });

  it("skips entries that aren't shaped like the listing's", () => {
    expect(issuesIn([null, 42, { source_url: 1, date: "x" }, { date: "2026-01-01" }])).toEqual([]);
  });
});

describe("listIssues", () => {
  it("pages through the listing until a short page, naming the app", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ source_url: `https://bibnat.ro/wp-content/uploads/x/doc-${i}.pdf`, date: "2026-01-01" }));
    const fetch = fakeFetch((url) => (url.searchParams.get("page") === "1" ? json(full) : json(MEDIA)));
    const issues = await listIssues(fetch, createQueue(0));
    expect(issues).toHaveLength(7);
    expect(fetch.calls.map((call) => call.url.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(fetch.calls[0]?.url.origin + fetch.calls[0]!.url.pathname).toBe("https://bibnat.ro/wp-json/wp/v2/media");
    expect(fetch.calls[0]?.url.searchParams.get("search")).toBe("CIP");
    expect(fetch.calls[0]?.headers.get("user-agent")).toMatch(/^Shelfmark\//);
  });

  it("fails when the site does", async () => {
    await expect(listIssues(fakeFetch(() => json({}, 503)), createQueue(0))).rejects.toThrow(
      "The national library's site answered 503",
    );
  });
});
