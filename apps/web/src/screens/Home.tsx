import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STAGE_LABEL } from "@detox/engine";
import { ACCENT, LiveCompanion, moodFor, type Gesture, type Reaction } from "../Companion";
import { cleanLine, cleanToast, dyingBanner, greeting, MILESTONES, milestoneLine, statusLine, waitingLine } from "../copy";
import { addDays, fmtDay, parse, today, weekStart } from "../dates";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { scheduleCare, scheduleRisk } from "../notify";
import { actions, cleanStreak, recoveryPlan, riskyHour, treatsLeft, useActiveView, useData, weekStats, type Deduction } from "../store";
import { useTalkBack } from "../talk";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Burst, Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { Coach } from "../ui/Coach";
import { recoveryLine, say } from "../voice";
import { LogSheet } from "./LogSheet";
import { UrgeSheet } from "./UrgeSheet";
import { openDownload, useUpdate } from "../update";
import { onQuick, takeQuick } from "../quick";
import { ACCESSORIES } from "../pets";

export function Home({ onNavigate }: { onNavigate: (t: "insights") => void }) {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const { tone, currency } = data.settings;
  const personality = companion.personality;
  const [sheet, setSheet] = useState(false);
  const [urge, setUrge] = useState(false);
  const [just, setJust] = useState<"slip" | "clean" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sparks, setSparks] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [act, setAct] = useState<Gesture>("none");
  const actTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const talk = useTalkBack();
  const update = useUpdate();

  // The centre button hands its choice to Home, which owns the sheet and the celebration.
  const quickRef = useRef<(a: ReturnType<typeof takeQuick>) => void>(() => undefined);
  quickRef.current = (a) => { if (a === "slip") setSheet(true); else if (a === "clean") clean(); else if (a === "urge") setUrge(true); };
  useEffect(() => { const run = () => quickRef.current(takeQuick()); run(); return onQuick(run); }, []);

  useEffect(() => { if (!just) return; const t = setTimeout(() => setJust(null), 3500); return () => clearTimeout(t); }, [just]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 6000); return () => clearTimeout(t); }, [note]);

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
  const treats = treatsLeft(data, habit.id);
  const fedToday = data.settings.fedOn === t0;
  const plan = recoveryPlan(view);
  const showPlan = plan && (slippedToday || plan.stageBack !== null);
  const line = note ?? (just === "clean" ? cleanLine(tone, companion.name, streak)
    : slippedToday && !just ? say("strike", personality, tone)
      : !checked ? waitingLine(tone, companion.name) : statusLine(tone, companion.name, view.stage));
  const gesture: Gesture = talk.state === "talking" ? "talk" : talk.state === "listening" ? "perk" : act;

  // Keep the risky-hour heads-up in step with the person's actual pattern.
  const risk = riskyHour(data, habit.id);
  useEffect(() => { void scheduleRisk(risk, { tone, personality, name: companion.name, enabled: data.settings.riskNudge && data.settings.remindersOn }); },
    [risk, tone, personality, companion.name, data.settings.riskNudge, data.settings.remindersOn]);

  const perform = (g: Gesture, ms: number) => { clearTimeout(actTimer.current); setAct(g); actTimer.current = setTimeout(() => setAct("none"), ms); };
  const careOpts = () => ({ tone, personality, name: companion.name, enabled: data.settings.careNotes && data.settings.remindersOn });

  function clean() {
    if (cleanToday) return;
    if (!actions.markClean(habit.id)) { haptic.warn(); setNote("You already logged a slip today, so today can't be marked clean."); return; }
    haptic.success();
    setJust("clean"); setSparks((s) => s + 1);
    setNote(say("cleanThanks", personality, tone));
    void scheduleCare("clean", careOpts());
    const s = cleanStreak({ ...data, cleanDays: [...data.cleanDays, { habitId: habit.id, day: t0 }] }, habit.id);
    const hit = MILESTONES.find((m) => m === s && !data.settings.celebrated.includes(m));
    if (hit) { setTimeout(() => setMilestone(hit), 900); actions.celebrate(hit); }
    else toast(cleanToast(tone, companion.name), { kind: "good", action: { label: "Undo", run: () => actions.unmarkClean(habit.id, t0) } });
  }
  function saved(d: Deduction) {
    setJust("slip"); haptic.heavy();
    setNote(d.binge ? say("binge", personality, tone) : d.absorbed >= d.entry.months - 0.01 ? say("shrug", personality, tone, d.streakBefore) : say("slip", personality, tone));
    void scheduleCare("slip", careOpts());
  }
  function feed() {
    const r = actions.feed(habit.id);
    if (r === "strike") { haptic.warn(); perform("refuse", 2200); setNote(say("strike", personality, tone)); return; }
    if (r === "full") { haptic.tap(); perform("tilt", 1400); setNote(say("full", personality, tone)); return; }
    haptic.success(); perform("eat", 2000); setNote(say("fed", personality, tone));
  }
  function treat() {
    const r = actions.giveTreat(habit.id);
    if (r === "strike") { haptic.warn(); perform("refuse", 2200); setNote(say("strike", personality, tone)); return; }
    if (r === "empty") { haptic.tap(); perform("side", 1600); setNote(say("noTreats", personality, tone)); return; }
    haptic.success(); perform("treat", 1400); setSparks((s) => s + 1); setNote(say("treat", personality, tone));
  }
  const react = (r: Reaction) => setNote(say(r, personality, tone));

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
        <Burst burst={sparks} kind="spark" count={10} />
        <AnimatePresence>{just === "slip" && <motion.div className="ripple" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: [0, 0.14, 0] }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }} />}</AnimatePresence>
        <div className="hero-name"><h2>{companion.name}</h2><span className="stage-tag">{STAGE_LABEL[view.stage]}</span></div>
        <div className="pet-stage-live">
          <LiveCompanion species={companion.species} coat={companion.coat} personality={personality} accessory={data.settings.wear}
            stage={view.stage} mood={mood} age={age} size={196} gesture={gesture} onReact={react} />
          <Bowl state={act === "eat" ? "eating" : slippedToday ? "untouched" : fedToday ? "empty" : "ready"} />
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={line} className="speech" aria-live="polite"
            initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={spring.soft}>
            {line}
          </motion.p>
        </AnimatePresence>
        <div className="care-row" role="group" aria-label="Care">
          <motion.button className="care-btn" onClick={feed} whileTap={{ scale: 0.9 }} transition={spring.snappy} data-state={slippedToday ? "strike" : fedToday ? "done" : "ready"}>
            <span className="care-ico" aria-hidden>{CareIcon.bowl}</span><span className="small">{slippedToday ? "Not eating" : fedToday ? "Fed" : "Feed"}</span>
          </motion.button>
          <motion.button className="care-btn" onClick={treat} whileTap={{ scale: 0.9 }} transition={spring.snappy} aria-label={`Give a treat, ${treats} left`}>
            <span className="care-ico" aria-hidden>{CareIcon.treat}{treats > 0 && <i className="care-badge">{treats > 99 ? "99+" : treats}</i>}</span><span className="small">Treat</span>
          </motion.button>
          {talk.supported && (
            <motion.button className="care-btn" data-state={talk.state} whileTap={{ scale: 0.9 }} transition={spring.snappy}
              aria-label="Hold to talk. Your companion repeats it."
              onPointerDown={(e) => { e.preventDefault(); haptic.tap(); void talk.start(); }} onPointerUp={talk.stop} onPointerLeave={talk.stop} onContextMenu={(e) => e.preventDefault()}>
              <span className="care-ico" aria-hidden>{CareIcon.mic}</span><span className="small">{talk.state === "listening" ? "Listening…" : talk.state === "denied" ? "Mic off" : "Hold to talk"}</span>
            </motion.button>
          )}
        </div>
        <div className="agetext"><span>Age <b><AnimatedNumber value={Math.round(age)} /></b></span><span className="muted">Life left <AnimatedNumber value={100 - Math.round(age)} /></span></div>
        <div className={`agebar${danger ? " danger" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(age)} aria-label="Visible age">
          <motion.i initial={false} animate={{ width: `${Math.max(1.5, age)}%` }} transition={spring.calm} />
          {plan && plan.lifeExpectancy < 100 && <span className="agebar-cap" style={{ left: `${plan.lifeExpectancy}%` }} aria-hidden />}
        </div>
      </motion.section>

      {age >= 90 && <motion.div className="banner danger" role="alert" variants={rise}>{dyingBanner(companion.name, age)}</motion.div>}

      <AnimatePresence initial={false}>
        {showPlan && plan && (
          <motion.section key="plan" className="card stack plan" aria-label="The way back" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
            <div className="row"><h2>The way back</h2>{plan.lifeExpectancy < 100 && <span className="muted small">Life expectancy {plan.lifeExpectancy}</span>}</div>
            <p>{recoveryLine(tone, companion.name, plan.undoToday, plan.stageBack)}</p>
            {plan.stageBack && <div className="progress" aria-hidden><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.min(100, (streak / plan.stageBack.days) * 100))}%` }} transition={spring.calm} /></div>}
          </motion.section>
        )}
      </AnimatePresence>

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
        <button className="card stat link-card" onClick={() => onNavigate("insights")}>
          <span className="muted small">Your patterns, in words</span>
          <span className="link-row"><b>Insights</b>{Icon.chevR}</span>
        </button>
      </motion.section>

      <UrgeSheet open={urge} onClose={() => setUrge(false)} onSlipped={() => { setUrge(false); setTimeout(() => setSheet(true), 350); }} />
      <LogSheet open={sheet} habit={habit} name={companion.name} age={age} onClose={() => setSheet(false)} onSaved={saved} />
      <Milestone days={milestone} name={companion.name} onClose={() => setMilestone(null)} view={view} />
      {!data.settings.coachSeen && !sheet && !urge && <Coach name={companion.name} onDone={() => actions.setSettings({ coachSeen: true })} />}
    </motion.main>
  );
}

