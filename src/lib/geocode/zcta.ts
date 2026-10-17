import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LatLng } from "./types";

// US ZIP code (ZCTA) centres from the Census Gazetteer (public domain), bundled with the app.
// Regenerate with scripts/build-zcta.sh. The file is traced into the geocode route in next.config.ts.
const FILE = path.join(process.cwd(), "data", "us-zcta.csv");

let cache: Promise<Map<string, LatLng>> | null = null;

function load(): Promise<Map<string, LatLng>> {
  cache ??= readFile(FILE, "utf8").then((text) => {
    const map = new Map<string, LatLng>();
    for (const line of text.split("\n")) {
      const [zip, lat, lng] = line.split(",");
      if (zip && lat && lng) map.set(zip, { lat: Number(lat), lng: Number(lng) });
    }
    return map;
  });
  return cache;
}

export async function lookupZipCentroids(zips: string[]): Promise<Map<string, LatLng>> {
  const all = await load();
  const found = new Map<string, LatLng>();
  for (const zip of zips) {
    const hit = all.get(zip);
    if (hit) found.set(zip, hit);
  }
  return found;
}
