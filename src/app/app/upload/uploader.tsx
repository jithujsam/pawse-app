"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Country } from "@/lib/geo/postcode";
import { autoMapColumns, hasLocationColumns, ROLE_LABELS, ROLES, type ColumnMap, type Role } from "@/lib/import/columns";
import { MAX_ROWS, parseFile, type ParsedSheet } from "@/lib/import/parse";
import { toRecords } from "@/lib/import/records";
import { createClient } from "@/lib/supabase/client";

const INSERT_CHUNK = 1000;

type Step = { kind: "choose" } | { kind: "map"; sheets: ParsedSheet[]; sheetIndex: number; fileName: string };

export function Uploader({ workspaceId, defaultCountry }: { workspaceId: string; defaultCountry: Country }) {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const sheets = (await parseFile(file)).filter((s) => s.rows.length > 0);
      if (!sheets.length) throw new Error("That file has no data rows.");
      setStep({ kind: "map", sheets, sheetIndex: 0, fileName: file.name.replace(/\.(csv|xlsx|txt)$/i, "") });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  if (step.kind === "choose") {
    return (
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center hover:border-slate-400">
          <span className="font-medium">{busy ? "Reading file…" : "Choose a CSV or Excel (.xlsx) file"}</span>
          <span className="text-sm text-slate-500">Up to 20 MB and {MAX_ROWS.toLocaleString()} rows. The first row should be column names.</span>
          <input
            type="file"
            accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <MappingStep
      key={step.sheetIndex}
      workspaceId={workspaceId}
      defaultCountry={defaultCountry}
      fileName={step.fileName}
      sheets={step.sheets}
      sheetIndex={step.sheetIndex}
      onSheetChange={(i) => setStep({ ...step, sheetIndex: i })}
      onCancel={() => setStep({ kind: "choose" })}
    />
  );
}

function MappingStep(props: {
  workspaceId: string;
  defaultCountry: Country;
  fileName: string;
  sheets: ParsedSheet[];
  sheetIndex: number;
  onSheetChange: (i: number) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const sheet = props.sheets[props.sheetIndex];
  const [map, setMap] = useState<ColumnMap>(() => autoMapColumns(sheet.headers));
  const [country, setCountry] = useState<Country>(props.defaultCountry);
  const [name, setName] = useState(props.fileName);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tooMany = sheet.rows.length > MAX_ROWS;
  const records = useMemo(
    () => (tooMany ? [] : toRecords(sheet.headers, sheet.rows, map, country)),
    [sheet, map, country, tooMany],
  );
  const summary = useMemo(() => {
    let withCoords = 0;
    let unsupported = 0;
    let noLocation = 0;
    for (const r of records) {
      if (r.geocode_status === "high") withCoords++;
      else if (r.geocode_status === "failed") unsupported++;
      else if (!r.address && !r.postcode) noLocation++;
    }
    return { withCoords, unsupported, noLocation, toGeocode: records.length - withCoords - unsupported - noLocation };
  }, [records]);

  function setRole(role: Role, value: string) {
    setMap((m) => {
      const next = { ...m };
      const index = value === "" ? null : Number(value);
      // A column can only fill one role: clear it from wherever it was before.
      if (index !== null) for (const r of ROLES) if (next[r] === index) next[r] = null;
      next[role] = index;
      return next;
    });
  }

  async function importData() {
    setError(null);
    const supabase = createClient();
    try {
      setProgress("Creating dataset…");
      const { data: dataset, error: dsError } = await supabase
        .from("datasets")
        .insert({ workspace_id: props.workspaceId, name: name.trim() || "Untitled", headers: sheet.headers, column_map: map })
        .select("id")
        .single();
      if (dsError) throw dsError;

      for (let i = 0; i < records.length; i += INSERT_CHUNK) {
        setProgress(`Saving rows ${i + 1}–${Math.min(i + INSERT_CHUNK, records.length)} of ${records.length}…`);
        const chunk = records.slice(i, i + INSERT_CHUNK).map((r) => ({ ...r, workspace_id: props.workspaceId, dataset_id: dataset.id }));
        const { error: insError } = await supabase.from("records").insert(chunk);
        if (insError) {
          // Don't leave a half-imported dataset behind.
          await supabase.from("datasets").delete().eq("id", dataset.id);
          throw insError;
        }
      }
      const { error: countError } = await supabase.from("datasets").update({ row_count: records.length }).eq("id", dataset.id);
      if (countError) throw countError;
      router.push(`/app/datasets/${dataset.id}`);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : "Import failed.");
    }
  }

  const canImport = hasLocationColumns(map) && !tooMany && records.length > 0 && !progress;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Map name
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-72 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" />
        </label>
        {props.sheets.length > 1 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Sheet
            <select value={props.sheetIndex} onChange={(e) => props.onSheetChange(Number(e.target.value))} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              {props.sheets.map((s, i) => (
                <option key={s.name} value={i}>
                  {s.name} ({s.rows.length} rows)
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Rows without a country are in
          <select value={country} onChange={(e) => setCountry(e.target.value as Country)} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
          </select>
        </label>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Check the columns</h2>
        <p className="mb-4 text-sm text-slate-600">We guessed what each column is. Fix anything that looks wrong. You need a street address, a ZIP/postcode, or latitude and longitude.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => (
            <label key={role} className="flex flex-col gap-1 text-sm font-medium">
              {ROLE_LABELS[role]}
              <select
                value={map[role] ?? ""}
                onChange={(e) => setRole(role, e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
              >
                <option value="">— none —</option>
                {sheet.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Preview</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {sheet.headers.map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sheet.rows.slice(0, 5).map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="whitespace-nowrap px-3 py-2">
                      {cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
        {tooMany ? (
          <p className="text-red-700">This sheet has {sheet.rows.length.toLocaleString()} rows. The limit is {MAX_ROWS.toLocaleString()}.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            <li><strong>{records.length.toLocaleString()}</strong> rows</li>
            <li><strong>{summary.withCoords.toLocaleString()}</strong> already have coordinates</li>
            <li><strong>{summary.toGeocode.toLocaleString()}</strong> will be located from address or postcode</li>
            {summary.noLocation > 0 && <li className="text-amber-700"><strong>{summary.noLocation.toLocaleString()}</strong> have no address or postcode</li>}
            {summary.unsupported > 0 && <li className="text-amber-700"><strong>{summary.unsupported.toLocaleString()}</strong> are outside the US/UK</li>}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={importData}
          disabled={!canImport}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Import and map
        </button>
        <button type="button" onClick={props.onCancel} disabled={!!progress} className="text-sm text-slate-600 underline">
          Choose another file
        </button>
        {progress && <span className="text-sm text-slate-600" role="status">{progress}</span>}
        {!hasLocationColumns(map) && <span className="text-sm text-amber-700">Pick an address, ZIP/postcode, or latitude + longitude column.</span>}
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
