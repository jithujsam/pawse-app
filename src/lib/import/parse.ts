// Reads an uploaded CSV or Excel file in the browser into headers + rows.

import Papa from "papaparse";
import type { Cell } from "./records";

export const MAX_ROWS = 50_000;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type ParsedSheet = { name: string; headers: string[]; rows: Cell[][] };

/** Split a raw grid into headers and data rows, dropping blank rows and trailing blank columns. */
export function toSheet(name: string, grid: Cell[][]): ParsedSheet {
  const isBlank = (c: Cell | undefined) => c === null || c === undefined || (typeof c === "string" && c.trim() === "");
  const nonEmpty = grid.filter((row) => row.some((c) => !isBlank(c)));
  const [headerRow = [], ...rows] = nonEmpty;
  const width = Math.max(headerRow.length, ...rows.map((r) => r.length), 0);
  let lastUsed = width - 1;
  while (lastUsed >= 0 && isBlank(headerRow[lastUsed]) && rows.every((r) => isBlank(r[lastUsed]))) lastUsed--;
  const headers = Array.from({ length: lastUsed + 1 }, (_, i) =>
    isBlank(headerRow[i]) ? `Column ${i + 1}` : String(headerRow[i]).trim(),
  );
  return { name, headers, rows: rows.map((r) => headers.map((_, i) => r[i] ?? null)) };
}

export function parseCsvText(name: string, csv: string): ParsedSheet {
  // Keep everything as text: dynamic typing would turn ZIP "02134" into 2134.
  const { data } = Papa.parse<string[]>(csv, { skipEmptyLines: "greedy" });
  return toSheet(name, data);
}

export async function parseFile(file: File): Promise<ParsedSheet[]> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File is larger than 20 MB.");
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return [parseCsvText(file.name, await file.text())];
  }
  if (lower.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => toSheet(s.sheet, s.data as unknown as Cell[][]));
  }
  throw new Error("Upload a .csv or .xlsx file.");
}
