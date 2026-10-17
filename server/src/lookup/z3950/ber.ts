/**
 * The slice of BER (ASN.1 Basic Encoding Rules) Z39.50 needs: tags in any
 * class and of any number, definite lengths when encoding, definite and
 * indefinite ones when decoding, integers, booleans, strings, OIDs and bit
 * strings. Enough for the PDUs in protocol.ts, nothing more.
 */

export const UNIVERSAL = 0x00;
export const CONTEXT = 0x80;
const CONSTRUCTED = 0x20;

/** One decoded element. `children` is set for a constructed one, `value` always. */
export interface Tlv {
  cls: number;
  constructed: boolean;
  tag: number;
  value: Buffer;
  children?: Tlv[];
}

// Encoding.

function encodeTag(cls: number, constructed: boolean, tag: number): Buffer {
  const first = cls | (constructed ? CONSTRUCTED : 0);
  if (tag < 31) return Buffer.from([first | tag]);
  const sevens: number[] = [];
  for (let rest = tag; ; rest = Math.floor(rest / 128)) {
    sevens.unshift(rest % 128);
    if (rest < 128) break;
  }
  return Buffer.from([first | 0x1f, ...sevens.map((seven, i) => (i < sevens.length - 1 ? seven | 0x80 : seven))]);
}

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** A primitive element. */
export function primitive(cls: number, tag: number, content: Buffer): Buffer {
  return Buffer.concat([encodeTag(cls, false, tag), encodeLength(content.length), content]);
}

/** A constructed element around already encoded children. */
export function constructed(cls: number, tag: number, ...children: Buffer[]): Buffer {
  const content = Buffer.concat(children);
  return Buffer.concat([encodeTag(cls, true, tag), encodeLength(content.length), content]);
}

/** A non-negative integer's content octets, two's complement, shortest form. */
export function integerContent(value: number): Buffer {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`not a non-negative integer: ${value}`);
  const bytes: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  if (bytes.length === 0 || bytes[0]! & 0x80) bytes.unshift(0);
  return Buffer.from(bytes);
}

export function booleanContent(value: boolean): Buffer {
  return Buffer.from([value ? 0xff : 0x00]);
}

/** "1.2.840.10003.3.1" → its content octets. */
export function oidContent(oid: string): Buffer {
  const arcs = oid.split(".").map(Number);
  if (arcs.length < 2 || arcs.some((arc) => !Number.isSafeInteger(arc) || arc < 0)) throw new RangeError(`not an OID: ${oid}`);
  const out: number[] = [];
  for (const arc of [arcs[0]! * 40 + arcs[1]!, ...arcs.slice(2)]) {
    const sevens: number[] = [];
    for (let rest = arc; ; rest = Math.floor(rest / 128)) {
      sevens.unshift(rest % 128);
      if (rest < 128) break;
    }
    out.push(...sevens.map((seven, i) => (i < sevens.length - 1 ? seven | 0x80 : seven)));
  }
  return Buffer.from(out);
}

/** Bits in order, bit 0 first, as a BIT STRING's content octets. */
export function bitStringContent(bits: readonly boolean[]): Buffer {
  const bytes = Buffer.alloc(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    if (bit) bytes[i >> 3]! |= 0x80 >> (i & 7);
  });
  return Buffer.concat([Buffer.from([bytes.length * 8 - bits.length]), bytes]);
}

// Decoding.

/** Thrown when the buffer ends inside an element: wait for more bytes. */
export class Incomplete extends Error {
  constructor() {
    super("BER element is incomplete");
  }
}

const MAX_DEPTH = 32;

function decodeAt(buf: Buffer, offset: number, depth: number): { tlv: Tlv; end: number } {
  if (depth > MAX_DEPTH) throw new Error("BER nesting is too deep");
  let at = offset;
  const byte = (): number => {
    if (at >= buf.length) throw new Incomplete();
    return buf[at++]!;
  };

  const first = byte();
  const cls = first & 0xc0;
  const isConstructed = (first & CONSTRUCTED) !== 0;
  let tag = first & 0x1f;
  if (tag === 0x1f) {
    tag = 0;
    for (let next = byte(), count = 0; ; next = byte(), count++) {
      if (count > 4) throw new Error("BER tag number is too large");
      tag = tag * 128 + (next & 0x7f);
      if ((next & 0x80) === 0) break;
    }
  }

  const lengthByte = byte();
  if (lengthByte === 0x80) {
    if (!isConstructed) throw new Error("BER primitive element with an indefinite length");
    const children: Tlv[] = [];
    for (;;) {
      if (at + 1 >= buf.length) throw new Incomplete();
      if (buf[at] === 0 && buf[at + 1] === 0) {
        const value = buf.subarray(offset, at);
        return { tlv: { cls, constructed: true, tag, value, children }, end: at + 2 };
      }
      const child = decodeAt(buf, at, depth + 1);
      children.push(child.tlv);
      at = child.end;
    }
  }

  let length = lengthByte;
  if (lengthByte & 0x80) {
    const count = lengthByte & 0x7f;
    if (count > 4) throw new Error("BER length is too large");
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + byte();
  }
  const end = at + length;
  if (end > buf.length) throw new Incomplete();
  const value = buf.subarray(at, end);
  if (!isConstructed) return { tlv: { cls, constructed: false, tag, value }, end };

  const children: Tlv[] = [];
  for (let child = at; child < end; ) {
    const decoded = decodeAt(buf.subarray(0, end), child, depth + 1);
    children.push(decoded.tlv);
    child = decoded.end;
  }
  return { tlv: { cls, constructed: true, tag, value, children }, end };
}

/** The first element in `buf` and where it ends. Throws `Incomplete` when `buf` holds only part of it. */
export function decode(buf: Buffer): { tlv: Tlv; end: number } {
  return decodeAt(buf, 0, 0);
}

export function readInteger(tlv: Tlv): number {
  if (tlv.value.length === 0 || tlv.value.length > 6) throw new Error("BER integer of an unexpected size");
  return tlv.value.readIntBE(0, tlv.value.length);
}

export function readBoolean(tlv: Tlv): boolean {
  return tlv.value.length > 0 && tlv.value[0] !== 0;
}

/** VisibleString, GeneralString, InternationalString: the servers send ASCII or UTF-8. */
export function readString(tlv: Tlv): string {
  return tlv.value.toString("utf8");
}

export function readOid(tlv: Tlv): string {
  const arcs: number[] = [];
  let arc = 0;
  for (const byte of tlv.value) {
    arc = arc * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      arcs.push(arc);
      arc = 0;
    }
  }
  if (arcs.length === 0) return "";
  const head = arcs[0]!;
  const [a, b] = head < 80 ? [Math.floor(head / 40), head % 40] : [2, head - 80];
  return [a, b, ...arcs.slice(1)].join(".");
}

/** The direct child with this class and tag. */
export function child(tlv: Tlv, cls: number, tag: number): Tlv | undefined {
  return tlv.children?.find((c) => c.cls === cls && c.tag === tag);
}
