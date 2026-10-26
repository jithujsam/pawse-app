import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { projectDaysToAge } from "@detox/engine";
import { aiWeekly } from "../ai";
import { configured, useSession } from "../supabase";
import { ACCENT } from "../Companion";
import { verdict } from "../copy";
import { checkIns, countDays, trackIndex, trackSummary, weekdayOf } from "../progress";
import { addDays, fmtHour, today, weekStart } from "../dates";
import { rise, spring, stagger } from "../motion";
import { actions, BASELINE_PER_WEEK, moneyKept, recentPace, riskyHour, slipHour, useActiveView, useData, weekRequestFor, weekStats } from "../store";
import { needsTrackContext, trackState } from "../tracks";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Button, Icon, plainOpts, SelectOther, TrackContext } from "../ui/Controls";
import { CheckIn, Observations } from "./WeeklyReview";
import type { Baseline } from "../types";

/** Common things to save for. Anything else can be typed. */
const SAVING_FOR = ["An emergency fund", "A trip", "Something for my home", "A gift for someone", "Paying off a debt", "Something I've wanted for a while", "My future"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BASELINE_LABEL: Record<Baseline, string> = { many_daily: "several times a day", daily: "about once a day", few_weekly: "a few times a week", weekly: "once a week or less" };


function SavingsGoal({ habitId, saved, goal, currency }: { habitId: string; saved: number; goal: { label: string; target: number } | null; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(goal?.label ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target) : "");
  if (editing) return (
    <div className="stack tight">
      <div className="field"><span className="field-label">Saving toward</span>
        <SelectOther label="Saving toward" value={label} onChange={setLabel} options={plainOpts(SAVING_FOR)} maxLength={40} placeholder="Choose what it's for" otherPlaceholder="e.g. New headphones" /></div>
      <label className="field"><span className="field-label">It costs</span><input className="input" inputMode="decimal" type="number" min="1" placeholder="5000" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
      <div className="actions">
        <Button disabled={!label.trim() || !(Number(target) > 0)} onClick={() => { actions.setTrackSettings(habitId, { savingsGoal: { label: label.trim(), target: Math.round(Number(target)) } }); setEditing(false); }}>Save goal</Button>
        <Button variant="secondary" onClick={() => { if (goal) actions.setTrackSettings(habitId, { savingsGoal: null }); setEditing(false); }}>{goal ? "Remove" : "Cancel"}</Button>
      </div>
    </div>
  );
  if (!goal) return <Button variant="secondary" onClick={() => setEditing(true)}>Set something to save for</Button>;
  const pct = Math.min(100, (saved / goal.target) * 100);
  return (
    <div className="stack tight">
      <div className="row"><b>{goal.label}</b><span className="muted small">{currency} {Math.min(saved, goal.target).toLocaleString()} of {goal.target.toLocaleString()}</span></div>
      <div className="progress goal" aria-hidden><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={spring.calm} /></div>
      <div className="row"><span className="small">{pct >= 100 ? "You've kept enough. Treat yourself, guilt-free." : `${Math.round(pct)}% there.`}</span><Button variant="text" onClick={() => setEditing(true)}>Edit</Button></div>
    </div>
  );
}

function Delta({ cur, prev, unit = "", good = "down" }: { cur: number; prev: number; unit?: string; good?: "up" | "down" }) {
  if (cur === prev) return <span className="delta flat">No change</span>;
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
  const byDow = DOW.map((_, i) => all.filter((e) => weekdayOf(e.day) === i).length);
  const worst = byDow.indexOf(Math.max(...byDow));
  const frailIn = view.age >= 80 ? 0 : projectDaysToAge(view.states, 80);
  const money = habit.unit === "money";
  const fmt = (n: number) => Math.round(n * 10) / 10;

  // Pace over checked-in days only, so quiet days aren't read as clean ones.
  const pace = recentPace(data, habit.id, companion.bornOn);
  const recentPerWeek = pace ?? 0;

  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const summary = data.summaries[habit.id]?.[ws];
  async function write() {
    const req = weekRequestFor(habit.id, ws, all.length >= 3 ? DOW[worst] : null);
    if (!req) return;
    setBusy(true); setFailed(false);
    const text = await aiWeekly(req);
    setBusy(false);
    if (text) actions.setSummary(ws, text, habit.id); else setFailed(true);
  }

  // Write the week's summary on its own once there's something to say; at most every six hours.
  useEffect(() => {
    if (!session || summary || busy || cur.slips + prev.slips === 0) return;
    const k = `companion/auto-summary/${ws}`;
    try { if (Date.now() - Number(localStorage.getItem(k) ?? 0) < 6 * 3600_000) return; localStorage.setItem(k, String(Date.now())); } catch { return; }
    void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ws]);

  const W = 320, H = 130, bw = 26, gap = (W - bw * 8) / 7;

  // Urges: noticing and riding them out is the skill that predicts lasting change.
  const urgeLog = data.urges.filter((u) => u.habitId === habit.id);
  const urgesWeek = urgeLog.filter((u) => u.day >= ws);
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

  return (
    <motion.main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }} variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>Insights</motion.h1>
      {needsTrackContext(data, habit.id) && <motion.div variants={rise}><TrackContext name={habit.name} pet={companion.name} paused={trackState(data, habit.id).status === "paused"} /></motion.div>}
      <CheckIn />
      <motion.section className="card stack" variants={rise}>
        <h2>This week and last</h2>
        <p>{verdict(tone, cur.slips, prev.slips)}</p>
        <div className="stats">
          <div className="stat"><div className="muted small">Slips</div><div className="v"><AnimatedNumber value={cur.slips} from={0} /></div><Delta cur={cur.slips} prev={prev.slips} /></div>
          <div className="stat"><div className="muted small">Life lost</div><div className="v"><AnimatedNumber value={fmt(cur.months)} from={0} decimals={1} /> <small>mo</small></div><Delta cur={fmt(cur.months)} prev={fmt(prev.months)} unit=" mo" /></div>
          <div className="stat"><div className="muted small">Goal-met days</div><div className="v"><AnimatedNumber value={cleanThis} from={0} /></div><Delta cur={cleanThis} prev={cleanPrev} good="up" /></div>
          {money
            ? <div className="stat"><div className="muted small">Spent</div><div className="v"><small>{currency}</small> <AnimatedNumber value={Math.round(cur.spend)} from={0} /></div><Delta cur={Math.round(cur.spend)} prev={Math.round(prev.spend)} /></div>
            : <div className="stat"><div className="muted small">Days checked in</div><div className="v"><AnimatedNumber value={inThis} from={0} /></div><Delta cur={inThis} prev={inPrev} good="up" /></div>}
        </div>
        <p className="muted small">Arrows compare with last week.</p>
      </motion.section>

      <motion.section className="card stack" aria-label="Urges" variants={rise}>
        <div className="row"><h2>Urges managed</h2><span className="muted small">{urgesWeek.length} this week</span></div>
        {urgeLog.length === 0
          ? <p className="muted">When an urge hits, tap + and choose “Having an urge”. Getting through urges is a skill, and it grows with practice.</p>
          : <>
              <div className="stats">
                <div className="stat item"><span className="muted small">Managed</span><b className="v"><AnimatedNumber value={rode} from={0} /></b></div>
                <div className="stat item"><span className="muted small">Noticed</span><b className="v"><AnimatedNumber value={urgeLog.length} from={0} /></b></div>
              </div>
              <p className="small">{rode === urgeLog.length ? "Every urge you've logged, you've managed." : `${rode} of ${urgeLog.length} managed. The others are still useful: each one shows you more about when urges come.`}</p>
            </>}
      </motion.section>

      {money && (
        <motion.section className="card stack" aria-label="Money" variants={rise}>
          <div className="row"><h2>Money kept</h2>{kept && <span className="muted small">vs your old pace, over {kept.days} checked-in {kept.days === 1 ? "day" : "days"}</span>}</div>
          {saved === null
            ? <p className="muted">{baseline ? "Log a slip with an amount and this shows what you're keeping compared with before." : "This needs your starting pace, set during setup."}</p>
            : <p className="big-money"><small>{currency}</small> <AnimatedNumber value={saved} from={0} /></p>}
          <SavingsGoal habitId={habit.id} saved={saved ?? 0} goal={goal} currency={currency} />
        </motion.section>
      )}

      <motion.section className="card stack" aria-label="When it happens" variants={rise}>
        <div className="row"><h2>When it happens</h2>{risk !== null && <span className="muted small">Peak around {fmtHour(risk)}</span>}</div>
        {timed < 3 ? <p className="muted">A map of your risky hours appears after a few slips.</p> : (
          <div className="heat" role="img" aria-label={`Slips by weekday and time of day. ${risk !== null ? `Most often around ${fmtHour(risk)}.` : ""}`}>
            <span />{[0, 4, 8, 12, 16, 20].map((h) => <span key={h} className="heat-h">{fmtHour(h)}</span>)}
            {grid.map((row, d) => [
              <span key={`d${d}`} className="heat-d">{["M", "T", "W", "T", "F", "S", "S"][d]}</span>,
              ...row.map((n, b) => <motion.i key={`${d}-${b}`} className="heat-cell" style={{ ["--a" as string]: n / gridMax }} data-n={n}
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.soft, delay: (d * 6 + b) * 0.008 }} title={`${n}`} />),
            ])}
          </div>
        )}
        {risk !== null && <p className="small">{companion.name} will send a heads-up half an hour before {fmtHour(risk)}, if reminders are on.</p>}
      </motion.section>

      {baseline && pace !== null && progress.slips + progress.metDays >= 3 && (
        <motion.section className="card stack" variants={rise}>
          <h2>Since you started</h2>
          <p>You said it was <b>{BASELINE_LABEL[baseline]}</b>. On the days you checked in lately, it's about <b>{fmt(recentPerWeek)}</b> a week.</p>
          <div className="compare" aria-hidden>
            <div><span className="muted small">Then</span><motion.i initial={{ width: 0 }} animate={{ width: "100%" }} transition={spring.calm} /></div>
            <div><span className="muted small">Now</span><motion.i className={`now${recentPerWeek > BASELINE_PER_WEEK[baseline] ? " worse" : ""}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (recentPerWeek / BASELINE_PER_WEEK[baseline]) * 100)}%` }} transition={{ ...spring.calm, delay: 0.2 }} /></div>
          </div>
        </motion.section>
      )}

      {configured && (
        <motion.section className="card stack" aria-label="Written summary" variants={rise}>
          <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.spark}<h2>In words</h2></div>
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div key="busy" className="stack tight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="shimmer-line" /><div className="shimmer-line" /><div className="shimmer-line short" />
              </motion.div>
            ) : summary ? (
              <motion.p key={summary} className="bubble" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{summary}</motion.p>
            ) : (
              <motion.p key="empty" className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{session ? "A short, honest read of your week, written for you." : "Sign in from Me to get a short written read of your week."}</motion.p>
            )}
          </AnimatePresence>
          {failed && <p className="err" role="alert">Couldn't write it just now. Your numbers above are unaffected. Try again later.</p>}
          {session && <Button variant="secondary" disabled={busy || cur.slips + prev.slips === 0} onClick={write}>{busy ? "Writing…" : summary ? "Write it again" : "Write my summary"}</Button>}
        </motion.section>
      )}

      <motion.section className="card stack" variants={rise}>
        <h2>Slips per week, last 8 weeks</h2>
        <svg className="chart" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={`Slips per week: ${weeks.join(", ")}`}>
          {[0, 0.5, 1].map((t) => <line key={t} x1="0" x2={W} y1={H - t * (H - 12)} y2={H - t * (H - 12)} stroke="var(--raised)" strokeDasharray="3 4" />)}
          {weeks.map((v, i) => {
            const h = (v / maxW) * (H - 12);
            return <g key={i}>
              <motion.rect x={i * (bw + gap)} width={bw} rx="6" fill={i === 7 ? "var(--chart)" : "var(--control)"}
                initial={{ y: H, height: 0 }} animate={{ y: H - h, height: Math.max(h, 0) }} transition={{ ...spring.soft, delay: 0.15 + i * 0.05 }} />
              <text x={i * (bw + gap) + bw / 2} y={H + 14} textAnchor="middle">{i === 7 ? "now" : `-${7 - i}`}</text>
              {v > 0 && <motion.text x={i * (bw + gap) + bw / 2} y={H - h - 4} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.05 }}>{v}</motion.text>}
            </g>;
          })}
        </svg>
      </motion.section>

      <Observations />

      <motion.section className="card stack" variants={rise}>
        <h2>If nothing changes</h2>
        <p>{view.age >= 80 ? `${companion.name} is already frail.` : frailIn === null ? `At the current pace ${companion.name} is not getting older.` : `At this pace, ${companion.name} reaches the frail stage in about ${Math.max(1, Math.round(frailIn / 7))} ${Math.round(frailIn / 7) <= 1 ? "week" : "weeks"}.`}</p>
        <p className="muted small">An estimate from the last two weeks. Age is illustrative, not a health prediction.</p>
      </motion.section>
    </motion.main>
  );
}
