import { to10 } from "@shelfmark/shared";
import {
  emptySourceDraft,
  LONG_TEXT_MAX,
  pagesOf,
  SUBJECTS_MAX,
  text,
  texts,
  yearOf,
  type SourceDraft,
} from "../merge.js";
import { languageOf } from "../openlibrary.js";

/**
 * ISO 2709 records in UNIMARC, as the Romanian library catalogs send them,
 * and the draft fields in one. The servers send UTF-8 whatever field 100
 * says about the character set (the Academy's records say 01 and are UTF-8),
 * so the text is read as UTF-8. BCU Cluj labels its records USMARC; the
 * content is UNIMARC all the same.
 */

const FIELD_END = 0x1e;
const SUBFIELD = 0x1f;
const RECORD_END = 0x1d;

export interface Field {
  tag: string;
  /** Control fields (001-009) have `data` and no subfields. */
  data?: string;
  indicators?: string;
  subfields?: [code: string, value: string][];
}

/** The fields of one ISO 2709 record; `null` when it isn't one. */
export function parseRecord(record: Buffer): Field[] | null {
  if (record.length < 25) return null;
  const leader = record.subarray(0, 24).toString("latin1");
  const base = Number(leader.slice(12, 17));
  if (!/^\d{5}$/.test(leader.slice(12, 17)) || base < 25 || base > record.length) return null;

  const fields: Field[] = [];
  for (let at = 24; at + 12 <= base - 1 && record[at] !== FIELD_END; at += 12) {
    const entry = record.subarray(at, at + 12).toString("latin1");
    if (!/^[0-9A-Za-z]{3}\d{9}$/.test(entry)) return null;
    const tag = entry.slice(0, 3);
    const length = Number(entry.slice(3, 7));
    const start = base + Number(entry.slice(7, 12));
    let bytes = record.subarray(start, Math.min(start + length, record.length));
    while (bytes.length > 0 && (bytes.at(-1) === FIELD_END || bytes.at(-1) === RECORD_END)) bytes = bytes.subarray(0, -1);

    if (/^00\d$/.test(tag)) {
      fields.push({ tag, data: bytes.toString("utf8") });
      continue;
    }
    const indicators = bytes.subarray(0, 2).toString("utf8");
    const subfields: [string, string][] = [];
    for (const part of split(bytes.subarray(2), SUBFIELD).slice(1)) {
      if (part.length === 0) continue;
      subfields.push([String.fromCharCode(part[0]!), part.subarray(1).toString("utf8")]);
    }
    fields.push({ tag, indicators, subfields });
  }
  return fields;
}

function split(bytes: Buffer, separator: number): Buffer[] {
  const parts: Buffer[] = [];
  let from = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === separator) {
      parts.push(bytes.subarray(from, i));
      from = i + 1;
    }
  }
  parts.push(bytes.subarray(from));
  return parts;
}

function all(fields: readonly Field[], tag: string): Field[] {
  return fields.filter((field) => field.tag === tag);
}

function sub(field: Field | undefined, code: string): string | undefined {
  return field?.subfields?.find(([c]) => c === code)?.[1];
}

function subs(field: Field, code: string): string[] {
  return (field.subfields ?? []).filter(([c]) => c === code).map(([, value]) => value);
}

/**
 * Catalog text as a person writes it: no non-sorting marks (`<<Un>> an` →
 * `Un an`, or the NSB/NSE control characters), no trailing ISBD punctuation,
 * and in a Romanian record ș and ț with the comma below rather than the
 * cedilla the catalogs still type.
 */
export function clean(value: string | undefined, romanian: boolean): string | undefined {
  if (value === undefined) return undefined;
  let out = value.replace(/<<|>>|[\u0088\u0089\u0098\u009c]/g, "").replace(/[\s/:;,=]+$/u, "");
  // A closing full stop goes, but not an ellipsis's or an initial's ("Emil M.").
  if (/[^.]\.$/u.test(out) && !/(^|[\s.])\p{L}\.$/u.test(out)) out = out.slice(0, -1);
  if (romanian) out = out.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
  return out.trim();
}

/** "543 p", "184, [8] p.", "251p. ; 18 cm" → the first page count; none for "vol." alone. */
function pagesIn(extent: string | undefined): number | null {
  const match = extent ? /(\d+)\s*(?:,\s*\[\d+\]\s*)?p\b/.exec(extent) : null;
  return match ? pagesOf(match[1]) : null;
}

/** 700/701 "$a Riordan $b Rick" → "Rick Riordan"; 710/711 → $a. */
function personName(field: Field, romanian: boolean): string | undefined {
  const surname = clean(sub(field, "a"), romanian);
  const forename = clean(sub(field, "b"), romanian);
  if (!surname) return undefined;
  return forename ? `${forename} ${surname}` : surname;
}

/** The ISBNs in a record's 010 fields, digits only (an ISBN-10 keeps its X). */
function isbnsOf(fields: readonly Field[]): string[] {
  return all(fields, "010")
    .flatMap((field) => subs(field, "a"))
    .map((value) => value.replace(/[^0-9Xx]/g, "").toUpperCase());
}

/** The record for this ISBN among those a search returned: the one whose 010 carries it, else the first. */
export function recordFor(isbn13: string, records: readonly Buffer[]): Field[] | undefined {
  const parsed = records.map(parseRecord).filter((fields): fields is Field[] => fields !== null);
  const isbn10 = to10(isbn13);
  return parsed.find((fields) => isbnsOf(fields).some((id) => id === isbn13 || id === isbn10)) ?? parsed[0];
}

/** The draft fields in a UNIMARC record. */
export function readUnimarc(fields: readonly Field[]): SourceDraft {
  const language = languageOf(sub(all(fields, "101")[0], "a"));
  const romanian = language === "ro" || language === null;
  const c = (value: string | undefined) => clean(value, romanian);

  const title = all(fields, "200")[0];
  const draft = emptySourceDraft();
  // A volume of a series: $a is the series, $i the volume's own title.
  draft.title = text(c(sub(title, "i")) ?? c(sub(title, "a")));
  draft.subtitle = text(c(sub(title, "e")));

  const people = ["700", "701", "710", "711"].flatMap((tag) => all(fields, tag));
  draft.authors = texts(people.map((field) => personName(field, romanian)));
  if (draft.authors.length === 0 && title) draft.authors = texts([c(sub(title, "f"))]);

  const imprint = all(fields, "210")[0] ?? all(fields, "214")[0];
  draft.publisher = text(c(sub(imprint, "c")));
  const coded = all(fields, "100")[0];
  draft.publishedYear = yearOf(sub(imprint, "d")) ?? yearOf(sub(coded, "a")?.slice(9, 13)) ?? yearOf(sub(imprint, "e"));

  draft.pages = pagesIn(sub(all(fields, "215")[0], "a"));
  draft.language = language;
  draft.description = text(c(sub(all(fields, "330")[0], "a")), LONG_TEXT_MAX);
  draft.subjects = texts(
    all(fields, "606").map((field) => c(sub(field, "a"))),
    SUBJECTS_MAX,
  );
  return draft;
}
