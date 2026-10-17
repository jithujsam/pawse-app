// Country and postcode handling for the two launch markets: the US (ZIP codes) and the UK (postcodes).

export type Country = "US" | "GB";

const COUNTRY_ALIASES: Record<string, Country> = {
  us: "US",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states": "US",
  "united states of america": "US",
  america: "US",
  gb: "GB",
  uk: "GB",
  "u.k.": "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
};

/** Map a free-text country cell to a supported country, or null if it is blank or unsupported. */
export function parseCountry(value: string | null | undefined): Country | null {
  if (!value) return null;
  return COUNTRY_ALIASES[value.trim().toLowerCase()] ?? null;
}

const US_ZIP = /^(\d{5})(?:-?\d{4})?$/;
const US_ZIP_IN_TEXT = /\b(\d{5})(?:-\d{4})?\b/g;

/**
 * Normalise a US ZIP code to its 5-digit form. Accepts ZIP+4, and restores a leading zero
 * that spreadsheets strip when they store ZIPs as numbers (e.g. 2134 -> "02134").
 */
export function normalizeUsZip(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (/^\d{3,4}$/.test(s)) s = s.padStart(5, "0");
  const m = US_ZIP.exec(s);
  return m ? m[1] : null;
}

// Full UK postcode: outward code (area + district) and inward code (sector + unit).
const UK_FULL = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;
// Outward code alone, e.g. "SW1A" or "M1".
const UK_OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const UK_IN_TEXT = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export type UkPostcode =
  | { kind: "full"; postcode: string; outward: string }
  | { kind: "outward"; outward: string };

/** Normalise a UK postcode to "OUTWARD INWARD" form, or recognise a bare outward code. */
export function normalizeUkPostcode(value: string | null | undefined): UkPostcode | null {
  if (!value) return null;
  const s = value.trim().toUpperCase().replace(/\s+/g, " ");
  const full = UK_FULL.exec(s);
  if (full) return { kind: "full", postcode: `${full[1]} ${full[2]}`, outward: full[1] };
  const compact = s.replace(/\s/g, "");
  if (UK_OUTWARD.test(compact)) return { kind: "outward", outward: compact };
  return null;
}

/** Find a postcode inside a free-text address, for sheets that keep the whole address in one cell. */
export function extractPostcode(address: string | null | undefined, country: Country): string | null {
  if (!address) return null;
  if (country === "GB") {
    const m = UK_IN_TEXT.exec(address);
    return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
  }
  // The ZIP is normally the last 5-digit group; street numbers come first.
  const matches = [...address.matchAll(US_ZIP_IN_TEXT)];
  return matches.length ? matches[matches.length - 1][1] : null;
}
