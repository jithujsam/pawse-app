import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { HEALTH_SEGMENTS, healthSegments, STAGE_LABEL } from "@detox/engine";
import { ACCENT, LiveCompanion, moodFor, type Gesture, type Reaction } from "../Companion";
import { cleanLine, cleanToast, pauseHint, pausedLine, resumeToast, dyingBanner, greeting, MILESTONES, milestoneLine, statusLine, waitingLine, welcomeBackLine } from "../copy";
import { addDays, fmtDay, parse, today, weekStart } from "../dates";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { scheduleCare } from "../notify";
import { actions, getData, recoveryPlan, SCARS_ON, useActiveView, useData, type Deduction } from "../store";
import { celebratedFor, daysTogether, milestoneToCelebrate, trackSummary } from "../progress";
import { trackState } from "../tracks";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Burst, Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { Coach } from "../ui/Coach";
import { say } from "../voice";
import { LogSheet } from "./LogSheet";
import { DayDetail } from "./Calendar";
import { UrgeSheet } from "./UrgeSheet";
import { HealthSheet, Heart, type HealthTab } from "./HealthSheet";
import { JourneyMoment, MissionsSheet } from "./MissionsSheet";
import type { JourneyEvent } from "@detox/engine";
import { companionMissions, shownHealth } from "../missions";
import { conditions, healthReport } from "../health";
import { runUpdate, useUpdate } from "../update";
import { onQuick, takeQuick } from "../quick";
import { afterSlipLine, dayStatus, restLine, STATUS_LABEL } from "../recovery";
import { ACCESSORIES } from "../pets";
import { t } from "../text";

