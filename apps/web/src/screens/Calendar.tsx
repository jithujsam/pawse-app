import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDay, fmtMonth, fmtTime, today } from "../dates";
import { money } from "../format";
import { tt, t } from "../text";
import { haptic } from "../haptics";
import { rise, spring } from "../motion";
import { actions, useActiveView, useData, type Deduction } from "../store";
import { pickedLabels } from "../questions";
import { dayStatus, STATUS_LABEL, strategy } from "../recovery";
import { countDays, dayControls, editableInCalendar, monthGrid, monthOf, shiftMonth, trackIndex } from "../progress";
import { Button, Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { LogSheet } from "./LogSheet";
import { trackState } from "../tracks";
import type { Pause, Tone } from "../types";
import { addDays } from "../dates";

/** The pet's age this month, then the month grid. The top of the Calendar tab. */
export function CalendarSections() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  // The month shown, as YYYY-MM.
  const [cursor, setCursor] = useState(() => monthOf(today()));
  const { lead, days: monthDays } = monthGrid(cursor);
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...monthDays];
  const t0 = today();
  const thisMonth = monthOf(t0);

  const status = (d: string) => dayStatus(data, habit.id, d, t0);
  // The last four days (today and the three before it) can be filled in or corrected from the calendar, in a sheet.
  const editable = (d: string) => editableInCalendar(data, habit.id, d, t0);
  const [sel, setSel] = useState(t0);
  const [sheet, setSheet] = useState(false);

  const spark = monthDays.map((d) => view.states.find((s) => s.day === d)?.visibleAge).filter((x): x is number => x !== undefined);
  const monthShift = (n: number) => {
    haptic.select();
    setCursor(shiftMonth(cursor, n));
  };
  const month = countDays(trackIndex(data, habit.id, t0), `${cursor}-01`, monthDays[monthDays.length - 1]);

  const W = 320, H = 56;
  const max = Math.max(10, ...spark);
  const pts = spark.map((v, i) => `${(i / Math.max(1, spark.length - 1)) * W},${H - (v / max) * (H - 6) - 3}`);
  const path = pts.length ? `M${pts.join(" L")}` : "";

  return (
    <>
      <motion.h2 variants={rise}>{t("calendar.stats.this_month")}</motion.h2>
      <motion.section className="card stack cal" variants={rise}>
        <div className="row">
          <button className="icon-btn" aria-label={t("calendar.month.previous")} onClick={() => monthShift(-1)}>{Icon.chevL}</button>
          <AnimatePresence mode="wait" initial={false}><motion.h2 key={cursor} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>{fmtMonth(`${cursor}-01`)}</motion.h2></AnimatePresence>
          <button className="icon-btn" aria-label={t("calendar.month.next")} onClick={() => monthShift(1)} disabled={cursor >= thisMonth}>{Icon.chevR}</button>
        </div>
        <p className="muted small center-text">{t("calendar.stats.met_of", { met: month.met, days: month.met + month.urge + month.lapse + month.unrecorded })}</p>
        <div className="grid7" aria-hidden>{t("calendar.month.weekdays").split(" ").map((d, i) => <div className="dow" key={i}>{d}</div>)}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={cursor} className="grid7"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
            onDragEnd={(_, i) => { if (i.offset.x > 70) monthShift(-1); else if (i.offset.x < -70 && cursor < thisMonth) monthShift(1); }}>
            {cells.map((d, i) => d ? (
              <motion.button key={d} type="button" className="day" data-s={status(d)} data-today={d === t0} data-edit={editable(d) || undefined} aria-haspopup="dialog"
                aria-label={t(editable(d) ? "calendar.month.day_edit_aria" : "calendar.month.day_aria", { date: fmtDay(d), status: STATUS_LABEL[status(d)] })} onClick={() => { haptic.select(); setSel(d); setSheet(true); }}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: Math.min(i, 35) * 0.008 }}>
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
        <p className="muted small">{t("calendar.month.note")}</p>
      </motion.section>
      {spark.length >= 7 && spark.some((v) => v > 0) && (
      <motion.section className="card stack" aria-label={t("calendar.age.aria")} variants={rise}>
        <div className="row"><span className="muted small">{t("calendar.age.label", { name: companion.name })}</span><b>{spark.length ? Math.round(spark[spark.length - 1]) : "–"}</b></div>
        {spark.length > 1
          ? <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("calendar.age.chart")}>
              <motion.path key={`f${cursor}`} d={`${path} L${W},${H} L0,${H} Z`} fill="var(--chart)" fillOpacity={0.12} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
              <motion.path key={cursor} d={path} fill="none" stroke="var(--chart)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
            </svg>
          : <p className="muted small">{spark.length === 1 ? t("calendar.age.one_point", { name: companion.name }) : t("calendar.age.none")}</p>}
      </motion.section>

      )}
      <Sheet open={sheet} onClose={() => setSheet(false)} label={t("calendar.day.aria", { date: fmtDay(sel) })}>
        <DayDetail day={sel} standalone />
      </Sheet>
    </>
  );
}

