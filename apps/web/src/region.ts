/**
 * Where the person is, from the phone's own time zone and language: no location permission,
 * nothing sent anywhere. Used for the currency symbol and to show which clock the app follows.
 */
const ZONE_REGION: [RegExp, string][] = [
  [/^Asia\/(Kolkata|Calcutta)$/, "IN"], [/^Asia\/Karachi$/, "PK"], [/^Asia\/Dhaka$/, "BD"], [/^Asia\/Colombo$/, "LK"], [/^Asia\/Kathmandu$/, "NP"],
  [/^Asia\/(Dubai|Muscat)$/, "AE"], [/^Asia\/Riyadh$/, "SA"], [/^Asia\/Singapore$/, "SG"], [/^Asia\/Tokyo$/, "JP"], [/^Asia\/Seoul$/, "KR"],
  [/^Asia\/(Shanghai|Chongqing|Harbin)$/, "CN"], [/^Asia\/Manila$/, "PH"], [/^Asia\/Jakarta$/, "ID"], [/^Asia\/Kuala_Lumpur$/, "MY"],
  [/^Europe\/London$/, "GB"], [/^Europe\/Dublin$/, "IE"], [/^Europe\/(Berlin|Paris|Madrid|Rome|Amsterdam|Brussels|Vienna|Lisbon|Athens|Helsinki)$/, "EU"],
  [/^Australia\//, "AU"], [/^Pacific\/Auckland$/, "NZ"], [/^America\/Toronto|America\/Vancouver|America\/Edmonton|America\/Winnipeg|America\/Halifax$/, "CA"],
  [/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Manaus)$/, "BR"], [/^America\/Mexico_City$/, "MX"], [/^America\//, "US"], [/^Africa\/Lagos$/, "NG"],
  [/^Africa\/Nairobi$/, "KE"], [/^Africa\/Johannesburg$/, "ZA"],
];
const CURRENCY: Record<string, string> = {
  IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", AE: "AED", SA: "SAR", SG: "SGD", JP: "JPY", KR: "KRW", CN: "CNY", PH: "PHP", ID: "IDR", MY: "MYR",
  GB: "GBP", IE: "EUR", EU: "EUR", AU: "AUD", NZ: "NZD", CA: "CAD", BR: "BRL", MX: "MXN", US: "USD", NG: "NGN", KE: "KES", ZA: "ZAR",
};

export function timeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export function region(): string | null {
  const z = timeZone();
  const hit = ZONE_REGION.find(([re]) => re.test(z));
  if (hit) return hit[1];
  try { return new Intl.Locale(navigator.language).region ?? null; } catch { return null; }
}

/** The local currency symbol, at most 4 characters (₹, $, £, €, AED …). Falls back to the current label. */
export function localCurrency(fallback: string): string {
  const r = region();
  const code = r ? CURRENCY[r] : undefined;
  if (!code) return fallback;
  try {
    const sym = new Intl.NumberFormat(navigator.language, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(1).find((p) => p.type === "currency")?.value;
    return (sym ?? code).slice(0, 4);
  } catch { return code.slice(0, 4); }
}

/** "Asia/Kolkata" -> "Kolkata" for display. */
export const placeName = (z = timeZone()) => z.split("/").pop()!.replace(/_/g, " ");
