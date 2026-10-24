import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { daysBetween, fmtDay, fmtMonth, iso, parse, pad, today } from "../dates";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { actions, useActiveView, useData } from "../store";
import { ACCENT } from "../Companion";
import { pickedLabels } from "../questions";
import { Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";

export function CalendarScreen() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const [cursor, setCursor] = useState(() => today().slice(0, 7) + "-01");
  const [sel, setSel] = useState(today());
  const dir = useRef(1);
  const first = parse(cursor);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: lead + dim }, (_, i) => (i < lead ? null : `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i - lead + 1)}`));
  const t0 = today();

  const status = (d: string) =>
    d > t0 ? "future"
      : data.entries.some((e) => e.habitId === habit.id && e.day === d) ? "slip"
        : data.cleanDays.some((c) => c.habitId === habit.id && c.day === d) ? "clean" : "none";

  const monthDays = cells.filter(Boolean) as string[];
  const spark = monthDays.map((d) => view.states.find((s) => s.day === d)?.visibleAge).filter((x): x is number => x !== undefined);
  const dayEntries = data.entries.filter((e) => e.habitId === habit.id && e.day === sel);
  const monthShift = (n: number) => {
    dir.current = n; haptic.select();
    const d = parse(cursor); d.setMonth(d.getMonth() + n); setCursor(iso(new Date(d.getFullYear(), d.getMonth(), 1)));
  };
  const canClean = sel <= t0 && dayEntries.length === 0 && daysBetween(companion.bornOn, sel) >= 0 && status(sel) !== "clean";
  const counts = { slip: monthDays.filter((d) => status(d) === "slip").length, clean: monthDays.filter((d) => status(d) === "clean").length };

  const W = 320, H = 56;
  const max = Math.max(10, ...spark);
  const pts = spark.map((v, i) => `${(i / Math.max(1, spark.length - 1)) * W},${H - (v / max) * (H - 6) - 3}`);
  const path = pts.length ? `M${pts.join(" L")}` : "";

  function remove(id: string) {
    const e = data.entries.find((x) => x.id === id);
    if (!e) return;
    haptic.warn();
    actions.deleteEntry(id);
    toast("Slip deleted", { action: { label: "Undo", run: () => actions.restoreEntry(e) } });
  }

  return (
    <motion.main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }} variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>Calendar</motion.h1>
      <motion.section className="card stack" aria-label="Age this month" variants={rise}>
        <div className="row"><span className="muted small">{companion.name}'s age this month</span><b>{spark.length ? Math.round(spark[spark.length - 1]) : "–"}</b></div>
        {spark.length > 1
          ? <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visible age over the month">
              <defs><linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--chart)" stopOpacity=".25" /><stop offset="1" stopColor="var(--chart)" stopOpacity="0" /></linearGradient></defs>
              <motion.path key={`f${cursor}`} d={`${path} L${W},${H} L0,${H} Z`} fill="url(#sparkfill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
              <motion.path key={cursor} d={path} fill="none" stroke="var(--chart)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
            </svg>
          : <p className="muted small">{spark.length === 1 ? `The curve starts drawing from ${companion.name}'s second day.` : "No age history for this month yet."}</p>}
      </motion.section>

      <motion.section className="card stack cal" variants={rise}>
        <div className="row">
          <button className="icon-btn" aria-label="Previous month" onClick={() => monthShift(-1)}>{Icon.chevL}</button>
          <AnimatePresence mode="wait" initial={false}><motion.h2 key={cursor} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{fmtMonth(cursor)}</motion.h2></AnimatePresence>
          <button className="icon-btn" aria-label="Next month" onClick={() => monthShift(1)} disabled={cursor >= t0.slice(0, 7) + "-01"}>{Icon.chevR}</button>
        </div>
        <div className="grid7" aria-hidden>{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div className="dow" key={i}>{d}</div>)}</div>
        <AnimatePresence mode="wait" initial={false} custom={dir.current}>
          <motion.div key={cursor} className="grid7" custom={dir.current}
            initial={{ opacity: 0, x: dir.current * 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir.current * -30 }} transition={spring.soft}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, i) => { if (i.offset.x > 70) monthShift(-1); else if (i.offset.x < -70 && cursor < t0.slice(0, 7) + "-01") monthShift(1); }}>
            {cells.map((d, i) => d ? (
              <motion.button key={d} className="day" data-s={status(d)} data-today={d === t0} disabled={d > t0}
                onClick={() => { haptic.select(); setSel(d); }} aria-label={`${fmtDay(d)}: ${status(d)}`} aria-pressed={sel === d}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: Math.min(i, 35) * 0.008 }} whileTap={{ scale: 0.88 }}>
                {sel === d && <motion.span layoutId="day-ring" className="day-ring" transition={spring.snappy} />}
                <span>{Number(d.slice(8))}</span>
              </motion.button>
            ) : <span key={`b${i}`} />)}
          </motion.div>
        </AnimatePresence>
        <div className="legend">
          <span><i style={{ background: "var(--negative)" }} />Slip · {counts.slip}</span>
          <span><i style={{ background: "var(--positive)" }} />Clean · {counts.clean}</span>
          <span><i style={{ background: "var(--raised)" }} />Not logged</span>
        </div>
      </motion.section>

      <motion.section className="stack" aria-label={`Details for ${fmtDay(sel)}`} variants={rise}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={sel} className="stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring.soft}>
            <h2>{fmtDay(sel)}</h2>
            {dayEntries.length === 0 && <p className="muted">{status(sel) === "clean" ? "Marked clean. A good day." : sel < companion.bornOn ? `${companion.name} wasn't born yet on this day.` : "Nothing logged."}</p>}
            <div className="list">
              <AnimatePresence initial={false}>
                {dayEntries.map((e) => (
                  <motion.div layout className="item" key={e.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={spring.soft}>
                    <div className="row"><b className="neg">−{Math.round(e.months * 10) / 10} months</b>
                      <button className="icon-btn danger" aria-label="Delete this slip" onClick={() => remove(e.id)}>{Icon.trash}</button></div>
                    {e.amount !== null && <span>{habit.unit === "money" ? `${data.settings.currency} ${e.amount}` : habit.unit === "minutes" ? `${e.amount} min` : e.amount}</span>}
                    {Object.entries(e.values).filter(([k, v]) => typeof v === "string" && v && habit.fields.find((f) => f.id === k)?.type === "text").map(([k, v]) => <span key={k} className="muted small">{String(v)}</span>)}
                    {(() => {
                      const tags = habit.fields.flatMap((f) => f.type === "choice" || f.type === "multi" ? pickedLabels(f, e.values[f.id]) : f.type === "scale" && e.values[f.id] ? [`Urge ${e.values[f.id]}/5`] : []);
                      return tags.length ? <div className="tags">{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div> : null;
                    })()}
                    {e.explanation && <span className="small">{e.explanation}</span>}
                    {habit.fields.filter((f) => f.type === "photo" && typeof e.values[f.id] === "string" && e.values[f.id]).map((f) => <img key={f.id} alt="Photo attached to this slip" src={String(e.values[f.id])} className="entry-photo" width={640} height={480} loading="lazy" decoding="async" />)}
                    {e.time && <span className="muted small">{e.time}</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {canClean && <Button variant="secondary" onClick={() => { actions.markClean(habit.id, sel); haptic.success(); toast("Marked clean", { kind: "good", action: { label: "Undo", run: () => actions.unmarkClean(habit.id, sel) } }); }}>Mark this day clean</Button>}
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </motion.main>
  );
}
