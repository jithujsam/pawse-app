import { useEffect, useRef, useState } from "react";
import { aiForSlip } from "../ai";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { addDays, today } from "../dates";
import { EFFECT_LABEL } from "../copy";
import { actions, slipRequest, type Deduction } from "../store";
import type { Entry, Habit } from "../types";

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } finally { URL.revokeObjectURL(url); }
}

export function LogSheet({ habit, name, onClose, onSaved }: { habit: Habit; name: string; onClose: () => void; onSaved: (d: Deduction) => void }) {
  const [values, setValues] = useState<Entry["values"]>({});
  const [day, setDay] = useState(today());
  const [time, setTime] = useState("");
  const [crisis, setCrisis] = useState(false);
  const [result, setResult] = useState<Deduction | null>(null);
  const alive = useRef(true);
  const [polishing, setPolishing] = useState(false);
  useEffect(() => () => { alive.current = false; }, []);
  const set = (id: string, v: string | boolean) => setValues((s) => ({ ...s, [id]: v }));

  const missing = habit.fields.some((f) => f.required && (values[f.id] === undefined || values[f.id] === ""));

  function save() {
    const texts = habit.fields.filter((f) => f.type === "text").map((f) => String(values[f.id] ?? ""));
    if (texts.some(hasCrisisLanguage)) { setCrisis(true); return; }
    const d = actions.logSlip(habit.id, values, day, time || null);
    setResult(d);
    onSaved(d);
    const req = slipRequest(d.entry.id);
    if (req) {
      setPolishing(true);
      void aiForSlip(req).then((r) => {
        if (!r) return;
        actions.applyAi(d.entry.id, r);
        if (alive.current) setResult((cur) => cur && ({
          ...cur, line: r.explanation, entry: { ...cur.entry, months: r.months, source: "ai" },
          effectLine: r.effects.map((e) => EFFECT_LABEL[e]).filter(Boolean).slice(0, 2).join(" ") || cur.effectLine,
        }));
      }).finally(() => { if (alive.current) setPolishing(false); });
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Log a slip" onClick={(e) => e.stopPropagation()}>
        {crisis ? (<>
          <h2>Pause for a moment</h2>
          <p>{CRISIS_MESSAGE}</p>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </>) : result ? (<>
          <h2>Logged</h2>
          <div className="deduction fade-in">
            <span>That cost {name}</span>
            <b>{Math.round(result.entry.months * 10) / 10} months</b>
            <span>{result.effectLine}</span>
            <span className="muted small">{result.nthToday > 1 ? `Slip ${result.nthToday} today. ` : ""}{result.weekSlips} this week.</span>
          </div>
          <p key={result.line} className="bubble">{result.line}</p>
          {polishing && <p className="muted small" aria-live="polite">Finding the right words…</p>}
          <button className="btn" onClick={onClose}>Done</button>
        </>) : (<>
          <div className="row"><h2>Log a slip</h2><button className="btn text" onClick={onClose}>Cancel</button></div>
          <div className="chips" role="group" aria-label="Day">
            <button className="chip" aria-pressed={day === today()} onClick={() => setDay(today())}>Today</button>
            <button className="chip" aria-pressed={day === addDays(today(), -1)} onClick={() => setDay(addDays(today(), -1))}>Yesterday</button>
            <input className="input" style={{ width: 120 }} type="time" aria-label="Time (optional)" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          {habit.fields.map((f) => (
            <label className="field" key={f.id}>
              {f.label}{f.required ? "" : ""}
              {f.type === "text" && <input className="input" maxLength={120} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
              {(f.type === "number" || f.type === "money") && <input className="input" inputMode="decimal" type="number" min="0" value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} />}
              {f.type === "yesno" && (
                <span className="toggle">
                  <button type="button" className="chip" aria-pressed={values[f.id] === true} onClick={() => set(f.id, true)}>Yes</button>
                  <button type="button" className="chip" aria-pressed={values[f.id] === false} onClick={() => set(f.id, false)}>No</button>
                </span>
              )}
              {f.type === "photo" && <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set(f.id, await shrink(file)); }} />}
            </label>
          ))}
          <button className="btn" disabled={missing} onClick={save}>Save slip</button>
        </>)}
      </div>
    </div>
  );
}
