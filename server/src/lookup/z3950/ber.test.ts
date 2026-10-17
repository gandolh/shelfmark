import { describe, expect, it } from "vitest";
import {
  bitStringContent,
  constructed,
  CONTEXT,
  decode,
  Incomplete,
  integerContent,
  oidContent,
  primitive,
  readInteger,
  readOid,
  UNIVERSAL,
} from "./ber.js";

const hex = (buf: Buffer) => buf.toString("hex");

describe("BER encoding", () => {
  it("writes low and high tag numbers in every class", () => {
    expect(hex(primitive(CONTEXT, 13, Buffer.from([0])))).toBe("8d0100");
    expect(hex(primitive(CONTEXT, 105, Buffer.from("CUC01")))).toBe("9f69054355433031");
    expect(hex(primitive(CONTEXT, 130, Buffer.alloc(0)))).toBe("9f810200");
    expect(hex(constructed(CONTEXT, 102))).toBe("bf6600");
    expect(hex(constructed(UNIVERSAL, 16))).toBe("3000");
  });

  it("writes short and long lengths", () => {
    expect(hex(primitive(UNIVERSAL, 4, Buffer.alloc(127))).slice(0, 4)).toBe("047f");
    expect(hex(primitive(UNIVERSAL, 4, Buffer.alloc(128))).slice(0, 6)).toBe("048180");
    expect(hex(primitive(UNIVERSAL, 4, Buffer.alloc(300))).slice(0, 8)).toBe("0482012c");
  });

  it("writes integers in their shortest two's complement form", () => {
    expect(hex(integerContent(0))).toBe("00");
    expect(hex(integerContent(127))).toBe("7f");
    expect(hex(integerContent(128))).toBe("0080");
    expect(hex(integerContent(1024 * 1024))).toBe("100000");
    expect(() => integerContent(-1)).toThrow(RangeError);
  });

  it("writes OIDs, Bib-1's as yaz does", () => {
    expect(hex(oidContent("1.2.840.10003.3.1"))).toBe("2a8648ce130301");
    expect(readOid({ cls: UNIVERSAL, constructed: false, tag: 6, value: oidContent("1.2.840.10003.5.10") })).toBe(
      "1.2.840.10003.5.10",
    );
  });

  it("writes bit strings from bit 0", () => {
    expect(hex(bitStringContent([true, true, true]))).toBe("05e0");
    expect(hex(bitStringContent([true, true]))).toBe("06c0");
    expect(hex(bitStringContent(Array.from({ length: 9 }, () => true)))).toBe("07ff80");
  });
});

describe("BER decoding", () => {
  it("reads back what it writes, children included", () => {
    const pdu = constructed(CONTEXT, 23, primitive(CONTEXT, 23, integerContent(300)), primitive(CONTEXT, 130, Buffer.from("x")));
    const { tlv, end } = decode(Buffer.concat([pdu, Buffer.from("trailing")]));
    expect(end).toBe(pdu.length);
    expect(tlv).toMatchObject({ cls: CONTEXT, constructed: true, tag: 23 });
    expect(tlv.children?.map((child) => child.tag)).toEqual([23, 130]);
    expect(readInteger(tlv.children![0]!)).toBe(300);
  });

  it("reads an indefinite length", () => {
    const { tlv, end } = decode(Buffer.from("b78097010500 00ff".replace(/ /g, ""), "hex"));
    expect(end).toBe(7);
    expect(readInteger(tlv.children![0]!)).toBe(5);
  });

  it("says Incomplete while an answer is still arriving", () => {
    const pdu = constructed(CONTEXT, 25, primitive(UNIVERSAL, 4, Buffer.alloc(500)));
    for (const cut of [0, 1, 3, 100, pdu.length - 1]) {
      expect(() => decode(pdu.subarray(0, cut))).toThrow(Incomplete);
    }
    expect(decode(pdu).end).toBe(pdu.length);
  });

  it("rejects what can't be BER instead of looping", () => {
    expect(() => decode(Buffer.from("0480", "hex"))).toThrow(/indefinite/);
    expect(() => decode(Buffer.from("0485ffffffffff", "hex"))).toThrow(/too large/);
    const deep = Array.from({ length: 40 }).reduce<Buffer>((inner) => constructed(UNIVERSAL, 16, inner), Buffer.alloc(0));
    expect(() => decode(deep)).toThrow(/too deep/);
  });
});
