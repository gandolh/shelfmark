import {
  bitStringContent,
  booleanContent,
  child,
  constructed,
  CONTEXT,
  decode,
  integerContent,
  oidContent,
  primitive,
  readBoolean,
  readInteger,
  readString,
  UNIVERSAL,
  type Tlv,
} from "./ber.js";

/**
 * The Z39.50 (ISO 23950) PDUs a lookup sends and the answers it reads:
 * Init, Search with a type-1 (RPN) query on Bib-1 attributes, Present, and
 * diagnostics. The tags are the standard's (Z39-50-APDU-1995); its tagging is
 * explicit unless a field says IMPLICIT, so a CHOICE behind a tag gets a
 * wrapper. No server the lookup asks sends records with the search answer
 * (2026-10-17), so a hit always costs a Present too.
 */

export const OID = {
  bib1: "1.2.840.10003.3.1",
  unimarc: "1.2.840.10003.5.1",
  usmarc: "1.2.840.10003.5.10",
} as const;

export type RecordSyntax = "unimarc" | "usmarc";

/** Bib-1 use attribute 7: ISBN. */
const USE_ISBN = 7;
const RESULT_SET = "default";
const MESSAGE_SIZE = 1024 * 1024;

const ctx = (tag: number, content: Buffer) => primitive(CONTEXT, tag, content);
const ctxC = (tag: number, ...children: Buffer[]) => constructed(CONTEXT, tag, ...children);
const str = (value: string) => Buffer.from(value, "utf8");

export function initRequest(implementation: { name: string; version: string }): Buffer {
  return ctxC(
    20,
    ctx(3, bitStringContent([true, true, true])), // protocolVersion 1, 2, 3
    ctx(4, bitStringContent([true, true])), // options: search, present
    ctx(5, integerContent(MESSAGE_SIZE)), // preferredMessageSize
    ctx(6, integerContent(MESSAGE_SIZE)), // exceptionalRecordSize
    ctx(110, str("shelfmark")), // implementationId
    ctx(111, str(implementation.name)),
    ctx(112, str(implementation.version)),
  );
}

/** An RPNStructure `op`: one term on the ISBN index. */
function isbnTerm(isbn: string): Buffer {
  const attribute = constructed(UNIVERSAL, 16, ctx(120, integerContent(1)), ctx(121, integerContent(USE_ISBN)));
  return ctxC(0, ctxC(102, ctxC(44, attribute), ctx(45, str(isbn))));
}

/** The ISBNs OR-ed together, left to right. */
function anyOf(isbns: readonly string[]): Buffer {
  const [first, ...rest] = isbns;
  if (first === undefined) throw new Error("a search needs at least one ISBN");
  return rest.reduce(
    (left, isbn) => ctxC(1, left, isbnTerm(isbn), ctxC(46, ctx(1, Buffer.alloc(0)))), // rpnRpnOp, operator or
    isbnTerm(first),
  );
}

export function searchRequest(database: string, isbns: readonly string[], syntax: RecordSyntax): Buffer {
  return ctxC(
    22,
    ctx(13, integerContent(0)), // smallSetUpperBound
    ctx(14, integerContent(1)), // largeSetLowerBound
    ctx(15, integerContent(0)), // mediumSetPresentNumber
    ctx(16, booleanContent(true)), // replaceIndicator
    ctx(17, str(RESULT_SET)),
    ctxC(18, ctx(105, str(database))),
    ctx(104, oidContent(OID[syntax])),
    ctxC(21, ctxC(1, primitive(UNIVERSAL, 6, oidContent(OID.bib1)), anyOf(isbns))),
  );
}

export function presentRequest(count: number, syntax: RecordSyntax): Buffer {
  return ctxC(
    24,
    ctx(31, str(RESULT_SET)),
    ctx(30, integerContent(1)), // resultSetStartPoint
    ctx(29, integerContent(count)), // numberOfRecordsRequested
    ctxC(19, ctx(0, str("F"))), // recordComposition: simple, full records
    ctx(104, oidContent(OID[syntax])),
  );
}

export interface Diagnostic {
  condition: number;
  addinfo: string | null;
}

export type Answer =
  | { kind: "init"; accepted: boolean }
  | { kind: "search"; ok: boolean; hits: number; diagnostic: Diagnostic | null }
  | { kind: "present"; records: Buffer[]; diagnostic: Diagnostic | null }
  | { kind: "close" }
  | { kind: "other"; tag: number };

/** DefaultDiagFormat: `{ diagnosticSetId OID, condition INTEGER, addinfo }`. */
function diagnosticOf(format: Tlv | undefined): Diagnostic | null {
  if (!format?.children) return null;
  const condition = format.children.find((c) => c.cls === UNIVERSAL && c.tag === 2);
  const addinfo = format.children.find((c) => c.cls === UNIVERSAL && (c.tag === 26 || c.tag === 27));
  return { condition: condition ? readInteger(condition) : 0, addinfo: addinfo ? readString(addinfo) : null };
}

/** `records`: responseRecords [28], nonSurrogateDiagnostic [130] or multipleNonSurDiagnostics [205]. */
function readRecords(pdu: Tlv): { records: Buffer[]; diagnostic: Diagnostic | null } {
  const single = child(pdu, CONTEXT, 130);
  if (single) return { records: [], diagnostic: diagnosticOf(single) };
  const multiple = child(pdu, CONTEXT, 205);
  if (multiple) return { records: [], diagnostic: diagnosticOf(multiple.children?.[0]) };

  const records: Buffer[] = [];
  for (const namePlusRecord of child(pdu, CONTEXT, 28)?.children ?? []) {
    // record [1] CHOICE { retrievalRecord [1] EXTERNAL, surrogateDiagnostic [2] DiagRec, ... }
    const retrieval = child(child(namePlusRecord, CONTEXT, 1) ?? namePlusRecord, CONTEXT, 1);
    const external = retrieval && child(retrieval, UNIVERSAL, 8);
    // EXTERNAL { direct-reference OID, encoding CHOICE { ..., octet-aligned [1] IMPLICIT OCTET STRING } }
    const octets = external && child(external, CONTEXT, 1);
    if (!octets) continue;
    records.push(
      octets.constructed ? Buffer.concat((octets.children ?? []).map((part) => part.value)) : Buffer.from(octets.value),
    );
  }
  return { records, diagnostic: null };
}

/** Reads one answer PDU. Throws on anything that is not BER. */
export function readAnswer(buf: Buffer): Answer {
  const { tlv } = decode(buf);
  if (tlv.cls !== CONTEXT || !tlv.constructed) return { kind: "other", tag: tlv.tag };
  switch (tlv.tag) {
    case 21: {
      const result = child(tlv, CONTEXT, 12);
      return { kind: "init", accepted: result ? readBoolean(result) : false };
    }
    case 23: {
      const count = child(tlv, CONTEXT, 23);
      const status = child(tlv, CONTEXT, 22);
      return {
        kind: "search",
        ok: status ? readBoolean(status) : false,
        hits: count ? readInteger(count) : 0,
        diagnostic: readRecords(tlv).diagnostic,
      };
    }
    case 25:
      return { kind: "present", ...readRecords(tlv) };
    case 48:
      return { kind: "close" };
    default:
      return { kind: "other", tag: tlv.tag };
  }
}

