/**
 * Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts: +91 98765 43210, 919876543210, 09876543210, 98765-43210.
 * Indian mobile numbers are 10 digits starting with 6-9.
 */
export function normalizeIndianMobile(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[^\d\s()+.-]/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("91")) return null;
    digits = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/** +91 98765 43210 → +91 ••••• •3210, for screens that don't need the full number. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)} ••••• •${e164.slice(-4)}`;
}
