import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STAGE_LABEL } from "@detox/engine";
import { ACCENT, LiveCompanion, moodFor } from "../Companion";
import { cleanLine, cleanToast, dyingBanner, greeting, MILESTONES, milestoneLine, statusLine, waitingLine } from "../copy";
import { addDays, fmtDay, parse, today, weekStart } from "../dates";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { actions, cleanStreak, useActiveView, useData, weekStats, type Deduction } from "../store";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Burst, Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { Coach } from "../ui/Coach";
import { LogSheet } from "./LogSheet";
import { openDownload, useUpdate } from "../update";

export function Home({ onNavigate }: { onNavigate: (t: "report") => void }) {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const { tone, currency } = data.settings;
  const [sheet, setSheet] = useState(false);
  const [just, setJust] = useState<"slip" | "clean" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sparks, setSparks] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const update = useUpdate();

  useEffect(() => { if (!just) return; const t = setTimeout(() => setJust(null), 3500); return () => clearTimeout(t); }, [just]);

  const t0 = today();
  const slippedToday = data.entries.some((e) => e.habitId === habit.id && e.day === t0);
  const cleanToday = data.cleanDays.some((c) => c.habitId === habit.id && c.day === t0);
  const checked = slippedToday || cleanToday;
  const mood = moodFor(view.stage, { checkedToday: checked, slippedToday, justLogged: just, age: view.age });
  const week = weekStats(data, habit.id, weekStart(t0));
  const streak = cleanStreak(data, habit.id);
  const weekClean = data.cleanDays.filter((c) => c.habitId === habit.id && c.day >= weekStart(t0) && c.day <= t0).length;
  const age = view.age;
  const danger = age >= 80;
  const line = note ?? (just === "clean" ? cleanLine(tone, companion.name, streak) : !checked ? waitingLine(tone, companion.name) : statusLine(tone, companion.name, view.stage));

  function clean() {
    if (cleanToday) return;
    if (!actions.markClean(habit.id)) { haptic.warn(); setNote("You already logged a slip today, so today can't be marked clean."); return; }
    haptic.success();
    setJust("clean"); setNote(null); setSparks((s) => s + 1);
    const s = cleanStreak({ ...data, cleanDays: [...data.cleanDays, { habitId: habit.id, day: t0 }] }, habit.id);
    const hit = MILESTONES.find((m) => m === s && !data.settings.celebrated.includes(m));
    if (hit) { setTimeout(() => setMilestone(hit), 900); actions.celebrate(hit); }
    else toast(cleanToast(tone, companion.name), { kind: "good", action: { label: "Undo", run: () => actions.unmarkClean(habit.id, t0) } });
  }
  function saved(_d: Deduction) { setJust("slip"); setNote(null); haptic.heavy(); }

  const ws = weekStart(t0);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const s = d > t0 ? "future" : data.entries.some((e) => e.habitId === habit.id && e.day === d) ? "slip" : data.cleanDays.some((c) => c.habitId === habit.id && c.day === d) ? "clean" : "none";
    return { d, s, label: parse(d).toLocaleDateString(undefined, { weekday: "narrow" }) };
  });

  return (
    <motion.main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }} variants={stagger} initial="hidden" animate="show">
      <AnimatePresence>
        {update && (
          <motion.button className="update-banner" onClick={() => { haptic.tap(); openDownload(update.url); }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
            <span><b>Update available</b><span className="small">Version {update.name}{update.notes ? ` · ${update.notes}` : ""}</span></span>
            <span className="update-cta">Get it</span>
          </motion.button>
        )}
      </AnimatePresence>
      <motion.header className="greet" variants={rise}>
        <div>
          <p className="muted small">{fmtDay(t0)}</p>
          <h1>{greeting(tone, new Date().getHours())}</h1>
        </div>
        {streak > 0 && <motion.div className="streak-chip" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy} key={streak}>
          <span aria-hidden>●</span> <AnimatedNumber value={streak} /> {streak === 1 ? "day" : "days"}
        </motion.div>}
      </motion.header>

      <motion.section className={`hero${danger ? " hero-danger" : ""}`} aria-label={`${companion.name}, age ${Math.round(age)}`} variants={rise}>
        <div className="motes" aria-hidden><i /><i /><i /><i /></div>
        <Burst burst={sparks} kind="spark" count={10} />
        <AnimatePresence>{just === "slip" && <motion.div className="ripple" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: [0, 0.14, 0] }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }} />}</AnimatePresence>
        <div className="hero-name"><h2>{companion.name}</h2><span className="stage-tag">{STAGE_LABEL[view.stage]}</span></div>
        <LiveCompanion species={companion.species} stage={view.stage} mood={mood} age={age} size={200} />
        <AnimatePresence mode="wait">
          <motion.p key={line} className="speech" aria-live="polite"
            initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={spring.soft}>
            {line}
          </motion.p>
        </AnimatePresence>
        <div className="agetext"><span>Age <b><AnimatedNumber value={Math.round(age)} /></b></span><span className="muted">Life left <AnimatedNumber value={100 - Math.round(age)} /></span></div>
        <div className={`agebar${danger ? " danger" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(age)} aria-label="Visible age">
          <motion.i initial={false} animate={{ width: `${Math.max(1.5, age)}%` }} transition={spring.calm} />
        </div>
      </motion.section>

      {age >= 90 && <motion.div className="banner danger" role="alert" variants={rise}>{dyingBanner(companion.name, age)}</motion.div>}

      <motion.section className="checkin" aria-label="Today's check-in" variants={rise}>
        <div className="row"><h2>Today</h2><span className="muted small">{checked ? (cleanToday ? "Checked in" : "Logged") : "Not checked in yet"}</span></div>
        <div className="actions">
          <Button variant="secondary" className="slip-btn" onClick={() => setSheet(true)}>I slipped</Button>
          <motion.button className="btn clean-btn" data-done={cleanToday} onClick={clean} aria-pressed={cleanToday} disabled={slippedToday}
            whileTap={cleanToday || slippedToday ? undefined : { scale: 0.95 }} transition={spring.snappy} layout>
            <AnimatePresence mode="wait" initial={false}>
              {cleanToday
                ? <motion.span key="done" className="btn-inner" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy}>{Icon.check} Clean today</motion.span>
                : <motion.span key="todo" className="btn-inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}>Clean today</motion.span>}
            </AnimatePresence>
          </motion.button>
        </div>
        <div className="weekstrip" aria-label="This week">
          {strip.map((x) => (
            <div key={x.d} className="wday" data-s={x.s} data-today={x.d === t0} aria-label={`${fmtDay(x.d)}: ${x.s}`}>
              <span className="muted small">{x.label}</span>
              <motion.i layout initial={false} animate={{ scale: x.s === "none" || x.s === "future" ? 0.7 : 1 }} transition={spring.bouncy} />
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section className="stats" aria-label="This week" variants={rise}>
        <div className="card stat"><div className="muted small">Slips this week</div><div className="v"><AnimatedNumber value={week.slips} /></div></div>
        <div className="card stat"><div className="muted small">Life lost this week</div><div className="v"><AnimatedNumber value={week.months} decimals={1} /> <small>mo</small></div></div>
        {habit.unit === "money"
          ? <div className="card stat"><div className="muted small">Spent this week</div><div className="v"><small>{currency}</small> <AnimatedNumber value={Math.round(week.spend)} /></div></div>
          : <div className="card stat"><div className="muted small">Clean days this week</div><div className="v"><AnimatedNumber value={weekClean} /></div></div>}
        <button className="card stat link-card" onClick={() => onNavigate("report")}>
          <span className="muted small">Your week, in words</span>
          <span className="link-row"><b>Report</b>{Icon.chevR}</span>
        </button>
      </motion.section>

      <LogSheet open={sheet} habit={habit} name={companion.name} age={age} onClose={() => setSheet(false)} onSaved={saved} />
      <Milestone days={milestone} name={companion.name} onClose={() => setMilestone(null)} view={view} />
      {!data.settings.coachSeen && !sheet && <Coach name={companion.name} onDone={() => actions.setSettings({ coachSeen: true })} />}
    </motion.main>
  );
}

function Milestone({ days, name, onClose, view }: { days: number | null; name: string; onClose: () => void; view: NonNullable<ReturnType<typeof useActiveView>> }) {
  const tone = useData().settings.tone;
  useEffect(() => { if (days) haptic.success(); }, [days]);
  return (
    <AnimatePresence>
      {days && (
        <motion.div className="scrim center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="celebrate" role="dialog" aria-modal="true" aria-label="Milestone" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.7, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={spring.bouncy}>
            <Burst burst={days} kind="spark" count={14} />
            <motion.div className="big-num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: 0.15 }}>{days}</motion.div>
            <LiveCompanion species={view.companion.species} stage={view.stage} mood="happy" age={view.age} size={170} interactive={false} />
            <h2>{milestoneLine(tone, name, days).title}</h2>
            <p className="muted">{milestoneLine(tone, name, days).body}</p>
            <Button onClick={onClose}>Keep going</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
