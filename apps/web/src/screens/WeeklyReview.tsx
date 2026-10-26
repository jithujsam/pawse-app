import { useState } from "react";
import { motion } from "motion/react";
import { concernIn } from "../guard";
import { t } from "../text";
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
  const pick = (text: string) => { if (concernIn(text)) return; actions.setWeekFocus(focusWeek, text, habit.id); haptic.success(); toast(t("insights.review.saved"), { kind: "good" }); };
  const order = ["met", "urge", "lapse", "rest", "unrecorded"] as const;
  // Rest and paused days are both "Not tracking".
  const shown = { ...r.counts, rest: r.counts.rest + r.counts.paused };

  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">{t("insights.review.which")}</span>
        <Select label={t("insights.review.which")} value={which} onChange={setWhich} options={[{ value: "last", label: t("insights.review.last_week") }, { value: "this", label: t("insights.review.this_week") }]} />
      </div>
      <p className="muted small">{t("insights.review.from", { date: fmtDay(week) })}</p>
      <p>{r.goalLine}</p>
      {r.lastFocus && <p className="small">{t("insights.review.last_focus")} <b>{r.lastFocus}</b></p>}
      <dl className="review-days" aria-label={t("insights.review.days_aria")}>
        {order.filter((k) => shown[k] > 0).map((k) => (
          <div className="row" key={k}><dt><i className="dot" data-s={k} aria-hidden />{STATUS_LABEL[k]}</dt><dd><b>{shown[k]}</b> {shown[k] === 1 ? t("calendar.stats.day") : t("calendar.stats.days")}</dd></div>
        ))}
      </dl>
      {r.urges.total > 0 && <p className="small">{t("insights.review.urges", { managed: r.urges.managed, total: r.urges.total, urges: r.urges.total === 1 ? t("insights.review.urge_one") : t("insights.review.urge_other") })}</p>}
      {r.strategies.length > 0 && <p className="small">{t("insights.review.used", { list: r.strategies.map((s) => t("insights.review.strategy_item", { title: strategy(s.id).title.toLowerCase(), managed: s.managed, total: s.total })).join(", ") })}</p>}
      {r.difficult.length > 0 && <p className="small">{t("insights.review.hard", { list: r.difficult.map(([l, n]) => `${l.toLowerCase()} (${n})`).join(", ") })}</p>}
      <div className="field">
        <span className="field-label">{r.focus ? t("insights.review.focus_next") : t("insights.review.pick_focus")}</span>
        {r.focus && <p><b>{r.focus}</b></p>}
        <SelectOther label={t("insights.review.focus_aria")} options={plainOpts(ideas)} value={r.focus ?? ""} onChange={pick} maxLength={160} commitLabel={t("ui.common.save")}
          placeholder={t("insights.review.focus_placeholder")} otherPlaceholder={t("insights.review.focus_own")} />
      </div>
    </div>
  );
}

/** A small check-in: one mood and an optional line. The weekly review folds away below it. */
export function CheckIn() {
  return (
    <motion.section className="card stack tight checkin-lite" aria-label={t("insights.review.check_in")} variants={rise}>
      <Reflect />
      <details className="fold">
        <summary>{t("insights.review.fold")}</summary>
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
    <motion.section className="card stack" aria-label={t("insights.patterns.aria")} variants={rise}>
      <h2>{t("insights.patterns.title")}</h2>
      {o.items.length === 0
        ? <p className="muted">{o.needed > 0
            ? (o.needed === 1 ? t("insights.patterns.not_enough_one") : t("insights.patterns.not_enough_other", { n: o.needed }))
            : t("insights.patterns.nothing")}</p>
        : <div className="list">{o.items.map((x) => (
            <div className="item" key={x.id}>
              <div className="row"><b>{x.title}</b><span className="obs-strength" data-k={x.strength}>{x.strength === "pattern" ? t("insights.patterns.pattern") : t("insights.patterns.hint")}</span></div>
              <span className="small">{x.detail}.</span>
            </div>
          ))}</div>}
      {o.items.length > 0 && <p className="muted small">{t("insights.patterns.caveat")}</p>}
      {tried.length > 0 && (
        <div className="stack tight">
          <span className="field-label">{t("insights.patterns.tried")}</span>
          {tried.map((s) => <div className="row small" key={s.id}><span>{strategy(s.id).title}</span><span>{t("insights.patterns.tried_row", { managed: s.managed, total: s.total })}</span></div>)}
        </div>
      )}
    </motion.section>
  );
}
