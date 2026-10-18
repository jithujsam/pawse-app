// postcodes.io: free UK postcode lookups built on ONS/Ordnance Survey open data.
// The public instance takes up to 100 postcodes per bulk request; set POSTCODES_IO_URL to a
// self-hosted instance for heavy use.

import type { LatLng } from "./types";

const BULK_LIMIT = 100;

function baseUrl(): string {
  return (process.env.POSTCODES_IO_URL ?? "https://api.postcodes.io").replace(/\/$/, "");
}

type BulkResponse = {
  result: { query: string; result: { latitude: number | null; longitude: number | null } | null }[];
};

/** Look up full postcodes. Returns a map keyed by the postcode exactly as passed in. */
export async function lookupPostcodes(
  postcodes: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, LatLng>> {
  const unique = [...new Set(postcodes)];
  const found = new Map<string, LatLng>();
  for (let i = 0; i < unique.length; i += BULK_LIMIT) {
    const chunk = unique.slice(i, i + BULK_LIMIT);
    const res = await fetchImpl(`${baseUrl()}/postcodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: chunk }),
    });
    if (!res.ok) throw new Error(`postcodes.io returned HTTP ${res.status}`);
    const body = (await res.json()) as BulkResponse;
    for (const item of body.result) {
      const r = item.result;
      if (r && r.latitude !== null && r.longitude !== null) {
        found.set(item.query, { lat: r.latitude, lng: r.longitude });
      }
    }
  }
  return found;
}

/** Look up outward codes (e.g. "SW1A") one at a time; there is no bulk endpoint for them. */
export async function lookupOutcodes(
  outcodes: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, LatLng>> {
  const found = new Map<string, LatLng>();
  for (const outcode of new Set(outcodes)) {
    const res = await fetchImpl(`${baseUrl()}/outcodes/${encodeURIComponent(outcode)}`);
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`postcodes.io returned HTTP ${res.status}`);
    const body = (await res.json()) as { result: { latitude: number | null; longitude: number | null } };
    if (body.result.latitude !== null && body.result.longitude !== null) {
      found.set(outcode, { lat: body.result.latitude, lng: body.result.longitude });
    }
  }
  return found;
}
