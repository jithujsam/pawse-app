/**
 * Numbers and words that depend on them, in one place so a count never reads "1 months" or "-1 slips".
 * Nothing here changes a stored value: rounding is for display only.
 */

/** "1 slip", "0 slips", "2.5 months". Singular only for exactly one (or minus one). */
export const plural = (n: number, one: string, many = `${one}s`): string => `${fmtNum(n)} ${Math.abs(n) === 1 ? one : many}`;

/** One decimal at most, no trailing ".0", locale digits and grouping. */
export function fmtNum(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return "0";
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  return (Object.is(r, -0) ? 0 : r).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Months of life, rounded for display: "1 month", "4 months", "0.5 months". */
export const monthsText = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return `${fmtNum(r)} ${Math.abs(r) === 1 ? "month" : "months"}`;
};

/** A loss, shown with a real minus sign: "−1 month". */
export const lostMonths = (n: number): string => `−${monthsText(Math.abs(n))}`;

/** A symbol sits against the number (₹500); a code or word is spaced (AED 500). Whole amounts drop the decimals. */
export function money(currency: string, amount: number): string {
  const c = currency.trim();
  const body = Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 });
  const sign = amount < 0 ? "−" : "";
  return /^[^\p{L}\p{N}]{1,2}$/u.test(c) || c === "R$" ? `${sign}${c}${body}` : `${sign}${c ? `${c} ` : ""}${body}`;
}

/** "1 day", "3 days". */
export const days = (n: number): string => plural(n, "day");
