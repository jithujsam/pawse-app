import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addDays, fmtDay, fmtMonth, fmtTime, today } from "../dates";
import { haptic } from "../haptics";
import { rise, spring } from "../motion";
import { actions, useActiveView, useData } from "../store";
import { pickedLabels } from "../questions";
import { dayStatus, STATUS_LABEL, strategy } from "../recovery";
import { countDays, dayControls, monthGrid, monthOf, shiftMonth, trackIndex } from "../progress";
import { Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { LogSheet } from "./LogSheet";
import { trackState } from "../tracks";
import type { Pause } from "../types";

/** The pet's age this month, the month grid, then the selected day. The top of the Calendar tab. */
export function CalendarSections() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const track = trackState(data, habit.id);
  // The month shown, as YYYY-MM.
  const [cursor, setCursor] = useState(() => monthOf(today()));
  const [sel, setSel] = useState(today());
  const dir = useRef(1);
  const { lead, days: monthDays } = monthGrid(cursor);
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...monthDays];
  const t0 = today();
  const thisMonth = monthOf(t0);

  const status = (d: string) => dayStatus(data, habit.id, d, t0);

  const spark = monthDays.map((d) => view.states.find((s) => s.day === d)?.visibleAge).filter((x): x is number => x !== undefined);
  const dayEntries = data.entries.filter((e) => e.habitId === habit.id && e.day === sel);
  const monthShift = (n: number) => {
    dir.current = n; haptic.select();
    setCursor(shiftMonth(cursor, n));
  };
  // Any past day can be corrected both ways: marked goal met, or given the slip that really happened.
  // What each day shows and allows comes from the shared rules (progress.ts dayControls).
  const ctl = dayControls(data, habit.id, sel, t0);
  const [logging, setLogging] = useState(false);
  const dayUrges = data.urges.filter((u) => u.habitId === habit.id && u.day === sel);
  const month = countDays(trackIndex(data, habit.id, t0), `${cursor}-01`, monthDays[monthDays.length - 1]);

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
    <>
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
          <AnimatePresence mode="wait" initial={false}><motion.h2 key={cursor} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{fmtMonth(`${cursor}-01`)}</motion.h2></AnimatePresence>
          <button className="icon-btn" aria-label="Next month" onClick={() => monthShift(1)} disabled={cursor >= thisMonth}>{Icon.chevR}</button>
        </div>
        <div className="grid7" aria-hidden>{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div className="dow" key={i}>{d}</div>)}</div>
        <AnimatePresence mode="wait" initial={false} custom={dir.current}>
          <motion.div key={cursor} className="grid7" custom={dir.current}
            initial={{ opacity: 0, x: dir.current * 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir.current * -30 }} transition={spring.soft}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, i) => { if (i.offset.x > 70) monthShift(-1); else if (i.offset.x < -70 && cursor < thisMonth) monthShift(1); }}>
            {cells.map((d, i) => d ? (
              <motion.button key={d} className="day" data-s={status(d)} data-today={d === t0} disabled={d > t0}
                onClick={() => { haptic.select(); setSel(d); }} aria-label={`${fmtDay(d)}: ${STATUS_LABEL[status(d)]}`} aria-pressed={sel === d}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: Math.min(i, 35) * 0.008 }} whileTap={{ scale: 0.88 }}>
                {sel === d && <motion.span layoutId="day-ring" className="day-ring" transition={spring.snappy} />}
                <span>{Number(d.slice(8))}</span>
              </motion.button>
            ) : <span key={`b${i}`} />)}
          </motion.div>
        </AnimatePresence>
        <div className="legend">
          <span><i style={{ background: "var(--positive)" }} />{STATUS_LABEL.met} · {month.met}</span>
          <span><i data-s="urge" />{STATUS_LABEL.urge} · {month.urge}</span>
          <span><i style={{ background: "var(--negative)" }} />{STATUS_LABEL.lapse} · {month.lapse}</span>
          <span><i data-s="rest" />{STATUS_LABEL.rest} · {month.rest + month.paused}</span>
          <span><i style={{ background: "var(--raised)" }} />{STATUS_LABEL.unrecorded}</span>
        </div>
        <p className="muted small">A day with nothing recorded is just unknown. It never counts as a slip or as progress.</p>
      </motion.section>

      <motion.section className="card stack" aria-label={`Details for ${fmtDay(sel)}`} variants={rise}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={sel} className="stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring.soft}>
            <h2>{fmtDay(sel)}</h2>
            {dayEntries.length === 0 && <p className="muted">{ctl.status === "met" ? "Goal met. A good day." : ctl.status === "rest" ? "You chose not to track this day. It counts neither way." : ctl.status === "paused" ? pausedDayLine(track.pauses, sel) : sel < companion.bornOn ? `${companion.name} wasn't born yet on this day.` : ctl.status === "urge" ? "No slip recorded, and an urge managed." : dayUrges.length ? "An urge was noted. No slip was logged, so this isn't counted as one." : "Nothing recorded."}</p>}
            {dayUrges.length > 0 && <p className="small">{ctl.managedUrges} of {dayUrges.length} {dayUrges.length === 1 ? "urge" : "urges"} managed{dayUrges.some((u) => u.strategy) ? `, using ${[...new Set(dayUrges.map((u) => u.strategy).filter(Boolean))].map((x) => strategy(x!).title.toLowerCase()).join(", ")}` : ""}.</p>}
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
                    {typeof e.values.lapse_before === "string" && e.values.lapse_before && <span className="small">Before: {e.values.lapse_before}</span>}
                    {typeof e.values.lapse_adjust === "string" && e.values.lapse_adjust && <span className="small">Next time: {e.values.lapse_adjust}</span>}
                    {habit.fields.filter((f) => f.type === "photo" && typeof e.values[f.id] === "string" && e.values[f.id]).map((f) => <img key={f.id} alt="Photo attached to this slip" src={String(e.values[f.id])} className="entry-photo" width={640} height={480} loading="lazy" decoding="async" />)}
                    {e.time && <span className="muted small">{fmtTime(e.time)}</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {ctl.canMarkMet && <Button variant="secondary" onClick={() => { actions.markClean(habit.id, sel); haptic.success(); toast("Marked as goal met", { kind: "good", action: { label: "Undo", run: () => actions.unmarkClean(habit.id, sel) } }); }}>Mark this day as goal met</Button>}
            {ctl.canUnmarkMet && <Button variant="text" onClick={() => { actions.unmarkClean(habit.id, sel); toast("Goal met removed", { action: { label: "Undo", run: () => actions.markClean(habit.id, sel) } }); }}>Remove “goal met”</Button>}
            {ctl.canRest && <Button variant="text" onClick={() => { haptic.select(); actions.setRest(habit.id, sel, !ctl.resting); }}>{ctl.resting ? "Track this day after all" : "I chose not to track this day"}</Button>}
            {ctl.canLogSlip && <Button variant="text" onClick={() => setLogging(true)}>{dayEntries.length ? "Log another slip for this day" : "Log a slip for this day"}</Button>}
          </motion.div>
        </AnimatePresence>
      </motion.section>
      <LogSheet open={logging} day={sel} habit={habit} name={companion.name} age={view.age} onClose={() => setLogging(false)} onSaved={() => haptic.heavy()} />
    </>
  );
}

/** The calendar line for a paused day, with the pause it belongs to. Paused days count neither way. */
function pausedDayLine(pauses: Pause[], day: string): string {
  const p = pauses.find((x) => day >= x.from && (x.to === null || day < x.to));
  if (!p) return "Not tracking: this track was paused. It counts neither way.";
  const span = p.to === null ? `has been paused since ${fmtDay(p.from)}` : `was paused from ${fmtDay(p.from)} to ${fmtDay(addDays(p.to, -1))}`;
  return `Not tracking: this track ${span}. It counts neither way.`;
}
