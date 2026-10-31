import { useState } from "react";
import { motion } from "motion/react";
import { projectDaysToAge } from "@detox/engine";
import { verdict } from "../copy";
import { checkIns, countDays, trackIndex, trackSummary, weekdayOf } from "../progress";
import { addDays, fmtDay, fmtHour, parse, today, weekStart } from "../dates";
import { dayStatus, STATUS_LABEL } from "../recovery";
import { TopBar } from "../ui/TopBar";
import { spring } from "../motion";
import { actions, BASELINE_PER_WEEK, moneyKept, recentPace, riskyHour, slipHour, useActiveView, useData, weekStats } from "../store";
import { needsTrackContext, trackState } from "../tracks";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Button, Icon, plainOpts, SelectOther, TrackContext } from "../ui/Controls";
import { CheckIn, Observations, WeeklyReview } from "./WeeklyReview";
import { t } from "../text";
import { money } from "../format";
import type { Baseline } from "../types";

/** Common things to save for. Anything else can be typed. */
export const SAVING_FOR = ["An emergency fund", "A trip", "Something for my home", "A gift for someone", "Paying off a debt", "Something I've wanted for a while", "My future"];
const BASELINE_LABEL: Record<Baseline, string> = { many_daily: t("insights.since.several_daily"), daily: t("insights.since.daily"), few_weekly: t("insights.since.few_weekly"), weekly: t("insights.since.weekly") };


function SavingsGoal({ habitId, saved, goal, currency }: { habitId: string; saved: number; goal: { label: string; target: number } | null; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(goal?.label ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target) : "");
  if (editing) return (
    <div className="stack tight">
      <div className="field"><span className="field-label">{t("insights.money.saving_toward")}</span>
        <SelectOther label={t("insights.money.saving_toward")} value={label} onChange={setLabel} options={plainOpts(SAVING_FOR)} maxLength={40} placeholder={t("insights.money.choose_what")} otherPlaceholder={t("insights.money.own_goal")} /></div>
      <label className="field"><span className="field-label">{t("insights.money.costs")}</span><input className="input" inputMode="decimal" type="number" min="1" placeholder="5000" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
      <div className="actions">
        <Button disabled={!label.trim() || !(Number(target) > 0)} onClick={() => { actions.setTrackSettings(habitId, { savingsGoal: { label: label.trim(), target: Math.round(Number(target)) } }); setEditing(false); }}>{t("insights.money.save_goal")}</Button>
        <Button variant="secondary" onClick={() => { if (goal) actions.setTrackSettings(habitId, { savingsGoal: null }); setEditing(false); }}>{goal ? t("insights.money.remove") : t("ui.common.cancel")}</Button>
      </div>
    </div>
  );
  if (!goal) return <Button variant="secondary" onClick={() => setEditing(true)}>{t("insights.money.set_goal")}</Button>;
  const pct = Math.min(100, (saved / goal.target) * 100);
  return (
    <div className="stack tight">
      <div className="row"><b>{goal.label}</b><span className="muted small">{t("insights.money.progress", { saved: money(currency, Math.min(saved, goal.target)), target: money(currency, goal.target) })}</span></div>
      <div className="progress goal" aria-hidden><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={spring.calm} /></div>
      <div className="row"><span className="small">{pct >= 100 ? t("insights.money.enough") : t("insights.money.percent", { pct: Math.round(pct) })}</span><Button variant="text" onClick={() => setEditing(true)}>{t("ui.common.edit")}</Button></div>
    </div>
  );
}

function Delta({ cur, prev, unit = "", good = "down" }: { cur: number; prev: number; unit?: string; good?: "up" | "down" }) {
  if (cur === prev) return <span className="delta flat">{t("insights.week.no_change")}</span>;
  const down = cur < prev;
  const better = good === "down" ? down : !down;
  return <span className={`delta ${better ? "good" : "bad"}`}>{down ? "↓" : "↑"} {Math.abs(Math.round((cur - prev) * 10) / 10)}{unit}</span>;
}

