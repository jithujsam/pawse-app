import { describe, expect, it } from "vitest";
import { autoMapColumns, hasLocationColumns } from "@/lib/import/columns";
import { parseCsvText } from "@/lib/import/parse";
import { toRecords } from "@/lib/import/records";

describe("autoMapColumns", () => {
  it("maps a typical CRM export", () => {
    const map = autoMapColumns(["Account Name", "Billing Street", "Billing City", "Billing State", "Billing Zip/Postal Code", "Account Owner", "Annual Revenue"]);
    expect(map.name).toBe(0);
    expect(map.address).toBe(1);
    expect(map.city).toBe(2);
    expect(map.region).toBe(3);
    expect(map.postcode).toBe(4);
    expect(map.owner).toBe(5);
    expect(map.metric).toBe(6);
  });

  it("maps UK-style headers and coordinates", () => {
    const map = autoMapColumns(["Dealer", "Address 1", "Town", "County", "Postcode", "Latitude", "Longitude", "Rep", "Type"]);
    expect(map).toMatchObject({ name: 0, address: 1, city: 2, region: 3, postcode: 4, lat: 5, lng: 6, owner: 7, category: 8 });
  });

  it("never assigns one column to two roles", () => {
    const map = autoMapColumns(["Address"]);
    const assigned = Object.values(map).filter((v) => v !== null);
    expect(assigned).toEqual([0]);
  });

  it("requires a location column", () => {
    expect(hasLocationColumns(autoMapColumns(["Name", "Sales"]))).toBe(false);
    expect(hasLocationColumns(autoMapColumns(["Name", "ZIP"]))).toBe(true);
  });
});

describe("parseCsvText", () => {
  it("keeps ZIP codes as text and drops blank rows and columns", () => {
    const sheet = parseCsvText("t.csv", "Name,ZIP,\nA,02134,\n,,\nB,10118,\n");
    expect(sheet.headers).toEqual(["Name", "ZIP"]);
    expect(sheet.rows).toEqual([
      ["A", "02134"],
      ["B", "10118"],
    ]);
  });
});

describe("toRecords", () => {
  const headers = ["Name", "Zip", "Country", "Lat", "Lng", "Sales"];
  const map = autoMapColumns(headers);

  it("keeps valid input coordinates and marks them high confidence", () => {
    const [r] = toRecords(headers, [["A", "10118", "USA", 40.7, -73.9, "$1,200"]], map, "GB");
    expect(r).toMatchObject({ country: "US", lat: 40.7, lng: -73.9, geocode_status: "high", geocode_source: "input", metric: 1200 });
  });

  it("leaves rows without coordinates pending, using the default country", () => {
    const [r] = toRecords(headers, [["B", "SW1A 1AA", null, null, null, null]], map, "GB");
    expect(r).toMatchObject({ country: "GB", postcode: "SW1A 1AA", geocode_status: "pending", lat: null });
  });

  it("ignores 0,0 coordinates", () => {
    const [r] = toRecords(headers, [["C", "10118", "US", 0, 0, null]], map, "US");
    expect(r.geocode_status).toBe("pending");
  });

  it("fails rows in unsupported countries", () => {
    const [r] = toRecords(headers, [["D", "110001", "India", null, null, null]], map, "US");
    expect(r.geocode_status).toBe("failed");
    expect(r.geocode_note).toMatch(/not supported/);
  });
});
