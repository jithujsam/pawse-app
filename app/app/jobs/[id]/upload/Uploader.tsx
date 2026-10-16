"use client";

import { useState, useTransition } from "react";
import type { CsvPreview } from "@/lib/services/candidates";
import { importCsvAction, previewCsvAction } from "../../../actions";
import { useHydrated } from "@/components/app/useHydrated";

export function Uploader({ jobId }: { jobId: string }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = useHydrated();

  const onFile = async (f: File | undefined) => {
    setPreview(null);
    setError(null);
    if (!f) return;
    if (f.size > 1_000_000) return setError("File is larger than 1 MB.");
    setFileName(f.name);
    const t = await f.text();
    setText(t);
    start(async () => {
      const r = await previewCsvAction(jobId, t);
      if (r.ok) setPreview(r.preview);
      else setError(r.error);
    });
  };

  const confirm = () =>
    start(async () => {
      const r = await importCsvAction(jobId, text);
      if (r && !r.ok) setError(r.error);
    });

  return (
    <div className="space-y-4" data-ready={ready || undefined}>
      <label className="card block cursor-pointer text-center py-10 border-dashed" style={{ borderStyle: "dashed" }}>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <span className="font-medium">{fileName || "Choose a CSV file"}</span>
        <span className="block text-xs mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
          Up to 1 MB
        </span>
      </label>

      {pending && !preview && <p className="text-sm">Checking file…</p>}
      {error && (
        <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">
          {error}
        </p>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Ready to add" value={preview.valid.length} />
            <Stat label="Rows with problems" value={new Set(preview.errors.map((e) => e.line)).size} warn={preview.errors.length > 0} />
            <Stat label="Duplicates removed" value={preview.duplicates.length} />
          </div>

          {preview.overCapacity > 0 && (
            <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">
              This job can take {preview.capacity} more candidate(s). Remove {preview.overCapacity} row(s) or turn off test mode.
            </p>
          )}

          {preview.errors.length > 0 && (
            <div className="card card-sm overflow-x-auto">
              <h3 className="text-lg mb-2">Problems (these rows won&apos;t be added)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: "var(--color-on-surface-variant)" }}>
                    <th className="py-1 pr-4">Line</th>
                    <th className="py-1 pr-4">Column</th>
                    <th className="py-1">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.slice(0, 200).map((e, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--color-outline-variant)" }}>
                      <td className="py-1 pr-4">{e.line}</td>
                      <td className="py-1 pr-4">{e.field}</td>
                      <td className="py-1">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.valid.length > 0 && (
            <div className="card card-sm overflow-x-auto">
              <h3 className="text-lg mb-2">Preview</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: "var(--color-on-surface-variant)" }}>
                    <th className="py-1 pr-4">Name</th>
                    <th className="py-1 pr-4">Phone</th>
                    <th className="py-1">Language</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.slice(0, 50).map((r) => (
                    <tr key={r.line} className="border-t" style={{ borderColor: "var(--color-outline-variant)" }}>
                      <td className="py-1 pr-4">{r.name}</td>
                      <td className="py-1 pr-4 whitespace-nowrap">{r.phone}</td>
                      <td className="py-1">{r.language === "hi" ? "Hindi" : "English"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.valid.length > 50 && <p className="text-xs mt-2">…and {preview.valid.length - 50} more</p>}
            </div>
          )}

          <button className="btn-base btn-primary" onClick={confirm} disabled={pending || preview.valid.length === 0 || preview.overCapacity > 0}>
            {pending ? "Saving…" : `Add ${preview.valid.length} candidate${preview.valid.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="card card-sm">
      <div className="type-stat text-3xl" style={{ color: warn ? "var(--color-error)" : "var(--color-primary)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
        {label}
      </div>
    </div>
  );
}
