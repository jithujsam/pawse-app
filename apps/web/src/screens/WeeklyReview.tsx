import { useState } from "react";
import { motion } from "motion/react";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { addDays, fmtDay, today, weekStart } from "../dates";
import { weekdayOf } from "../progress";
import { haptic } from "../haptics";
import { rise } from "../motion";
import { adjustmentIdeas, observations, STATUS_LABEL, strategy, strategyResults, weekReview } from "../recovery";
import { actions, useActiveView, useData } from "../store";
import { trackState } from "../tracks";
import { plainOpts, Select, SelectOther } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { Reflect } from "./Reflect";

/**
 * The weekly review: what was recorded, what helped, what was hard, and one realistic adjustment for the
 * week ahead. Built from the person's records only; days nobody recorded are shown as unknown.
 */
export function WeeklyReview() {
  const data = useData();
  const view = useActiveView()!;
  const habit = view.habit!;
  const ws = weekStart(today());
  // Early in a week, last week is the one worth reviewing.
  const [which, setWhich] = useState<"last" | "this">(() => { const dow = weekdayOf(today()); return dow === 0 || dow >= 5 ? "this" : "last"; });
  const week = which === "this" ? ws : addDays(ws, -7);
  const r = weekReview(data, habit, week);
  const ideas = adjustmentIdeas(r, habit, trackState(data, habit.id).description || habit.name);
  const focusWeek = addDays(week, 7);
  const [crisis, setCrisis] = useState(false);
  const pick = (t: string) => { const bad = hasCrisisLanguage(t); setCrisis(bad); if (bad) return; actions.setWeekFocus(focusWeek, t, habit.id); haptic.success(); toast("Saved for the week ahead", { kind: "good" }); };
  const order = ["met", "urge", "lapse", "rest", "unrecorded"] as const;
  // Rest and paused days are both "Not tracking".
  const shown = { ...r.counts, rest: r.counts.rest + r.counts.paused };

  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">Which week?</span>
        <Select label="Which week" value={which} onChange={setWhich} options={[{ value: "last", label: "Last week" }, { value: "this", label: "This week" }]} />
      </div>
      <p className="muted small">From {fmtDay(week)}</p>
      <p>{r.goalLine}</p>
      {r.lastFocus && <p className="small">Your focus for this week was: <b>{r.lastFocus}</b></p>}
      <dl className="review-days" aria-label="Days">
        {order.filter((k) => shown[k] > 0).map((k) => (
          <div className="row" key={k}><dt><i className="dot" data-s={k} aria-hidden />{STATUS_LABEL[k]}</dt><dd><b>{shown[k]}</b> {shown[k] === 1 ? "day" : "days"}</dd></div>
        ))}
      </dl>
      {r.urges.total > 0 && <p className="small">{r.urges.managed} of {r.urges.total} {r.urges.total === 1 ? "urge" : "urges"} managed.</p>}
      {r.strategies.length > 0 && <p className="small">What you used: {r.strategies.map((s) => `${strategy(s.id).title.toLowerCase()} (${s.managed} of ${s.total} managed)`).join(", ")}.</p>}
      {r.difficult.length > 0 && <p className="small">What came up most: {r.difficult.map(([l, n]) => `${l.toLowerCase()} (${n})`).join(", ")}.</p>}
      <div className="field">
        <span className="field-label">{r.focus ? "Your focus for next week" : "Pick one small change for next week"}</span>
        {r.focus && <p><b>{r.focus}</b></p>}
        <SelectOther label="One small change for next week" options={plainOpts(ideas)} value={r.focus ?? ""} onChange={pick} maxLength={160} commitLabel="Save"
          placeholder="Pick an idea" otherPlaceholder="Your own change" />
        {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
      </div>
    </div>
  );
}

/** A small check-in: one mood and an optional line. The weekly review folds away below it. */
export function CheckIn() {
  return (
    <motion.section className="card stack tight checkin-lite" aria-label="Check in with yourself" variants={rise}>
      <Reflect />
      <details className="fold">
        <summary>Weekly review</summary>
        <div className="fold-body"><WeeklyReview /></div>
      </details>
    </motion.section>
  );
}

/** What the records show, with how much each observation rests on, and an honest "not enough yet". */
export function Observations() {
  const data = useData();
  const view = useActiveView()!;
  const habit = view.habit!;
  const o = observations(data, habit);
  const tried = strategyResults(data, habit.id).filter((s) => s.total >= 2);
  return (
    <motion.section className="card stack" aria-label="What your records show" variants={rise}>
      <h2>What your records show</h2>
      {o.items.length === 0
        ? <p className="muted">{o.needed > 0
            ? `Not enough yet to see a pattern. ${o.needed} more ${o.needed === 1 ? "slip or urge" : "slips or urges"} logged and pawse will show what it notices. Until then, it won't guess.`
            : "Nothing stands out yet. That's a real answer too: no single feeling, time or place dominates your records."}</p>
        : <div className="list">{o.items.map((x) => (
            <div className="item" key={x.id}>
              <div className="row"><b>{x.title}</b><span className="obs-strength" data-k={x.strength}>{x.strength === "pattern" ? "Pattern" : "Early hint"}</span></div>
              <span className="small">{x.detail}.</span>
            </div>
          ))}</div>}
      {o.items.length > 0 && <p className="muted small">These describe what was going on around slips and urges you recorded, not what caused them. Small numbers can mislead.</p>}
      {tried.length > 0 && (
        <div className="stack tight">
          <span className="field-label">Strategies you've tried at least twice</span>
          {tried.map((s) => <div className="row small" key={s.id}><span>{strategy(s.id).title}</span><span>{s.managed} of {s.total} managed</span></div>)}
        </div>
      )}
    </motion.section>
  );
}
