import { describe, expect, it, vi } from "vitest";
import { buildCensusBatchCsv, parseCensusBatchResponse } from "@/lib/geocode/census";
import { geocodeBatch, type GeocodeProviders } from "@/lib/geocode/cascade";
import { lookupPostcodes } from "@/lib/geocode/postcodesio";
import type { GeocodeInput, LatLng } from "@/lib/geocode/types";

describe("Census batch format", () => {
  it("quotes fields so commas in addresses survive", () => {
    expect(buildCensusBatchCsv([{ id: 7, street: "1 Main St, Ste 2", city: "Austin", state: "TX", zip: null }])).toBe(
      '"7","1 Main St, Ste 2","Austin","TX",""',
    );
  });

  it("parses matches and skips misses", () => {
    // Shape copied from a real response of the addressbatch endpoint.
    const csv = [
      '"1","1600 Pennsylvania Ave NW, Washington, DC, 20500","Match","Exact","1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500","-77.035189204737,38.898702605246","76225813","L"',
      '"2","350 5th Ave, New York, NY, 10118","Match","Non_Exact","350 5TH AVE, NEW YORK, NY, 10118","-73.985075577551,40.747850846857","59653473","L"',
      '"3","nowhere st, Nowhere, ZZ, 00000","No_Match"',
    ].join("\n");
    const m = parseCensusBatchResponse(csv);
    expect(m.size).toBe(2);
    expect(m.get(1)).toMatchObject({ lat: 38.898702605246, lng: -77.035189204737, exact: true });
    expect(m.get(2)?.exact).toBe(false);
  });
});

describe("postcodes.io client", () => {
  it("chunks requests at 100 postcodes and keeps only found ones", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const { postcodes } = JSON.parse(String(init?.body)) as { postcodes: string[] };
      return new Response(
        JSON.stringify({
          result: postcodes.map((q) => ({ query: q, result: q === "ZZ1 1ZZ" ? null : { latitude: 51.5, longitude: -0.1 } })),
        }),
      );
    });
    const codes = Array.from({ length: 150 }, (_, i) => `A${i} 1AA`).concat("ZZ1 1ZZ");
    const found = await lookupPostcodes(codes, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(found.size).toBe(150);
    expect(found.has("ZZ1 1ZZ")).toBe(false);
  });
});

describe("geocodeBatch", () => {
  const providers = (): GeocodeProviders => ({
    census: vi.fn(async (addresses) => {
      const out = new Map();
      for (const a of addresses) {
        if (a.street.startsWith("1600")) out.set(a.id, { lat: 38.9, lng: -77.0, exact: true, matchedAddress: "" });
        if (a.street.startsWith("350")) out.set(a.id, { lat: 40.7, lng: -73.9, exact: false, matchedAddress: "350 5TH AVE" });
      }
      return out;
    }),
    zipCentroids: vi.fn(async (zips: string[]) => new Map<string, LatLng>(zips.filter((z) => z === "62701").map((z) => [z, { lat: 39.8, lng: -89.6 }]))),
    ukPostcodes: vi.fn(async (pcs: string[]) => new Map<string, LatLng>(pcs.filter((p) => p === "SW1A 1AA").map((p) => [p, { lat: 51.5, lng: -0.14 }]))),
    ukOutcodes: vi.fn(async (ocs: string[]) => new Map<string, LatLng>(ocs.filter((o) => o === "M1").map((o) => [o, { lat: 53.48, lng: -2.24 }]))),
  });

  const row = (id: number, country: "US" | "GB", fields: Partial<GeocodeInput>): GeocodeInput => ({
    id,
    country,
    address: null,
    city: null,
    region: null,
    postcode: null,
    ...fields,
  });

  it("walks each row down the cheapest working source", async () => {
    const p = providers();
    const results = await geocodeBatch(
      [
        row(1, "US", { address: "1600 Pennsylvania Ave NW", region: "DC", postcode: "20500" }),
        row(2, "US", { address: "350 5th Ave", postcode: "10118" }),
        row(3, "US", { address: "999 Unknown Rd", postcode: "62701" }),
        row(4, "US", { postcode: "62701" }),
        row(5, "US", { address: "999 Unknown Rd" }),
        row(6, "GB", { postcode: "sw1a1aa" }),
        row(7, "GB", { postcode: "M1 9ZZ" }),
        row(8, "GB", { address: "Somewhere, London" }),
      ],
      p,
    );
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId[1]).toMatchObject({ status: "high", source: "census" });
    expect(byId[2]).toMatchObject({ status: "medium", source: "census" });
    expect(byId[3]).toMatchObject({ status: "postcode", source: "zcta", lat: 39.8 });
    expect(byId[4]).toMatchObject({ status: "postcode", source: "zcta" });
    expect(byId[5]).toMatchObject({ status: "failed" });
    expect(byId[6]).toMatchObject({ status: "medium", source: "postcodes.io", lat: 51.5 });
    expect(byId[7]).toMatchObject({ status: "postcode", lat: 53.48 });
    expect(byId[8]).toMatchObject({ status: "failed", note: "No valid UK postcode" });

    // Only rows with a street go to the Census geocoder, and only unmatched ZIPs are looked up.
    expect(p.census).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    expect((p.census as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(4);
    expect(p.zipCentroids).toHaveBeenCalledWith(["62701"]);
  });
});
