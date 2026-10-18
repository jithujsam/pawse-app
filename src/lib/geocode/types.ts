import type { Country } from "@/lib/geo/postcode";

/**
 * How precisely a row was placed:
 * - high: the input already had coordinates, or an exact street-address match
 * - medium: a fuzzy street match, or a full UK postcode (about 15 addresses share one)
 * - postcode: only a ZIP code or UK outward-code centroid
 * - failed: could not be placed
 */
export type GeocodeStatus = "pending" | "high" | "medium" | "postcode" | "failed";

/** The location fields of one record, as stored after import. */
export type GeocodeInput = {
  id: number;
  address: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: Country;
};

export type GeocodeResult = {
  id: number;
  lat: number | null;
  lng: number | null;
  status: Exclude<GeocodeStatus, "pending">;
  source: string | null;
  note: string | null;
};

export type LatLng = { lat: number; lng: number };