/**
 * One day's record and what can be done to it: marked goal met, not tracked, or given the slip that really
 * happened. What each day shows and allows comes from the shared rules (progress.ts dayControls). The pet screen
 * shows today's. `standalone` is for a sheet, where no parent screen fades the card in. `onMarkMet` and `onSlipSaved` let that screen run its own celebration and reactions.
 */
export function DayDetail({ day: sel, standalone, onMarkMet, onSlipSaved }: { day: string; standalone?: boolean; onMarkMet?: () => void; onSlipSaved?: (d: Deduction) => void }) {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const track = trackState(data, habit.id);
  const tone = data.settings.tone;
  const t0 = today();
  const ctl = dayControls(data, habit.id, sel, t0);
  // In the calendar sheet, a day outside the last four can be read but not changed.
  const locked = !!standalone && !editableInCalendar(data, habit.id, sel, t0);
  const [logging, setLogging] = useState(false);
  const dayEntries = data.entries.filter((e) => e.habitId === habit.id && e.day === sel);
  const dayUrges = data.urges.filter((u) => u.habitId === habit.id && u.day === sel);

  function remove(id: string) {
    const e = data.entries.find((x) => x.id === id);
    if (!e) return;
    haptic.warn();
    actions.deleteEntry(id);
    toast(t("calendar.day.deleted"), { action: { label: t("ui.common.undo"), run: () => actions.restoreEntry(e) } });
  }

  return (
    <>
      <motion.section className={standalone ? "stack" : "card stack home-day"} aria-label={t("calendar.day.aria", { date: fmtDay(sel) })} variants={standalone ? undefined : rise}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={sel} className="stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring.soft}>
            <h2>{fmtDay(sel)}</h2>
            {dayEntries.length === 0 && <p className="muted">{ctl.status === "met" ? tt("calendar.note.met", tone) : ctl.status === "rest" ? tt("calendar.note.rest", tone) : ctl.status === "paused" ? pausedDayLine(tone, track.pauses, sel) : !locked && !ctl.inLife && sel < companion.bornOn ? t("calendar.note.not_born", { name: companion.name }) : ctl.status === "urge" ? tt("calendar.note.urge_managed", tone) : dayUrges.length ? t("calendar.note.urge_noted") : tt("calendar.note.nothing", tone)}</p>}
            {dayUrges.length > 0 && <p className="small">{t("calendar.day.urges_managed", { managed: ctl.managedUrges, total: dayUrges.length, urges: dayUrges.length === 1 ? t("calendar.day.urge_one") : t("calendar.day.urge_other") })}{dayUrges.some((u) => u.strategy) ? t("calendar.day.urges_using", { strategies: [...new Set(dayUrges.map((u) => u.strategy).filter(Boolean))].map((x) => strategy(x!).title.toLowerCase()).join(", ") }) : ""}.</p>}
            <div className="list">
              <AnimatePresence initial={false}>
                {dayEntries.map((e) => (
                  <motion.div layout className="item" key={e.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={spring.soft}>
                    <div className="row"><b className="neg">{STATUS_LABEL.lapse}</b>
                      {!locked && <button className="icon-btn danger" aria-label={t("calendar.day.delete_aria")} onClick={() => remove(e.id)}>{Icon.trash}</button>}</div>
                    {e.amount !== null && <span>{habit.unit === "money" ? money(data.settings.currency, e.amount) : habit.unit === "minutes" ? t("calendar.day.minutes", { n: e.amount }) : e.amount}</span>}
                    {Object.entries(e.values).filter(([k, v]) => typeof v === "string" && v && habit.fields.find((f) => f.id === k)?.type === "text").map(([k, v]) => <span key={k} className="muted small">{String(v)}</span>)}
                    {(() => {
                      const tags = habit.fields.flatMap((f) => f.type === "choice" || f.type === "multi" ? pickedLabels(f, e.values[f.id]) : f.type === "scale" && e.values[f.id] ? [`Urge ${e.values[f.id]}/5`] : []);
                      return tags.length ? <div className="tags">{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div> : null;
                    })()}
                    {e.explanation && <span className="small">{e.explanation}</span>}
                    {typeof e.values.lapse_before === "string" && e.values.lapse_before && <span className="small">{t("calendar.day.before", { text: e.values.lapse_before })}</span>}
                    {typeof e.values.lapse_adjust === "string" && e.values.lapse_adjust && <span className="small">{t("calendar.day.next_time", { text: e.values.lapse_adjust })}</span>}
                    {habit.fields.filter((f) => f.type === "photo" && typeof e.values[f.id] === "string" && e.values[f.id]).map((f) => <img key={f.id} alt={t("calendar.day.photo_alt")} src={String(e.values[f.id])} className="entry-photo" width={640} height={480} loading="lazy" decoding="async" />)}
                    {e.time && <span className="muted small">{fmtTime(e.time)}</span>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {standalone
              ? locked
                ? <p className="muted">{sel > t0 ? t("calendar.day.future") : t("calendar.day.locked")}</p>
                : <>
                    {ctl.canMarkMet && <Button variant="secondary" onClick={() => { actions.markClean(habit.id, sel); haptic.success(); toast(t("calendar.day.marked_met"), { kind: "good", ms: 1000, action: { label: t("ui.common.undo"), run: () => actions.unmarkClean(habit.id, sel) } }); }}>{t("calendar.day.mark_met")}</Button>}
                    {ctl.canUnmarkMet && <Button variant="text" onClick={() => { actions.unmarkClean(habit.id, sel); toast(t("calendar.day.removed_met"), { action: { label: t("ui.common.undo"), run: () => actions.markClean(habit.id, sel) } }); }}>{t("calendar.day.remove_met")}</Button>}
                    {ctl.canLogSlip && <Button variant="text" onClick={() => setLogging(true)}>{dayEntries.length ? t("calendar.day.log_another") : t("calendar.day.log_slip")}</Button>}
                  </>
              : <>
            {ctl.canMarkMet && <Button variant="secondary" onClick={() => { if (onMarkMet) { onMarkMet(); return; } actions.markClean(habit.id, sel); haptic.success(); toast(t("calendar.day.marked_met"), { kind: "good", ms: 1000, action: { label: t("ui.common.undo"), run: () => actions.unmarkClean(habit.id, sel) } }); }}>{t("calendar.day.mark_met")}</Button>}
              {ctl.canUnmarkMet && <Button variant="text" onClick={() => { actions.unmarkClean(habit.id, sel); toast(t("calendar.day.removed_met"), { action: { label: t("ui.common.undo"), run: () => actions.markClean(habit.id, sel) } }); }}>{t("calendar.day.remove_met")}</Button>}
              {ctl.canLogSlip && <Button variant="text" onClick={() => setLogging(true)}>{dayEntries.length ? t("calendar.day.log_another") : t("calendar.day.log_slip")}</Button>}
              </>}
          </motion.div>
        </AnimatePresence>
      </motion.section>
      <LogSheet open={logging} day={sel} habit={habit} name={companion.name} age={view.age} onClose={() => setLogging(false)} onSaved={(d) => { haptic.heavy(); onSlipSaved?.(d); }} />
    </>
  );
}

/** The calendar line for a paused day, with the pause it belongs to. Paused days count neither way. */
function pausedDayLine(tone: Tone, pauses: Pause[], day: string): string {
  const p = pauses.find((x) => day >= x.from && (x.to === null || day < x.to));
  if (!p) return tt("calendar.note.paused_unknown", tone);
  return p.to === null ? tt("calendar.note.paused_open", tone, { from: fmtDay(p.from) }) : tt("calendar.note.paused_range", tone, { from: fmtDay(p.from), to: fmtDay(addDays(p.to, -1)) });
}
