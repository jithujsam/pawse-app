import { useState } from "react";
import { addDays, daysBetween, fmtDay, fmtMonth, iso, parse, pad, today } from "../dates";
import { actions, activeCompanion, useData, viewCompanion } from "../store";
import { ACCENT } from "../Companion";

export function CalendarScreen() {
  const data = useData();
  const companion = activeCompanion(data)!;
  const view = viewCompanion(data, companion.id);
  const habit = view.habit!;
  const [cursor, setCursor] = useState(() => today().slice(0, 7) + "-01");
  const [sel, setSel] = useState(today());
  const first = parse(cursor);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: lead + dim }, (_, i) => (i < lead ? null : `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i - lead + 1)}`));

  const status = (d: string) =>
    d > today() ? "future"
      : data.entries.some((e) => e.habitId === habit.id && e.day === d) ? "slip"
        : data.cleanDays.some((c) => c.habitId === habit.id && c.day === d) ? "clean" : "none";

  const monthDays = cells.filter(Boolean) as string[];
  const spark = monthDays.map((d) => view.states.find((s) => s.day === d)?.visibleAge).filter((x): x is number => x !== undefined);
  const dayEntries = data.entries.filter((e) => e.habitId === habit.id && e.day === sel);
  const monthShift = (n: number) => { const d = parse(cursor); d.setMonth(d.getMonth() + n); setCursor(iso(new Date(d.getFullYear(), d.getMonth(), 1))); };
  const canClean = sel <= today() && dayEntries.length === 0 && daysBetween(companion.bornOn, sel) >= 0 && status(sel) !== "clean";

  const W = 320, H = 56;
  const max = Math.max(10, ...spark);
  const pts = spark.map((v, i) => `${(i / Math.max(1, spark.length - 1)) * W},${H - (v / max) * (H - 6) - 3}`).join(" ");

  return (
    <main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }}>
      <h1>Calendar</h1>
      <section className="card stack" aria-label="Age this month">
        <div className="row"><span className="muted small">{companion.name}'s age this month</span><b>{spark.length ? Math.round(spark[spark.length - 1]) : "-"}</b></div>
        {spark.length > 1
          ? <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visible age over the month"><polyline points={pts} fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinejoin="round" /></svg>
          : <p className="muted small">No age history for this month yet.</p>}
      </section>

      <section className="card stack">
        <div className="row">
          <button className="btn text" aria-label="Previous month" onClick={() => monthShift(-1)}>Prev</button>
          <h2>{fmtMonth(cursor)}</h2>
          <button className="btn text" aria-label="Next month" onClick={() => monthShift(1)}>Next</button>
        </div>
        <div className="grid7" aria-hidden>{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div className="dow" key={i}>{d}</div>)}</div>
        <div className="grid7">
          {cells.map((d, i) => d ? (
            <button key={d} className="day" data-s={status(d)} data-sel={sel === d} disabled={d > today()} onClick={() => setSel(d)} aria-label={`${fmtDay(d)}: ${status(d)}`}>{Number(d.slice(8))}</button>
          ) : <span key={`b${i}`} />)}
        </div>
        <div className="legend"><span><i style={{ background: "var(--negative)" }} />Slip</span><span><i style={{ background: "var(--pet)" }} />Clean</span><span><i style={{ background: "var(--raised)" }} />Not logged</span></div>
      </section>

      <section className="stack" aria-label={`Details for ${fmtDay(sel)}`}>
        <h2>{fmtDay(sel)}</h2>
        {dayEntries.length === 0 && <p className="muted">{status(sel) === "clean" ? "Marked clean." : "Nothing logged."}</p>}
        <div className="list">
          {dayEntries.map((e) => (
            <div className="item" key={e.id}>
              <div className="row"><b>{Math.round(e.months * 10) / 10} months lost</b><button className="btn danger" onClick={() => actions.deleteEntry(e.id)}>Delete</button></div>
              {e.amount !== null && <span>{habit.unit === "money" ? `${data.settings.currency} ${e.amount}` : habit.unit === "minutes" ? `${e.amount} min` : e.amount}</span>}
              {Object.entries(e.values).filter(([k, v]) => typeof v === "string" && v && !k.startsWith("photo") && habit.fields.find((f) => f.id === k)?.type === "text").map(([k, v]) => <span key={k} className="muted small">{String(v)}</span>)}
              {habit.fields.filter((f) => f.type === "photo" && typeof e.values[f.id] === "string" && e.values[f.id]).map((f) => <img key={f.id} alt="Attached" src={String(e.values[f.id])} style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />)}
              <span className="muted small">{e.time ?? ""}</span>
            </div>
          ))}
        </div>
        {canClean && <button className="btn secondary" onClick={() => actions.markClean(habit.id, sel)}>Mark this day clean</button>}
        {sel < addDays(companion.bornOn, 0) && <p className="muted small">{companion.name} wasn't born yet on this day.</p>}
      </section>
    </main>
  );
}
