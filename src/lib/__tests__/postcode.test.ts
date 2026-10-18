import { describe, expect, it } from "vitest";
import { extractPostcode, normalizeUkPostcode, normalizeUsZip, parseCountry } from "@/lib/geo/postcode";

describe("parseCountry", () => {
  it.each([
    ["USA", "US"],
    ["united states", "US"],
    ["UK", "GB"],
    ["England", "GB"],
    [" Scotland ", "GB"],
  ])("%s -> %s", (input, expected) => expect(parseCountry(input)).toBe(expected));

  it("returns null for blank or unsupported countries", () => {
    expect(parseCountry("")).toBeNull();
    expect(parseCountry("India")).toBeNull();
  });
});

describe("normalizeUsZip", () => {
  it("keeps 5-digit ZIPs and trims ZIP+4", () => {
    expect(normalizeUsZip("10118")).toBe("10118");
    expect(normalizeUsZip("10118-0110")).toBe("10118");
    expect(normalizeUsZip("101180110")).toBe("10118");
  });
  it("restores leading zeros lost by spreadsheets", () => {
    expect(normalizeUsZip(2134)).toBe("02134");
    expect(normalizeUsZip("501")).toBe("00501");
  });
  it("rejects junk", () => {
    expect(normalizeUsZip("ABCDE")).toBeNull();
    expect(normalizeUsZip(null)).toBeNull();
  });
});

describe("normalizeUkPostcode", () => {
  it("formats full postcodes with a single space", () => {
    expect(normalizeUkPostcode("sw1a1aa")).toEqual({ kind: "full", postcode: "SW1A 1AA", outward: "SW1A" });
    expect(normalizeUkPostcode(" M1  1AE ")).toEqual({ kind: "full", postcode: "M1 1AE", outward: "M1" });
  });
  it("recognises bare outward codes", () => {
    expect(normalizeUkPostcode("EC1A")).toEqual({ kind: "outward", outward: "EC1A" });
  });
  it("rejects non-postcodes", () => {
    expect(normalizeUkPostcode("London")).toBeNull();
    expect(normalizeUkPostcode("12345")).toBeNull();
  });
});

describe("extractPostcode", () => {
  it("takes the last 5-digit group from a US address", () => {
    expect(extractPostcode("12345 Main St, Springfield, IL 62701", "US")).toBe("62701");
  });
  it("finds a UK postcode inside an address", () => {
    expect(extractPostcode("10 Downing St, London sw1a 2aa, UK", "GB")).toBe("SW1A 2AA");
  });
});