export function Report() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const { tone, currency } = data.settings;
  const state = trackState(data, habit.id);
  const { baseline } = state;
  const ws = weekStart(today());
  const cur = weekStats(data, habit.id, ws);
  const track = trackIndex(data, habit.id, today());
  const progress = trackSummary(data, habit.id, today());
  const cleanIn = (from: string) => countDays(track, from, addDays(from, 6)).met;
  const cleanThis = cleanIn(ws), cleanPrev = cleanIn(addDays(ws, -7));
  // Days with anything recorded (a slip, goal met or an urge), so a quiet week shows up as one.
  const checkedIn = (from: string) => checkIns(track, from, addDays(from, 6)).checkedIn;
  const inThis = checkedIn(ws), inPrev = checkedIn(addDays(ws, -7));
  const prev = weekStats(data, habit.id, addDays(ws, -7));
  const weeks = Array.from({ length: 8 }, (_, i) => weekStats(data, habit.id, addDays(ws, -7 * (7 - i))).slips);
  const maxW = Math.max(1, ...weeks);
  const all = data.entries.filter((e) => e.habitId === habit.id);
  const frailIn = view.age >= 80 ? 0 : projectDaysToAge(view.states, 80);
  const money = habit.unit === "money";
  const fmt = (n: number) => Math.round(n * 10) / 10;

  // Pace over checked-in days only, so quiet days aren't read as clean ones.
  const pace = recentPace(data, habit.id, companion.bornOn);
  const recentPerWeek = pace ?? 0;

  // Summaries written earlier stay readable here. New ones are no longer written: the numbers above already say it.
  const summary = data.summaries[habit.id]?.[ws];

  const W = 320, H = 130, bw = 26, gap = (W - bw * 8) / 7;

  // Urges: noticing and riding them out is the skill that predicts lasting change.
  const urgeLog = data.urges.filter((u) => u.habitId === habit.id);
  const rode = progress.managedUrges;
  // When it happens: weekday x four-hour block.
  const grid = Array.from({ length: 7 }, () => Array(6).fill(0) as number[]);
  for (const e of all) { const h = slipHour(e); if (h !== null) grid[(weekdayOf(e.day) + 6) % 7][Math.floor(h / 4)]++; }
  const gridMax = Math.max(1, ...grid.flat());
  const timed = grid.flat().reduce((a, b) => a + b, 0);
  const risk = riskyHour(data, habit.id);
  // Money kept: the old pace (from onboarding) against what was actually spent.
  // Only checked-in days count: a day with nothing logged is unknown, never money kept.
  const kept = moneyKept(data, habit.id, companion.bornOn);
  const saved = kept ? kept.saved : null;
  const goal = state.savingsGoal;

  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    return { d, s: dayStatus(data, habit.id, d, today()), label: parse(d).toLocaleDateString(undefined, { weekday: "narrow" }) };
  });
  const weekMet = strip.filter((x) => x.s === "met").length;

  return (
    <main className="screen">
      <TopBar title={t("insights.header.title")} />
      {needsTrackContext(data, habit.id) && <TrackContext name={habit.name} pet={companion.name} paused={trackState(data, habit.id).status === "paused"} />}

      <section className="stack" aria-label={t("insights.week.title")}>
        <h2>{t("insights.week.title")}</h2>
        <section className="card stack">
        <p>{verdict(tone, cur.slips, prev.slips)}</p>
        <div className="stats">
          <div className="stat"><div className="muted small">{t("insights.week.slips")}</div><div className="v"><AnimatedNumber value={cur.slips} from={0} /></div><Delta cur={cur.slips} prev={prev.slips} /></div>
          <div className="stat"><div className="muted small">{t("insights.week.life_lost")}</div><div className="v"><AnimatedNumber value={fmt(cur.months)} from={0} decimals={1} /> <small>{t("insights.week.months_short")}</small></div><Delta cur={fmt(cur.months)} prev={fmt(prev.months)} unit={` ${t("insights.week.months_short")}`} /></div>
          <div className="stat"><div className="muted small">{t("insights.week.goal_met_days")}</div><div className="v"><AnimatedNumber value={cleanThis} from={0} /></div><Delta cur={cleanThis} prev={cleanPrev} good="up" /></div>
          <div className="stat"><div className="muted small">{t("insights.urges.managed")}</div><div className="v"><AnimatedNumber value={rode} from={0} /> <small>{t("insights.urges.of", { n: urgeLog.length })}</small></div></div>
          {money
            ? <div className="stat"><div className="muted small">{t("insights.week.spent")}</div><div className="v"><small>{currency}</small> <AnimatedNumber value={Math.round(cur.spend)} from={0} /></div><Delta cur={Math.round(cur.spend)} prev={Math.round(prev.spend)} /></div>
            : <div className="stat"><div className="muted small">{t("insights.week.days_checked_in")}</div><div className="v"><AnimatedNumber value={inThis} from={0} /></div><Delta cur={inThis} prev={inPrev} good="up" /></div>}
        </div>
        {urgeLog.length > 0 && <p className="small">{rode === urgeLog.length ? t("insights.urges.all") : t("insights.urges.some", { managed: rode, total: urgeLog.length })}</p>}
        <p className="muted small">{t("insights.week.arrows")}</p>
      </section>
        <div className="card stack" aria-label={t("insights.week.summary")}>
          <div className="row"><h3>{t("insights.week.summary")}</h3><span className="muted small">{weekMet === 1 ? t("insights.week.count_one", { n: weekMet }) : t("insights.week.count_other", { n: weekMet })}</span></div>
          <div className="weekstrip" aria-label={t("insights.week.strip_aria")}>
            {strip.map((x) => (
              <div key={x.d} className="wday" data-today={x.d === today()} aria-label={t("insights.week.day_aria", { date: fmtDay(x.d), status: STATUS_LABEL[x.s] })}>
                <span className="muted small">{x.label}</span>
                <i className="mark" data-s={x.s} />
              </div>
            ))}
          </div>
        </div>
        {summary && <section className="card stack" aria-label={t("insights.summary.aria")}>
          <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.spark}<h2>{t("insights.summary.title")}</h2></div>
          <p className="bubble">{summary}</p>
          <p className="muted small">{t("insights.summary.ai_note")}</p>
        </section>}
      </section>

      <section className="stack" aria-label={t("insights.when.title")}>
        <h2>{t("insights.when.title")}</h2>
        <section className="card stack" aria-label={t("insights.when.title")}>
        <div className="row">{risk !== null && <span className="muted small">{t("insights.when.peak", { time: fmtHour(risk) })}</span>}</div>
        {timed < 3 ? <p className="muted">{t("insights.when.empty")}</p> : (
          <div className="heat" role="img" aria-label={t("insights.when.heat_aria") + (risk !== null ? t("insights.when.heat_most", { time: fmtHour(risk) }) : "")}>
            <span />{[0, 4, 8, 12, 16, 20].map((h) => <span key={h} className="heat-h">{fmtHour(h)}</span>)}
            {grid.map((row, d) => [
              <span key={`d${d}`} className="heat-d">{t("insights.when.weekdays").split(" ")[d]}</span>,
              ...row.map((n, b) => <motion.i key={`${d}-${b}`} className="heat-cell" style={{ ["--a" as string]: n / gridMax }} data-n={n}
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.soft, delay: (d * 6 + b) * 0.008 }} title={`${n}`} />),
            ])}
          </div>
        )}
        {risk !== null && <p className="small">{t("insights.when.heads_up", { name: companion.name, time: fmtHour(risk) })}</p>}
      </section>
      </section>

      {money && (
        <section className="stack" aria-label={t("insights.money.title")}>
          <h2>{t("insights.money.title")}</h2>
          <section className="card stack" aria-label={t("insights.money.aria")}>
          <div className="row">{kept && <span className="muted small">{kept.days === 1 ? t("insights.money.over_one", { n: kept.days }) : t("insights.money.over_other", { n: kept.days })}</span>}</div>
          {saved === null
            ? <p className="muted">{baseline ? t("insights.money.needs_slip") : t("insights.money.needs_pace")}</p>
            : <p className="big-money"><small>{currency}</small> <AnimatedNumber value={saved} from={0} /></p>}
          <SavingsGoal habitId={habit.id} saved={saved ?? 0} goal={goal} currency={currency} />
        </section>
        </section>
      )}

      <section className="stack" aria-label={t("insights.patterns.title")}>
        <h2>{t("insights.patterns.title")}</h2>
        {baseline && pace !== null && progress.slips + progress.metDays >= 3 && (
          <section className="card stack">
          <h3>{t("insights.since.title")}</h3>
          <p>{t("insights.since.body", { frequency: BASELINE_LABEL[baseline], n: fmt(recentPerWeek) })}</p>
          <div className="compare" aria-hidden>
            <div><span className="muted small">{t("insights.since.then")}</span><motion.i initial={{ width: 0 }} animate={{ width: "100%" }} transition={spring.calm} /></div>
            <div><span className="muted small">{t("insights.since.now")}</span><motion.i className={`now${recentPerWeek > BASELINE_PER_WEEK[baseline] ? " worse" : ""}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (recentPerWeek / BASELINE_PER_WEEK[baseline]) * 100)}%` }} transition={{ ...spring.calm, delay: 0.2 }} /></div>
          </div>
        </section>
        )}
        <section className="card stack">
        <h3>{t("insights.chart.title")}</h3>
        <svg className="chart" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={t("insights.chart.aria", { list: weeks.join(", ") })}>
          {[0, 1 / 3, 2 / 3, 1].map((g) => <line key={g} x1="0" x2={W} y1={H - g * (H - 12)} y2={H - g * (H - 12)} stroke="var(--line)" />)}
          {weeks.map((v, i) => {
            const h = (v / maxW) * (H - 12);
            return <g key={i}>
              <motion.rect x={i * (bw + gap)} width={bw} rx="6" fill="var(--accent)"
                initial={{ y: H, height: 0 }} animate={{ y: H - h, height: Math.max(h, 0) }} transition={{ ...spring.soft, delay: 0.15 + i * 0.05 }} />
              <text x={i * (bw + gap) + bw / 2} y={H + 14} textAnchor="middle">{i === 7 ? t("insights.chart.now") : `-${7 - i}`}</text>
              {v > 0 && <motion.text x={i * (bw + gap) + bw / 2} y={H - h - 4} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.05 }}>{v}</motion.text>}
            </g>;
          })}
        </svg>
      </section>
        <Observations />
      </section>

      <section className="stack" aria-label={t("insights.review.check_in")}>
        <h2>{t("insights.review.check_in")}</h2>
        <CheckIn />
        <WeeklyReview />
      </section>

      <section className="stack" aria-label={t("insights.forecast.title")}>
        <h2>{t("insights.forecast.title")}</h2>
        <section className="card stack">
        <p>{view.age >= 80 ? t("insights.forecast.already", { name: companion.name }) : frailIn === null ? t("insights.forecast.steady", { name: companion.name }) : Math.max(1, Math.round(frailIn / 7)) === 1 ? t("insights.forecast.pace_one", { name: companion.name }) : t("insights.forecast.pace_other", { name: companion.name, weeks: Math.max(1, Math.round(frailIn / 7)) })}</p>
        <p className="muted small">{t("safety.disclaimer.forecast")}</p>
      </section>
      </section>
    </main>
  );
}