/** One recovery track: its companion, today's check-in and the way back. Opened from the Pets grid. */
export function Home({ onBack }: { onBack?: () => void }) {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const track = trackState(data, habit.id);
  const { tone } = data.settings;
  const personality = companion.personality;
  const [sheet, setSheet] = useState(false);
  const [urge, setUrge] = useState(false);
  const [just, setJust] = useState<"slip" | "clean" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sparks, setSparks] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [moment, setMoment] = useState<JourneyEvent | null>(null);
  const update = useUpdate();
  const [updating, setUpdating] = useState<number | null>(null);

  // The centre button hands its choice to Home, which owns the sheet and the celebration.
  const quickRef = useRef<(a: ReturnType<typeof takeQuick>) => void>(() => undefined);
  quickRef.current = (a) => { if (a === "slip") setSheet(true); else if (a === "clean") clean(); else if (a === "urge") setUrge(true); };
  useEffect(() => { const run = () => quickRef.current(takeQuick()); run(); return onQuick(run); }, []);

  useEffect(() => { if (!just) return; const t = setTimeout(() => setJust(null), 3500); return () => clearTimeout(t); }, [just]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 6000); return () => clearTimeout(t); }, [note]);

  const t0 = today();
  const progress = trackSummary(data, habit.id, t0);
  const slippedToday = progress.today === "lapse";
  const cleanToday = progress.today === "met";
  const resting = progress.resting || progress.paused;
  const checked = slippedToday || cleanToday;
  // Any record today is a check-in (an urge too); a paused or not-tracked day isn't waiting for one.
  const checkedIn = checked || progress.today === "urge";
  // After a few quiet days the line is a warm welcome back. The pet keeps its usual mood: quiet days don't change how it looks.
  const returning = !checkedIn && !resting && progress.quiet >= 3;
  const mood = moodFor(view.stage, { checkedToday: checkedIn, slippedToday, justLogged: just, age: view.age, notTracking: resting });
  const streak = progress.current;
  const age = view.age;
  // The bar is the pet's health: green is what is left, red is damage, and a fully red bar is death.
  // Age is shown as days together.
  const days = daysTogether(companion.bornOn, today());
  const missions = companionMissions(data, companion.id, t0);
  // A rescued pet's bar starts mostly red and turns green as its missions are completed (PRD §23.9).
  const healthPct = shownHealth(age, missions?.healthCap ?? 100);
  const seg = (missions?.healthCap ?? 100) < 100 ? { green: Math.round(healthPct / (100 / HEALTH_SEGMENTS)) } : healthSegments(age);
  const danger = age >= 80;
  const report = healthReport(data, view, tone);
  const conds = conditions(data, view);
  const [health, setHealth] = useState<HealthTab | null>(null);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const activeMissions = missions && !missions.journey.recovered ? 6 - missions.journey.healed : 0;
  const plan = recoveryPlan(view);
  const trackPaused = track.status === "paused";
  const line = note ?? (just === "clean" ? cleanLine(tone, companion.name, streak)
    : trackPaused && !checkedIn ? pausedLine(tone, companion.name)
    : returning ? welcomeBackLine(tone, companion.name)
    : slippedToday && !just ? afterSlipLine(tone, companion.name)
      : progress.today === "rest" ? restLine(tone)
      : !checkedIn ? waitingLine(tone, companion.name) : statusLine(tone, companion.name, view.stage));
  const gesture: Gesture = "none";
  const speechRef = useRef<HTMLParagraphElement>(null);
  // The whole line always shows: if it doesn't fit the speech slot at this size, the font steps down until it does.
  useLayoutEffect(() => {
    const el = speechRef.current;
    const slot = el?.parentElement;
    if (!el || !slot) return;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.offsetHeight > slot.clientHeight && size > 11) { size -= 1; el.style.fontSize = `${size}px`; }
  }, [line]);

  const careOpts = () => ({ tone, personality, name: companion.name, enabled: data.settings.careNotes && data.settings.remindersOn && track.status === "active" });

  function clean() {
    if (cleanToday) return;
    if (!actions.markClean(habit.id)) { haptic.warn(); setNote(t("home.today.slip_blocks_goal")); return; }
    haptic.success();
    setJust("clean"); setSparks((s) => s + 1);
    setNote(say("cleanThanks", personality, tone));
    void scheduleCare("clean", careOpts());
    // A condition healed (or full recovery) is shown first; a days-of-care milestone waits until it's closed.
    const ev = actions.recordMissions(companion.id);
    if (ev) setTimeout(() => setMoment(ev), 900);
    const after = getData();
    const m = milestoneToCelebrate(trackSummary(after, habit.id, t0).care, celebratedFor(after, habit.id), MILESTONES);
    if (m) { setTimeout(() => setMilestone(m.hit), 900); actions.setCelebrated(habit.id, m.seen); }
    else if (!ev) toast(cleanToast(tone, companion.name), { kind: "good", ms: 1000, action: { label: t("ui.common.undo"), run: () => actions.unmarkClean(habit.id, t0) } });
  }
  function saved(d: Deduction) {
    setJust("slip"); haptic.heavy();
    setNote(d.binge && SCARS_ON ? say("binge", personality, tone) : d.absorbed >= d.entry.months - 0.01 ? say("shrug", personality, tone, d.streakBefore) : say("slip", personality, tone));
    // Tells the notification plan about the slip: it drops any thank-you planned for today and adds nothing.
    void scheduleCare("slip", careOpts());
    // A slip can bring a condition back: say so plainly, with how to heal it again.
    const ev = actions.recordMissions(companion.id);
    if (ev) setTimeout(() => setMoment(ev), 1200);
  }
  const react = (r: Reaction) => setNote(say(r, personality, tone));

  const ws = weekStart(t0);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const s = dayStatus(data, habit.id, d, t0);
    return { d, s, label: parse(d).toLocaleDateString(undefined, { weekday: "narrow" }) };
  });

  const weekMet = strip.filter((x) => x.s === "met").length;

  return (
    <motion.main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }} variants={stagger} initial="hidden" animate="show">
      <AnimatePresence>
        {update && (
          <motion.button className="update-banner" disabled={updating !== null} onClick={() => { haptic.tap(); setUpdating(0); void runUpdate(update, setUpdating).finally(() => setUpdating(null)); }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
            <span><b>{t("home.header.update_title")}</b><span className="small">{update.notes ? t("home.header.update_version_notes", { version: update.name, notes: update.notes }) : t("home.header.update_version", { version: update.name })}</span></span>
            <span className="update-cta">{updating === null ? t("home.header.update_cta") : updating > 0 ? `${updating}%` : t("home.header.update_downloading")}</span>
          </motion.button>
        )}
      </AnimatePresence>
      {onBack && <motion.button className="track-back" variants={rise} onClick={() => { haptic.select(); onBack(); }}>{Icon.chevL}<span>{t("home.header.all_pets")}</span></motion.button>}
      <motion.header className="greet" variants={rise}>
        <div>
          <h1>{greeting(tone, new Date().getHours(), data.settings.userName)}</h1>
        </div>
      </motion.header>

      <motion.section className={`hero${danger ? " hero-danger" : ""}`} aria-label={t("home.hero.hero_aria", { name: companion.name, day: days, health: healthPct })} variants={rise}>
        <Burst burst={sparks} kind="spark" count={10} />
        <AnimatePresence>{just === "slip" && <motion.div className="ripple" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: [0, 0.14, 0] }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }} />}</AnimatePresence>
        <div className="hero-name"><h2>{companion.name}</h2><span className="stage-tag">{STAGE_LABEL[view.stage]}</span></div>
        <div className="pet-stage-live">
          <LiveCompanion species={companion.species} coat={companion.coat} breed={companion.breed} personality={personality} accessory={track.wear}
            stage={view.stage} mood={mood} age={age} size={196} gesture={gesture} onReact={react} condition={missions?.mode === "rescue" ? missions.traits : undefined} />
        </div>
        {/* A fixed slot: the bubble can change its text without moving anything below it. */}
        <div className="speech-slot">
          <AnimatePresence mode="wait">
            <motion.p key={line} ref={speechRef} className="speech" aria-live="polite"
              initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={spring.soft}>
              {line}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="vitals four" role="group" aria-label={t("home.hero.vitals_aria", { name: companion.name })}>
          {VITALS.map((v) => (
            <motion.button key={v.id} className="vital" onClick={() => { haptic.tap(); setHealth(v.id); }} whileTap={{ scale: 0.9 }} transition={spring.snappy}
              aria-label={v.id === "health" ? t("home.hero.health_aria", { title: report.title, heart: report.heart }) : v.label}>
              <span className="vital-ico">{v.id === "health" ? <Heart value={report.heart} level={report.level} size={24} /> : v.icon}
                {v.id === "conditions" && conds.length > 0 && <i className="care-badge" data-tone={conds.some((c) => c.tone === "serious") ? "bad" : "warn"}>{conds.length}</i>}</span>
              <span className="small">{v.id === "health" ? `${report.heart}` : v.label}</span>
            </motion.button>
          ))}
          <motion.button className="vital" onClick={() => { haptic.tap(); setMissionsOpen(true); }} whileTap={{ scale: 0.9 }} transition={spring.snappy}
            aria-label={activeMissions === 0 ? t("missions.sheet.button_aria_done") : activeMissions === 1 ? t("missions.sheet.button_aria_one", { n: 1 }) : t("missions.sheet.button_aria_other", { n: activeMissions })}>
            <span className="vital-ico">{Icon.paw}{activeMissions > 0 && <i className="care-badge">{activeMissions}</i>}</span>
            <span className="small">{t("missions.sheet.button")}</span>
          </motion.button>
        </div>
        <div className="agetext"><span>{t("home.hero.day")} <b><AnimatedNumber value={days} /></b></span><span className="muted">{t("home.hero.vital_health")} <AnimatedNumber value={healthPct} />%</span></div>
        <div className={`healthbar${danger ? " danger" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={healthPct}
          aria-valuetext={t("home.hero.bar_text", { green: seg.green, total: HEALTH_SEGMENTS })} aria-label={t("home.hero.bar_aria", { name: companion.name })}>
          {Array.from({ length: HEALTH_SEGMENTS }, (_, i) => <i key={i} data-s={i < seg.green ? "ok" : "hurt"} />)}
        </div>
      </motion.section>

      {age >= 90 && <motion.div className="banner danger" role="status" variants={rise}>{dyingBanner(tone, companion.name, age)}</motion.div>}

      {trackPaused && (
        <motion.section className="card row paused-card" aria-label={t("home.paused.aria")} variants={rise}>
          <span className="small">{pauseHint(tone)}</span>
          <Button variant="secondary" onClick={() => { if (actions.resumeTrack(habit.id)) { haptic.select(); toast(resumeToast(tone), { kind: "good" }); } }}>{t("home.paused.resume")}</Button>
        </motion.section>
      )}

      {/* Today's record, between the pet and the week: mark it, log a slip, or leave it untracked. */}
      <DayDetail day={t0} onMarkMet={clean} onSlipSaved={saved} />

      <motion.section className="checkin" aria-label={t("home.week.title")} variants={rise}>
        <div className="row"><h2>{t("home.week.title")}</h2><span className="muted small">{weekMet === 1 ? t("home.week.count_one", { n: weekMet }) : t("home.week.count_other", { n: weekMet })}</span></div>
        <div className="weekstrip" aria-label={t("home.week.strip_aria")}>
          {strip.map((x) => (
            <div key={x.d} className="wday" data-s={x.s} data-today={x.d === t0} aria-label={t("home.week.day_aria", { date: fmtDay(x.d), status: STATUS_LABEL[x.s] })}>
              <span className="muted small">{x.label}</span>
              <motion.i layout initial={false} animate={{ scale: x.s === "unrecorded" || x.s === "future" ? 0.7 : 1 }} transition={spring.bouncy} />
            </div>
          ))}
        </div>
      </motion.section>

      <MissionsSheet open={missionsOpen} onClose={() => setMissionsOpen(false)} companionId={companion.id} />
      <HealthSheet open={health !== null} tab={health ?? "health"} onClose={() => setHealth(null)} />
      <UrgeSheet open={urge} onClose={() => setUrge(false)} onSlipped={() => { setUrge(false); setTimeout(() => setSheet(true), 350); }} />
      <LogSheet open={sheet} habit={habit} name={companion.name} age={age} onClose={() => setSheet(false)} onSaved={saved} />
      <JourneyMoment event={moment} companionId={companion.id} onClose={() => setMoment(null)} />
      <Milestone days={moment ? null : milestone} name={companion.name} onClose={() => setMilestone(null)} view={view} />
      {!data.settings.coachSeen && !sheet && !urge && !health && !missionsOpen && !moment && <Coach name={companion.name} onDone={() => actions.setSettings({ coachSeen: true })} />}
    </motion.main>
  );
}

const VITALS: { id: HealthTab; label: string; icon: React.JSX.Element | null }[] = [
  { id: "health", label: t("home.hero.vital_health"), icon: null },
  { id: "history", label: t("home.hero.vital_history"), icon: <svg viewBox="0 0 24 24" className="ico"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg> },
  { id: "conditions", label: t("home.hero.vital_conditions"), icon: <svg viewBox="0 0 24 24" className="ico"><path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></svg> },
];

function Milestone({ days, name, onClose, view }: { days: number | null; name: string; onClose: () => void; view: NonNullable<ReturnType<typeof useActiveView>> }) {
  const data = useData();
  const tone = data.settings.tone;
  const track = trackState(data, view.companion.trackId ?? view.habit?.id ?? "");
  useEffect(() => { if (days) haptic.success(); }, [days]);
  return createPortal(
    <AnimatePresence>
      {days && (
        <motion.div className="scrim center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="celebrate" role="dialog" aria-modal="true" aria-label={t("home.milestone.aria")} onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.7, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={spring.bouncy}>
            <Burst burst={days} kind="spark" count={14} />
            <motion.div className="big-num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: 0.15 }}>{days}</motion.div>
            <LiveCompanion species={view.companion.species} coat={view.companion.coat} breed={view.companion.breed} accessory={track.wear} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={170} interactive={false} />
            <h2>{milestoneLine(tone, name, days).title}</h2>
            <p className="muted">{milestoneLine(tone, name, days).body}</p>
            <UnlockNote days={days} />
            <Button onClick={onClose}>{t("home.milestone.keep_going")}</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function UnlockNote({ days }: { days: number }) {
  const a = ACCESSORIES.find((x) => x.days === days);
  if (!a) return null;
  return <p className="unlock"><b>{t("home.milestone.unlock_prefix")}</b> {t("home.milestone.unlock", { item: a.label })}</p>;
}
