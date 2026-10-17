import { describe, expect, it } from "vitest";
import { fixtureAnswers } from "../../testing/fakeLibraries.js";
import { CONTEXT, decode, readInteger, readOid, type Tlv } from "./ber.js";
import { initRequest, presentRequest, readAnswer, searchRequest } from "./protocol.js";

function find(tlv: Tlv, tag: number): Tlv | undefined {
  return tlv.children?.find((child) => child.cls === CONTEXT && child.tag === tag);
}

function terms(tlv: Tlv): string[] {
  if (tlv.cls === CONTEXT && tlv.tag === 45) return [tlv.value.toString("utf8")];
  return (tlv.children ?? []).flatMap(terms);
}

describe("requests", () => {
  it("names Shelfmark in the Init and asks for search and present", () => {
    const { tlv } = decode(initRequest({ name: "Shelfmark", version: "1.0.0" }));
    expect(tlv.tag).toBe(20);
    expect(find(tlv, 4)?.value.toString("hex")).toBe("06c0");
    expect(find(tlv, 111)?.value.toString("utf8")).toBe("Shelfmark");
    expect(find(tlv, 112)?.value.toString("utf8")).toBe("1.0.0");
  });

  it("ORs the ISBN-13 and the ISBN-10 on the ISBN index, against the database, asking for the syntax", () => {
    const { tlv } = decode(searchRequest("RAL01", ["9789735761868", "9735761866"], "unimarc"));
    expect(tlv.tag).toBe(22);
    expect(find(find(tlv, 18)!, 105)?.value.toString("utf8")).toBe("RAL01");
    expect(readOid({ ...find(tlv, 104)!, cls: 0, tag: 6 })).toBe("1.2.840.10003.5.1");

    const rpn = find(tlv, 21)!.children![0]!; // type-1
    expect(readOid(rpn.children![0]!)).toBe("1.2.840.10003.3.1");
    const or = rpn.children![1]!;
    expect(or.tag).toBe(1); // rpnRpnOp
    expect(find(or, 46)?.children?.[0]?.tag).toBe(1); // operator: or
    expect(terms(tlv)).toEqual(["9789735761868", "9735761866"]);
    // Each term: use attribute (type 1) 7, ISBN.
    const attribute = find(find(or.children![0]!, 102)!, 44)!.children![0]!;
    expect(attribute.children!.map(readInteger)).toEqual([1, 7]);
  });

  it("asks a 979 ISBN alone, as a plain term", () => {
    const { tlv } = decode(searchRequest("CUC01", ["9791234567896"], "usmarc"));
    const rpn = find(tlv, 21)!.children![0]!;
    expect(rpn.children![1]!.tag).toBe(0); // op, not rpnRpnOp
    expect(terms(tlv)).toEqual(["9791234567896"]);
  });

  it("presents full records from the default result set", () => {
    const { tlv } = decode(presentRequest(3, "usmarc"));
    expect(tlv.tag).toBe(24);
    expect(find(tlv, 31)?.value.toString("utf8")).toBe("default");
    expect(readInteger(find(tlv, 29)!)).toBe(3);
    expect(find(find(tlv, 19)!, 0)?.value.toString("utf8")).toBe("F");
  });

  it("refuses a search with no ISBN", () => {
    expect(() => searchRequest("CUC01", [], "usmarc")).toThrow();
  });
});

describe("answers, as recorded from the libraries", () => {
  it("reads an accepted Init, a hit and the record", () => {
    const [init, search, present] = fixtureAnswers("biblacad-piramida").map(readAnswer);
    expect(init).toEqual({ kind: "init", accepted: true });
    expect(search).toEqual({ kind: "search", ok: true, hits: 1, diagnostic: null });
    expect(present?.kind).toBe("present");
    if (present?.kind !== "present") return;
    expect(present.records).toHaveLength(1);
    expect(present.records[0]!.subarray(0, 5).toString("latin1")).toMatch(/^\d{5}$/);
  });

  it("reads no hits", () => {
    const answers = fixtureAnswers("bcucluj-not-found").map(readAnswer);
    expect(answers).toEqual([
      { kind: "init", accepted: true },
      { kind: "search", ok: true, hits: 0, diagnostic: null },
    ]);
  });

  it("reads a diagnostic: BCU Cluj has no UNIMARC syntax", () => {
    const present = readAnswer(fixtureAnswers("bcucluj-unimarc-refused")[2]!);
    expect(present).toEqual({
      kind: "present",
      records: [],
      diagnostic: { condition: 238, addinfo: "Available syntax: USmarc, OPAC, XML, SUTRS" },
    });
  });
});
