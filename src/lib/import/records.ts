// Turns parsed spreadsheet rows plus a column mapping into rows for the `records` table.

import { parseCountry, type Country } from "@/lib/geo/postcode";
import type { GeocodeStatus } from "@/lib/geocode/types";
import type { ColumnMap } from "./columns";

export type Cell = string | number | boolean | Date | null;

export type NewRecord = {
  row_index: number;
  attrs: Record<string, string | number | boolean | null>;
  name: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: Country;
  category: string | null;
  owner: string | null;
  territory: string | null;
  metric: number | null;
  lat: number | null;
  lng: number | null;
  geocode_status: GeocodeStatus;
  geocode_source: string | null;
  geocode_note: string | null;
};

function text(cell: Cell | undefined): string | null {
  if (cell === null || cell === undefined) return null;
  const s = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell).trim();
  return s.length ? s : null;
}

function num(cell: Cell | undefined): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const s = text(cell);
  if (!s) return null;
  const n = Number(s.replace(/[$£€,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pick(row: Cell[], index: number | null): Cell | undefined {
  return index === null ? undefined : row[index];
}

function toAttr(cell: Cell | undefined): string | number | boolean | null {
  if (cell === undefined || cell === null) return null;
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return cell;
}

export function toRecords(headers: string[], rows: Cell[][], map: ColumnMap, defaultCountry: Country): NewRecord[] {
  return rows.map((row, i) => {
    const attrs = Object.fromEntries(headers.map((h, c) => [h || `Column ${c + 1}`, toAttr(row[c])]));
    const countryCell = text(pick(row, map.country));
    const country = parseCountry(countryCell) ?? defaultCountry;
    const lat = num(pick(row, map.lat));
    const lng = num(pick(row, map.lng));
    const hasCoords = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

    let status: GeocodeStatus = "pending";
    let note: string | null = null;
    if (countryCell && !parseCountry(countryCell)) {
      status = "failed";
      note = `Country "${countryCell}" is not supported yet (US and UK only)`;
    } else if (hasCoords) {
      status = "high";
    }

    // ZIP codes stored as numbers lose their leading zero; keep the raw text and let the
    // geocoder normalise it.
    return {
      row_index: i,
      attrs,
      name: text(pick(row, map.name)),
      address: text(pick(row, map.address)),
      city: text(pick(row, map.city)),
      region: text(pick(row, map.region)),
      postcode: text(pick(row, map.postcode)),
      country,
      category: text(pick(row, map.category)),
      owner: text(pick(row, map.owner)),
      territory: text(pick(row, map.territory)),
      metric: num(pick(row, map.metric)),
      lat: status === "high" ? lat : null,
      lng: status === "high" ? lng : null,
      geocode_status: status,
      geocode_source: status === "high" ? "input" : null,
      geocode_note: note,
    };
  });
}
