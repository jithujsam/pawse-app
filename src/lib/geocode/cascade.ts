// Places a batch of records using the cheapest source that works for each one:
//   US: street address via the Census geocoder, then the ZIP code centroid.
//   UK: full postcode via postcodes.io, then the outward-code centroid.
// Rows with coordinates in the sheet never reach this step; they are placed at import.

import { extractPostcode, normalizeUkPostcode, normalizeUsZip } from "@/lib/geo/postcode";
import type { CensusAddress, CensusMatch } from "./census";
import type { GeocodeInput, GeocodeResult, LatLng } from "./types";

export type GeocodeProviders = {
  census: (addresses: CensusAddress[]) => Promise<Map<number, CensusMatch>>;
  zipCentroids: (zips: string[]) => Promise<Map<string, LatLng>>;
  ukPostcodes: (postcodes: string[]) => Promise<Map<string, LatLng>>;
  ukOutcodes: (outcodes: string[]) => Promise<Map<string, LatLng>>;
};

function failed(id: number, note: string): GeocodeResult {
  return { id, lat: null, lng: null, status: "failed", source: null, note };
}

async function geocodeUs(rows: GeocodeInput[], p: GeocodeProviders): Promise<GeocodeResult[]> {
  const zips = new Map<number, string | null>(
    rows.map((r) => [r.id, normalizeUsZip(r.postcode) ?? extractPostcode(r.address, "US")]),
  );

  const withStreet = rows.filter((r) => r.address && r.address.trim().length > 0);
  const streetMatches = await p.census(
    withStreet.map((r) => ({
      id: r.id,
      street: r.address!.trim(),
      city: r.city,
      state: r.region,
      zip: zips.get(r.id) ?? null,
    })),
  );

  const needZip = rows.filter((r) => !streetMatches.has(r.id) && zips.get(r.id));
  const centroids = await p.zipCentroids([...new Set(needZip.map((r) => zips.get(r.id)!))]);

  return rows.map((r) => {
    const m = streetMatches.get(r.id);
    if (m) {
      return {
        id: r.id,
        lat: m.lat,
        lng: m.lng,
        status: m.exact ? "high" : "medium",
        source: "census",
        note: m.exact ? null : `Closest match: ${m.matchedAddress}`,
      };
    }
    const zip = zips.get(r.id);
    if (!zip) return failed(r.id, r.address ? "Address not found and no ZIP code" : "No address or ZIP code");
    const c = centroids.get(zip);
    if (!c) return failed(r.id, `ZIP code ${zip} not found`);
    return {
      id: r.id,
      lat: c.lat,
      lng: c.lng,
      status: "postcode",
      source: "zcta",
      note: r.address ? `Address not found; placed at ZIP ${zip} centre` : `Placed at ZIP ${zip} centre`,
    };
  });
}

async function geocodeGb(rows: GeocodeInput[], p: GeocodeProviders): Promise<GeocodeResult[]> {
  const parsed = new Map(
    rows.map((r) => [r.id, normalizeUkPostcode(r.postcode) ?? normalizeUkPostcode(extractPostcode(r.address, "GB"))]),
  );

  const full = [...parsed.values()].flatMap((pc) => (pc?.kind === "full" ? [pc.postcode] : []));
  const postcodeHits = await p.ukPostcodes(full);

  // Outward codes are the fallback both for bare outward codes and for full postcodes that
  // postcodes.io no longer recognises (e.g. terminated ones).
  const outwardNeeded = [...parsed.values()].flatMap((pc) =>
    pc && (pc.kind === "outward" || !postcodeHits.has(pc.postcode)) ? [pc.outward] : [],
  );
  const outcodeHits = await p.ukOutcodes(outwardNeeded);

  return rows.map((r) => {
    const pc = parsed.get(r.id);
    if (!pc) return failed(r.id, "No valid UK postcode");
    if (pc.kind === "full") {
      const hit = postcodeHits.get(pc.postcode);
      if (hit) return { id: r.id, ...hit, status: "medium", source: "postcodes.io", note: null };
    }
    const area = outcodeHits.get(pc.outward);
    if (!area) return failed(r.id, `Postcode ${pc.kind === "full" ? pc.postcode : pc.outward} not found`);
    return {
      id: r.id,
      ...area,
      status: "postcode",
      source: "postcodes.io",
      note: pc.kind === "full" ? `Postcode ${pc.postcode} not found; placed at ${pc.outward} centre` : `Placed at ${pc.outward} centre`,
    };
  });
}

export async function geocodeBatch(rows: GeocodeInput[], providers: GeocodeProviders): Promise<GeocodeResult[]> {
  const [us, gb] = await Promise.all([
    geocodeUs(rows.filter((r) => r.country === "US"), providers),
    geocodeGb(rows.filter((r) => r.country === "GB"), providers),
  ]);
  return [...us, ...gb];
}
