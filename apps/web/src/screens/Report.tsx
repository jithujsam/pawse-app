import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { projectDaysToAge } from "@detox/engine";
import { aiWeekly } from "../ai";
import { configured, useSession } from "../supabase";
import { ACCENT } from "../Companion";
import { verdict } from "../copy";
import { addDays, daysBetween, fmtDay, parse, today, weekStart } from "../dates";
import { rise, spring, stagger } from "../motion";
import { actions, useActiveView, useData, weekRequestFor, weekStats } from "../store";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Button, Icon } from "../ui/Controls";
import type { Baseline } from "../types";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BASELINE_PER_WEEK: Record<Baseline, number> = { many_daily: 21, daily: 7, few_weekly: 3, weekly: 1 };
const BASELINE_LABEL: Record<Baseline, string> = { many_daily: "several times a day", daily: "about once a day", few_weekly: "a few times a week", weekly: "once a week or less" };

function Delta({ cur, prev, unit = "" }: { cur: number; prev: number; unit?: string }) {
  if (cur === prev) return <span className="delta flat">same as last week</span>;
  const down = cur < prev;
  return <span className={`delta ${down ? "good" : "bad"}`}>{down ? "↓" : "↑"} {Math.abs(Math.round((cur - prev) * 10) / 10)}{unit} vs last week</span>;
}

export function Report() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const { tone, currency, baseline } = data.settings;
  const ws = weekStart(today());
  const cur = weekStats(data, habit.id, ws);
  const prev = weekStats(data, habit.id, addDays(ws, -7));
  const weeks = Array.from({ length: 8 }, (_, i) => weekStats(data, habit.id, addDays(ws, -7 * (7 - i))).slips);
  const maxW = Math.max(1, ...weeks);
  const all = data.entries.filter((e) => e.habitId === habit.id);
  const byDow = DOW.map((_, i) => all.filter((e) => parse(e.day).getDay() === i).length);
  const worst = byDow.indexOf(Math.max(...byDow));
  const biggest = all.reduce<typeof all[number] | null>((b, e) => (!b || e.months > b.months ? e : b), null);
  const places = new Map<string, number>();
  for (const e of all) for (const f of habit.fields) if (f.type === "text" && /where|app/i.test(f.label)) {
    const v = String(e.values[f.id] ?? "").trim().toLowerCase(); if (v) places.set(v, (places.get(v) ?? 0) + 1);
  }
  const topPlace = [...places.entries()].sort((a, b) => b[1] - a[1])[0];
  const frailIn = view.age >= 80 ? 0 : projectDaysToAge(view.states, 80);
  const money = habit.unit === "money";
  const fmt = (n: number) => Math.round(n * 10) / 10;

  const tracked = Math.max(1, Math.min(14, daysBetween(companion.bornOn, today()) + 1));
  const recentPerWeek = (all.filter((e) => e.day > addDays(today(), -tracked)).length / tracked) * 7;

  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const summary = data.summaries[ws];
  async function write() {
    const req = weekRequestFor(habit.id, ws, all.length >= 3 ? DOW[worst] : null);
    if (!req) return;
    setBusy(true); setFailed(false);
    const text = await aiWeekly(req);
    setBusy(false);
    if (text) actions.setSummary(ws, text); else setFailed(true);
  }

  const W = 320, H = 130, bw = 26, gap = (W - bw * 8) / 7;

  return (
    <motion.main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }} variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>Weekly report</motion.h1>
      <motion.section className="card stack" variants={rise}>
        <h2>This week and last</h2>
        <p>{verdict(tone, cur.slips, prev.slips)}</p>
        <div className="stats">
          <div className="stat"><div className="muted small">Slips</div><div className="v"><AnimatedNumber value={cur.slips} from={0} /></div><Delta cur={cur.slips} prev={prev.slips} /></div>
          <div className="stat"><div className="muted small">Life lost</div><div className="v"><AnimatedNumber value={fmt(cur.months)} from={0} decimals={1} /> <small>mo</small></div><Delta cur={fmt(cur.months)} prev={fmt(prev.months)} unit=" mo" /></div>
          {money && <div className="stat wide"><div className="muted small">Spent</div><div className="v">{currency} <AnimatedNumber value={Math.round(cur.spend)} from={0} /></div><Delta cur={Math.round(cur.spend)} prev={Math.round(prev.spend)} /></div>}
        </div>
      </motion.section>

      {baseline && all.length + data.cleanDays.length >= 3 && (
        <motion.section className="card stack" variants={rise}>
          <h2>Since you started</h2>
          <p>You said it was <b>{BASELINE_LABEL[baseline]}</b>. Lately it's about <b>{fmt(recentPerWeek)}</b> a week.</p>
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
              <motion.p key="empty" className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{session ? "A short, honest read of your week, written for you." : "Create an account in You to get a short written read of your week."}</motion.p>
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

      <motion.section className="card stack" variants={rise}>
        <h2>Patterns</h2>
        {all.length < 3 ? <p className="muted">Patterns show up after a few logged slips.</p> : (
          <motion.div className="list" variants={stagger} initial="hidden" animate="show">
            <motion.div className="item" variants={rise}><span className="muted small">Worst weekday</span><b>{DOW[worst]}</b><span className="small">{byDow[worst]} of {all.length} slips</span></motion.div>
            {topPlace && <motion.div className="item" variants={rise}><span className="muted small">Most repeated</span><b style={{ textTransform: "capitalize" }}>{topPlace[0]}</b><span className="small">{topPlace[1]} times</span></motion.div>}
            {biggest && <motion.div className="item" variants={rise}><span className="muted small">Biggest single slip</span><b>{fmt(biggest.months)} months</b><span className="small">{fmtDay(biggest.day)}{biggest.amount !== null && money ? `, ${currency} ${biggest.amount}` : ""}</span></motion.div>}
          </motion.div>
        )}
      </motion.section>

      <motion.section className="card stack" variants={rise}>
        <h2>If nothing changes</h2>
        <p>{view.age >= 80 ? `${companion.name} is already frail.` : frailIn === null ? `At the current pace ${companion.name} is not getting older.` : `At this pace, ${companion.name} reaches the frail stage in about ${Math.max(1, Math.round(frailIn / 7))} ${Math.round(frailIn / 7) <= 1 ? "week" : "weeks"}.`}</p>
        <p className="muted small">An estimate from the last two weeks. Age is illustrative, not a health prediction.</p>
      </motion.section>
    </motion.main>
  );
}
