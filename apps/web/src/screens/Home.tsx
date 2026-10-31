import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { LiveCompanion, moodFor, type Gesture, type Reaction } from "../Companion";
import { cleanLine, cleanToast, pauseHint, pausedLine, resumeToast, MILESTONES, milestoneLine, statusLine, waitingLine, welcomeBackLine } from "../copy";
import { addDays, today } from "../dates";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { scheduleCare } from "../notify";
import { actions, getData, SCARS_ON, useActiveView, useData, type Deduction } from "../store";
import { celebratedFor, daysTogether, milestoneProgress, milestoneToCelebrate, trackSummary } from "../progress";
import { sceneFor } from "../scene";
import { PetScene } from "../ui/PetScene";
import { Group, Row } from "../ui/Settings";
import { trackState } from "../tracks";
import { Burst, Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { say } from "../voice";
import { LogSheet } from "./LogSheet";
import { DayDetail } from "./Calendar";
import { UrgeSheet } from "./UrgeSheet";
import { HealthSheet, Heart, type HealthTab } from "./HealthSheet";
import { JourneyMoment, MissionsSheet } from "./MissionsSheet";
import type { JourneyEvent } from "@detox/engine";
import { companionMissions } from "../missions";
import { missionText, packLine } from "../mission-text";
import { conditions, healthReport } from "../health";
import { runUpdate, useUpdate } from "../update";
import { onQuick, takeQuick } from "../quick";
import { afterSlipLine, dayStatus, restLine, STATUS_LABEL } from "../recovery";
import { t, tt } from "../text";

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
  // One number for the pet: wellness W (docs/MISSION_FORMULA.md). The slip-damage engine still runs underneath for
  // history, but Home shows only W, so the bar, the heart and the line under it always agree.
  const healthPct = missions?.healthCap ?? 100;
  const j = missions?.journey;
  // Only a rescue has a past home to talk about (talking-pet packs, src/text/sections/packs.ts).
  const rescue = missions?.mode === "rescue";
  const journeyLine = !j ? "" : j.issue ? t("home.hero.issue_line", { issue: missionText(j.issue.id).title, n: j.issue.need - j.issue.have })
    : j.phase === "recovery" ? (21 - j.run === 1 ? t("home.hero.recover_one") : t("home.hero.recover_other", { n: 21 - j.run }))
      : j.phase === "consistency" ? t("home.hero.consistency_line", { n: 21 - j.consistency }) : t("home.hero.thriving_line");
  const report = healthReport(data, view, tone);
  const conds = conditions(data, view);
  const [health, setHealth] = useState<HealthTab | null>(null);
  const [missionsOpen, setMissionsOpen] = useState(false);
  // The badge: conditions still to heal in recovery, or 1 while an issue needs clearing.
  const activeMissions = !missions ? 0 : missions.journey.phase === "recovery" ? missions.journey.missions.filter((x) => x.status !== "healed").length : missions.journey.issue ? 1 : 0;
  const trackPaused = track.status === "paused";
  const line = note ?? (just === "clean" ? cleanLine(tone, companion.name, streak)
    : trackPaused && !checkedIn ? pausedLine(tone, companion.name)
    : returning ? welcomeBackLine(tone, companion.name)
    : slippedToday && !just ? afterSlipLine(tone, companion.name)
      : progress.today === "rest" ? restLine(tone)
      : !checkedIn ? waitingLine(tone, companion.name) : statusLine(tone, companion.name, view.stage));
  const gesture: Gesture = "none";

  const careOpts = () => ({ tone, personality, name: companion.name, enabled: data.settings.careNotes && data.settings.remindersOn && track.status === "active" });

  function clean() {
    if (cleanToday) return;
    if (!actions.markClean(habit.id)) { haptic.warn(); setNote(t("home.today.slip_blocks_goal")); return; }
    haptic.success();
    setJust("clean"); setSparks((s) => s + 1);
    setNote(rescue ? packLine(habit.cls, "thanks", tone) : say("cleanThanks", personality, tone));
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
    setNote(d.binge && SCARS_ON ? say("binge", personality, tone) : d.absorbed >= d.entry.months - 0.01 ? say("shrug", personality, tone, d.streakBefore) : rescue ? packLine(habit.cls, "slip", tone) : say("slip", personality, tone));
    // Tells the notification plan about the slip: it drops any thank-you planned for today and adds nothing.
    void scheduleCare("slip", careOpts());
    // A slip can bring a condition back: say so plainly, with how to heal it again.
    const ev = actions.recordMissions(companion.id);
    if (ev) setTimeout(() => setMoment(ev), 1200);
  }
  // A stroke tells the pet's story (its talking-pet pack); other taps keep their playful answers.
  const react = (r: Reaction) => setNote(rescue && r === "stroke" ? packLine(habit.cls, "story", tone) : say(r, personality, tone));

  const days28 = Array.from({ length: 28 }, (_, i) => { const d = addDays(t0, i - 27); return { d, s: dayStatus(data, habit.id, d, t0) }; });
  const scene = sceneFor({ wellness: healthPct, rescue, slipToday: slippedToday, milestoneToday: milestone !== null, hour: new Date().getHours() });
  const nextMilestone = milestoneProgress(progress.care, MILESTONES).next;
  const [editing, setEditing] = useState(false);
  const hasRequired = habit.fields.some((f) => f.required);
  const loggedLine = cleanToday ? tt("calendar.note.met", tone) : slippedToday ? STATUS_LABEL.lapse : progress.today === "urge" ? tt("calendar.note.urge_managed", tone)
    : trackPaused ? pausedLine(tone, companion.name) : tt("calendar.note.rest", tone);

  // I slipped: with no required question the slip is logged at once, and the toast can undo it or open the form for details.
  function slip() {
    if (hasRequired) { setSheet(true); return; }
    const d = actions.logSlip(habit.id, {}, t0, null);
    if (!d) { haptic.warn(); return; }
    saved(d);
    const id = d.entry.id;
    toast(t("home.scene.slip_logged"), { kind: "bad", extra: { label: t("ui.common.undo"), run: () => { actions.deleteEntry(id); setJust(null); } },
      action: { label: t("home.scene.add_details"), run: () => { actions.deleteEntry(id); setSheet(true); } } });
  }

  const readouts = [
    t("home.scene.well", { n: healthPct }), streak > 0 || !!j ? t("home.scene.run", { n: streak }) : null, nextMilestone ? t("home.scene.next", { n: nextMilestone }) : null,
  ].filter((x): x is string => !!x);

  return (
    <main className="screen scene-screen">
      <PetScene scene={scene} label={t("home.hero.hero_aria", { name: companion.name, day: days, health: healthPct })}
        overlay={<>
          <div className="ps-id">
            {onBack && <button className="track-back" onClick={() => { haptic.select(); onBack(); }}>{Icon.chevL}<span>{t("home.header.all_pets")}</span></button>}
            <h1 className="t-display">{companion.name}</h1>
            <p className="t-body" aria-live="polite">{line}</p>
          </div>
          <div className="ps-read t-label">{readouts.map((r) => <span key={r}>{r}</span>)}</div>
        </>}>
        <Burst burst={sparks} kind="spark" count={10} />
        <LiveCompanion species={companion.species} coat={companion.coat} breed={companion.breed} personality={personality} light={scene.light}
          stage={view.stage} mood={mood} age={age} size={240} gesture={gesture} onReact={react} condition={missions?.mode === "rescue" ? missions.traits : undefined} />
      </PetScene>

      <div className="scene-body">
        {trackPaused && (
          <section className="card row paused-card" aria-label={t("home.paused.aria")}>
            <span className="small">{pauseHint(tone)}</span>
            <Button variant="secondary" onClick={() => { if (actions.resumeTrack(habit.id)) { haptic.select(); toast(resumeToast(tone), { kind: "good" }); } }}>{t("home.paused.resume")}</Button>
          </section>
        )}

        <section className="today" aria-label={t("home.scene.today")}>
          <h2>{t("home.scene.today")}</h2>
          {!checkedIn && !resting ? (
            <>
              <div className="today-actions">
                <Button onClick={clean}>{t("home.scene.goal_met")}</Button>
                <Button variant="secondary" onClick={slip}>{t("home.scene.slipped")}</Button>
              </div>
              <Button variant="text" className="today-urge" onClick={() => { haptic.tap(); setUrge(true); }}>{t("home.scene.urge")}</Button>
            </>
          ) : (
            <>
              <div className="today-done"><span>{loggedLine}</span><Button variant="text" onClick={() => setEditing((e) => !e)}>{t("home.scene.edit")}</Button></div>
              {editing && <DayDetail day={t0} onMarkMet={clean} onSlipSaved={saved} />}
            </>
          )}
        </section>

        <section className="stack" aria-label={t("home.scene.strip_aria")}>
          <div className="strip28" role="img" aria-label={t("home.scene.strip_aria")}>
            {days28.map((x) => <span key={x.d} data-today={x.d === t0 || undefined}><i className="mark" data-s={x.s} /></span>)}
          </div>
          <div className="wbar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={healthPct} aria-label={t("home.hero.bar_aria", { name: companion.name })}><i style={{ width: `${healthPct}%` }} /></div>
          <div className="strip-meta"><span>{t("home.scene.well", { n: healthPct })}</span><span>{journeyLine}</span></div>
        </section>

        <Group>
          {update && (
            <button className="srow" disabled={updating !== null} onClick={() => { haptic.tap(); setUpdating(0); void runUpdate(update, setUpdating).finally(() => setUpdating(null)); }}>
              <span className="srow-label">{t("home.header.update_title")}<br /><span className="t-caption muted">{update.notes ? t("home.header.update_version_notes", { version: update.name, notes: update.notes }) : t("home.header.update_version", { version: update.name })}</span></span>
              <span className="srow-value">{updating === null ? t("home.header.update_cta") : updating > 0 ? `${updating}%` : t("home.header.update_downloading")}</span>
            </button>
          )}
          <Row icon={<Heart value={report.heart} level={report.level} size={20} />} label={t("home.hero.vital_health")} value={`${healthPct}%`} onClick={() => setHealth("health")} />
          <Row icon={VITALS[1].icon} label={t("home.hero.vital_history")} onClick={() => setHealth("history")} />
          <Row icon={VITALS[2].icon} label={t("home.hero.vital_conditions")} value={conds.length > 0 ? conds.length : undefined} onClick={() => setHealth("conditions")} />
          <Row icon={Icon.paw} label={t("missions.sheet.button")} value={activeMissions > 0 ? activeMissions : undefined} onClick={() => setMissionsOpen(true)} />
        </Group>
      </div>

      <MissionsSheet open={missionsOpen} onClose={() => setMissionsOpen(false)} companionId={companion.id} />
      <HealthSheet open={health !== null} tab={health ?? "health"} onClose={() => setHealth(null)} />
      <UrgeSheet open={urge} onClose={() => setUrge(false)} onSlipped={() => { setUrge(false); setTimeout(() => setSheet(true), 350); }} />
      <LogSheet open={sheet} habit={habit} name={companion.name} age={age} onClose={() => setSheet(false)} onSaved={saved} />
      <JourneyMoment event={moment} companionId={companion.id} onClose={() => setMoment(null)} />
      <Milestone days={moment ? null : milestone} name={companion.name} onClose={() => setMilestone(null)} view={view} />
    </main>
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
  useEffect(() => { if (days) haptic.success(); }, [days]);
  return createPortal(
    <AnimatePresence>
      {days && (
        <motion.div className="scrim center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="celebrate" role="dialog" aria-modal="true" aria-label={t("home.milestone.aria")} onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.7, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={spring.bouncy}>
            <Burst burst={days} kind="spark" count={14} />
            <motion.div className="big-num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: 0.15 }}>{days}</motion.div>
            <LiveCompanion species={view.companion.species} coat={view.companion.coat} breed={view.companion.breed} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={170} interactive={false} />
            <h2>{milestoneLine(tone, name, days).title}</h2>
            <p className="muted">{milestoneLine(tone, name, days).body}</p>
            <Button onClick={onClose}>{t("home.milestone.keep_going")}</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

