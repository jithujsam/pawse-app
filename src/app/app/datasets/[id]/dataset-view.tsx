"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RecordsMap, STATUS_COLORS, STATUS_LABELS, type MapRecord } from "@/components/records-map";
import type { GeocodeStatus } from "@/lib/geocode/types";
import { createClient } from "@/lib/supabase/client";

const PAGE = 1000;

type Row = MapRecord & { address: string | null; postcode: string | null; geocode_note: string | null };

async function loadRecords(datasetId: string): Promise<Row[]> {
  const supabase = createClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("records")
      .select("id, name, lat, lng, geocode_status, category, owner, address, postcode, geocode_note")
      .eq("dataset_id", datasetId)
      .order("row_index")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

export function DatasetView({ datasetId, canEdit }: { datasetId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await loadRecords(datasetId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rows.");
    }
  }, [datasetId]);

  const runGeocoding = useCallback(async () => {
    setGeocoding(true);
    setError(null);
    try {
      for (;;) {
        const res = await fetch(`/api/datasets/${datasetId}/geocode`, { method: "POST" });
        const body = (await res.json()) as { remaining?: number; error?: string };
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        await refresh();
        if (!body.remaining) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geocoding failed.");
    } finally {
      setGeocoding(false);
    }
  }, [datasetId, refresh]);

  useEffect(() => {
    let cancelled = false;
    loadRecords(datasetId)
      .then((loaded) => {
        if (cancelled) return;
        setRows(loaded);
        if (canEdit && loaded.some((r) => r.geocode_status === "pending")) void runGeocoding();
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load rows."));
    return () => {
      cancelled = true;
    };
  }, [datasetId, canEdit, runGeocoding]);

  const counts = useMemo(() => {
    const c: Record<GeocodeStatus, number> = { pending: 0, high: 0, medium: 0, postcode: 0, failed: 0 };
    for (const r of rows ?? []) c[r.geocode_status]++;
    return c;
  }, [rows]);

  if (!rows) {
    return <p className="text-sm text-slate-600">{error ?? "Loading…"}</p>;
  }

  const total = rows.length;
  const placed = counts.high + counts.medium + counts.postcode;
  const problems = rows.filter((r) => r.geocode_status === "failed" || r.geocode_status === "postcode");

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm">
        <span>
          <strong>{placed.toLocaleString()}</strong> of {total.toLocaleString()} rows on the map
          {total > 0 && ` (${Math.round((placed / total) * 100)}%)`}
        </span>
        {(["high", "medium", "postcode", "failed", "pending"] as const).map((s) =>
          counts[s] ? (
            <span key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} aria-hidden />
              {STATUS_LABELS[s]}: {counts[s].toLocaleString()}
            </span>
          ) : null,
        )}
        {geocoding && (
          <span className="text-emerald-700" role="status">
            Locating rows… {counts.pending.toLocaleString()} to go
          </span>
        )}
        {!geocoding && counts.pending > 0 && canEdit && (
          <button type="button" onClick={runGeocoding} className="rounded-md bg-slate-900 px-3 py-1.5 text-white">
            Locate remaining rows
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="min-h-[28rem] overflow-hidden rounded-lg border border-slate-200">
          <RecordsMap records={rows} />
        </div>
        <aside className="flex max-h-[70vh] flex-col rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
            Needs attention ({problems.length.toLocaleString()})
          </h2>
          {problems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-600">Every row was placed at street or postcode level.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-y-auto text-sm">
              {problems.slice(0, 500).map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[r.geocode_status] }} aria-hidden />
                    <span className="truncate">{r.name ?? r.address ?? `Row ${r.id}`}</span>
                  </div>
                  <p className="text-slate-500">{[r.address, r.postcode].filter(Boolean).join(", ") || "No address"}</p>
                  {r.geocode_note && <p className="text-slate-500">{r.geocode_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
