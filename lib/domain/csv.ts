import Papa from "papaparse";
import { normalizeIndianMobile } from "./phone";

export type CandidateLanguage = "en" | "hi";

export type CandidateRow = {
  line: number;
  name: string;
  phone: string; // E.164
  language: CandidateLanguage;
};

export type RowError = { line: number; field: string; message: string };

export type CsvResult = {
  valid: CandidateRow[];
  errors: RowError[];
  duplicates: { line: number; firstLine: number }[];
  totalRows: number;
};

export const MAX_CSV_BYTES = 1_000_000;
export const MAX_CSV_ROWS = 2000;
const REQUIRED = ["name", "phone", "consent"] as const;

const YES = new Set(["yes", "y", "true", "1", "haan", "ha", "हाँ", "हां"]);
const LANGS: Record<string, CandidateLanguage> = {
  "": "en",
  en: "en",
  eng: "en",
  english: "en",
  hi: "hi",
  hin: "hi",
  hindi: "hi",
  "हिंदी": "hi",
};

/**
 * Parse and validate a candidate CSV. Pure: nothing is stored.
 * Rejects rows without consent, invalid +91 numbers and in-file duplicates.
 * `existingPhones` lets the caller flag candidates already on this job.
 */
export function parseCandidatesCsv(text: string, existingPhones: Set<string> = new Set()): CsvResult {
  const result: CsvResult = { valid: [], errors: [], duplicates: [], totalRows: 0 };
  if (text.length > MAX_CSV_BYTES) {
    result.errors.push({ line: 0, field: "file", message: "File is larger than 1 MB" });
    return result;
  }
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED.filter((h) => !headers.includes(h));
  if (missing.length) {
    result.errors.push({ line: 1, field: "header", message: `Missing column(s): ${missing.join(", ")}` });
    return result;
  }
  if (parsed.data.length > MAX_CSV_ROWS) {
    result.errors.push({ line: 0, field: "file", message: `More than ${MAX_CSV_ROWS} rows` });
    return result;
  }

  const seen = new Map<string, number>();
  parsed.data.forEach((row, i) => {
    const line = i + 2; // header is line 1
    result.totalRows++;
    const name = (row.name ?? "").trim().replace(/\s+/g, " ");
    const consent = (row.consent ?? "").trim().toLowerCase();
    const langRaw = (row.language ?? "").trim().toLowerCase();
    const phone = normalizeIndianMobile(row.phone ?? "");
    const rowErrors: RowError[] = [];

    if (!name) rowErrors.push({ line, field: "name", message: "Name is empty" });
    else if (name.length > 100) rowErrors.push({ line, field: "name", message: "Name is longer than 100 characters" });
    if (!phone) rowErrors.push({ line, field: "phone", message: "Not a valid Indian mobile number (+91, 10 digits)" });
    if (!YES.has(consent)) rowErrors.push({ line, field: "consent", message: "No consent recorded: row will not be messaged" });
    const language = LANGS[langRaw];
    if (!language) rowErrors.push({ line, field: "language", message: "Language must be English or Hindi" });

    if (rowErrors.length) {
      result.errors.push(...rowErrors);
      return;
    }
    if (existingPhones.has(phone!)) {
      result.errors.push({ line, field: "phone", message: "Already uploaded for this job" });
      return;
    }
    const first = seen.get(phone!);
    if (first !== undefined) {
      result.duplicates.push({ line, firstLine: first });
      return;
    }
    seen.set(phone!, line);
    result.valid.push({ line, name, phone: phone!, language: language! });
  });
  return result;
}

/** Neutralise spreadsheet formula injection in exported cells. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
