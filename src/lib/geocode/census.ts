// US Census Bureau batch geocoder: free, public-domain results, US addresses only.
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html (max 10,000 records per batch)

import Papa from "papaparse";

const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";

export type CensusAddress = {
  id: number;
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type CensusMatch = { lat: number; lng: number; exact: boolean; matchedAddress: string };

/** Build the headerless CSV the batch endpoint expects: id, street, city, state, ZIP. */
export function buildCensusBatchCsv(addresses: CensusAddress[]): string {
  return Papa.unparse(
    addresses.map((a) => [a.id, a.street, a.city ?? "", a.state ?? "", a.zip ?? ""]),
    { quotes: true, newline: "\n" },
  );
}

/**
 * Parse the batch response. Each line is:
 * id, input address, Match|No_Match|Tie, Exact|Non_Exact, matched address, "lng,lat", TIGER line id, side.
 * Rows that did not match are left out of the returned map.
 */
export function parseCensusBatchResponse(csv: string): Map<number, CensusMatch> {
  const { data } = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true });
  const matches = new Map<number, CensusMatch>();
  for (const row of data) {
    if (row[2] !== "Match") continue;
    const id = Number(row[0]);
    const [lng, lat] = (row[5] ?? "").split(",").map(Number);
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    matches.set(id, { lat, lng, exact: row[3] === "Exact", matchedAddress: row[4] ?? "" });
  }
  return matches;
}

export async function censusBatchGeocode(
  addresses: CensusAddress[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<number, CensusMatch>> {
  if (addresses.length === 0) return new Map();
  const form = new FormData();
  form.append("benchmark", "Public_AR_Current");
  form.append("addressFile", new Blob([buildCensusBatchCsv(addresses)], { type: "text/csv" }), "addresses.csv");
  const res = await fetchImpl(ENDPOINT, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Census geocoder returned HTTP ${res.status}`);
  return parseCensusBatchResponse(await res.text());
}
