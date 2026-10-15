/**
 * Prices are typed in lei with two decimals and stored in bani (`priceMinor`,
 * lei × 100). Integer maths on the digits, never a float: 19.99 × 100 is
 * 1998.9999999999998 in JavaScript.
 */

/** "49", "49.9", "49,90" or "1 234,50" → bani; `null` when blank; `"invalid"` when it isn't a price. */
export function parseLei(text: string): number | null | "invalid" {
  const compact = text.replace(/\s/g, "");
  if (compact === "") return null;
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(compact);
  if (!match) return "invalid";
  const lei = Number(match[1]);
  const bani = Number((match[2] ?? "").padEnd(2, "0") || "0");
  return lei * 100 + bani;
}

/** Bani → the field's text: 4990 → "49.90". */
export function formatLei(bani: number): string {
  const lei = Math.floor(bani / 100);
  return `${lei}.${String(bani % 100).padStart(2, "0")}`;
}

/** "49.90 RON", for reading. */
export function priceLine(bani: number, currency: string): string {
  return `${formatLei(bani)} ${currency}`;
}