const CareIcon = {
  bowl: <svg viewBox="0 0 24 24" className="ico"><path d="M3 12h18a9 6 0 0 1-18 0z" /><path d="M8 9c0-2 2-2 2-4M13 9c0-2 2-2 2-4" /></svg>,
  treat: <svg viewBox="0 0 24 24" className="ico"><path d="M7 8a3 3 0 1 1 3-3h4a3 3 0 1 1 3 3v8a3 3 0 1 1-3 3h-4a3 3 0 1 1-3-3z" /></svg>,
  mic: <svg viewBox="0 0 24 24" className="ico"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
};

/** The food bowl beside the companion. After a slip, food sits untouched. */
function Bowl({ state }: { state: "ready" | "eating" | "empty" | "untouched" }) {
  const full = state === "ready" || state === "untouched";
  return (
    <svg className={`bowl bowl-${state}`} viewBox="0 0 60 34" width="54" height="31" aria-hidden>
      {(full || state === "eating") && (
        <g className="kibble">
          {[[18, 12], [26, 9], [34, 11], [42, 13], [22, 15], [30, 14], [38, 15]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" fill={i % 2 ? "#b8743a" : "#a0612b"} />)}
        </g>
      )}
      <path d="M6 15h48l-5 15a3 3 0 0 1-3 2H14a3 3 0 0 1-3-2z" fill="var(--accent)" />
      <path d="M6 15h48" stroke="color-mix(in srgb, var(--accent) 60%, #000)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Milestone({ days, name, onClose, view }: { days: number | null; name: string; onClose: () => void; view: NonNullable<ReturnType<typeof useActiveView>> }) {
  const data = useData();
  const tone = data.settings.tone;
  useEffect(() => { if (days) haptic.success(); }, [days]);
  return (
    <AnimatePresence>
      {days && (
        <motion.div className="scrim center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="celebrate" role="dialog" aria-modal="true" aria-label="Milestone" onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.7, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={spring.bouncy}>
            <Burst burst={days} kind="spark" count={14} />
            <motion.div className="big-num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: 0.15 }}>{days}</motion.div>
            <LiveCompanion species={view.companion.species} coat={view.companion.coat} accessory={data.settings.wear} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={170} interactive={false} />
            <h2>{milestoneLine(tone, name, days).title}</h2>
            <p className="muted">{milestoneLine(tone, name, days).body}</p>
            <UnlockNote days={days} />
            <Button onClick={onClose}>Keep going</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UnlockNote({ days }: { days: number }) {
  const a = ACCESSORIES.find((x) => x.days === days);
  if (!a) return null;
  return <p className="unlock"><b>New:</b> {a.label}. Put it on in Me → Your companion.</p>;
}
