/** Strip spaces, hyphens and dots; a trailing `x` becomes `X`. */
export function clean(input: string): string {
  return input.replace(/[\s.-]/g, "").replace(/x$/, "X");
}

function check13(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Check digit of an ISBN-10 from its first nine digits; 10 stands for `X`. */
function check10(first9: string): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(first9[i]) * (10 - i);
  return (11 - (sum % 11)) % 11;
}

export function isValid13(digits: string): boolean {
  return /^\d{13}$/.test(digits) && check13(digits.slice(0, 12)) === Number(digits[12]);
}

/** `X` is allowed as the last character only. */
export function isValid10(chars: string): boolean {
  if (!/^\d{9}[\dX]$/.test(chars)) return false;
  const last = chars[9] === "X" ? 10 : Number(chars[9]);
  return check10(chars.slice(0, 9)) === last;
}

/** ISBN-10 to ISBN-13; the input is assumed valid. */
export function to13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`;
  return `${body}${check13(body)}`;
}

/** ISBN-13 to ISBN-10; `null` for 979 (no ten-digit form) and anything not 978. */
export function to10(isbn13: string): string | null {
  if (!isbn13.startsWith("978")) return null;
  const body = isbn13.slice(3, 12);
  const check = check10(body);
  return `${body}${check === 10 ? "X" : check}`;
}

export type ParseIsbnResult =
  | { ok: true; isbn13: string }
  | { ok: false; reason: "length" | "checksum" | "not_isbn" };

export function parseIsbn(input: string): ParseIsbnResult {
  const code = clean(input);
  if (code.length !== 10 && code.length !== 13) return { ok: false, reason: "length" };
  if (code.length === 10) {
    if (!/^\d{9}[\dX]$/.test(code)) return { ok: false, reason: "not_isbn" };
    return isValid10(code)
      ? { ok: true, isbn13: to13(code) }
      : { ok: false, reason: "checksum" };
  }
  if (!/^\d{13}$/.test(code)) return { ok: false, reason: "not_isbn" };
  // Only a 978/979 prefix makes an EAN-13 an ISBN, so judge the prefix first.
  if (!/^97[89]/.test(code)) return { ok: false, reason: "not_isbn" };
  return isValid13(code) ? { ok: true, isbn13: code } : { ok: false, reason: "checksum" };
}

export type BarcodeClass =
  | { kind: "isbn"; isbn13: string }
  | { kind: "addon" }
  | { kind: "other"; code: string };

/**
 * Sort a scanned code. `format` is the BarcodeDetector format (`ean_13`,
 * `ean_8`, `upc_a`, `upc_e`, `code_128`); without it the digits' shape decides.
 */
export function classifyBarcode(raw: string, format?: string): BarcodeClass {
  const code = clean(raw);
  const digitsOnly = /^\d+$/.test(code);
  const isEan13 = format === undefined ? digitsOnly && code.length === 13 : format === "ean_13";
  if (isEan13 && /^97[89]\d{10}$/.test(code) && isValid13(code)) {
    return { kind: "isbn", isbn13: code };
  }
  // Add-ons are only 2 or 5 digits wide; a Code-128 label of that length is not one.
  const addonFormat = format === undefined || format === "ean_2" || format === "ean_5";
  if (addonFormat && digitsOnly && (code.length === 2 || code.length === 5)) {
    return { kind: "addon" };
  }
  // Keep the label as scanned; only ISBN detection needs the cleaned form.
  return { kind: "other", code: raw.trim() };
}
