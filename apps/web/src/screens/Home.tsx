import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { LiveCompanion, moodFor, type Gesture, type Reaction } from "../Companion";
import { cleanLine, cleanToast, pauseHint, pausedLine, resumeToast, MILESTONES, greeting, milestoneLine, statusLine, waitingLine } from "../copy";
import { fmtDay, today } from "../dates";
import { HEALTH_SEGMENTS } from "@detox/engine";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { scheduleCare } from "../notify";
import { actions, getData, petRequest, SCARS_ON, useActiveView, useData, type Deduction } from "../store";
import { aiPetLines, type PetLines } from "../ai";
import { celebratedFor, daysTogether, milestoneProgress, milestoneToCelebrate, trackSummary } from "../progress";
import { ambientFor, sceneFor } from "../scene";
import { PetScene } from "../ui/PetScene";
import { trackState } from "../tracks";
import { Burst, Button, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { awayEvent, say } from "../voice";
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
import { afterSlipLine, restLine, STATUS_LABEL } from "../recovery";
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
  const screenRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => foldRoom(screenRef.current), []);
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
  // After two or more quiet days in a row the pet says so in its own way, more theatrically the longer it was. It keeps
  // its usual mood: quiet days are missing data and don't change how it looks (RECOVERY_RULES rule 1).
  const away = !checkedIn && !resting ? awayEvent(progress.quiet) : null;
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
    : j.phase === "recovery" ? (21 - j.run === 1 ? t("home.hero.recover_one", { day: j.run }) : t("home.hero.recover_other", { day: j.run, n: 21 - j.run }))
      : j.phase === "consistency" ? t("home.hero.consistency_line", { n: 21 - j.consistency }) : t("home.hero.thriving_line");
  const report = healthReport(data, view, tone);
  const conds = conditions(data, view);
  const [health, setHealth] = useState<HealthTab | null>(null);
  const [missionsOpen, setMissionsOpen] = useState(false);
  // The badge: conditions still to heal in recovery, or 1 while an issue needs clearing.
  const activeMissions = !missions ? 0 : missions.journey.phase === "recovery" ? missions.journey.missions.filter((x) => x.status !== "healed").length : missions.journey.issue ? 1 : 0;
  const trackPaused = track.status === "paused";
  // The pet's own lines for today, written by the AI in its personality (PRD §24). Until they arrive, or whenever
  // there are none (signed out, offline, invalid), every moment keeps its hand-written line. A rescue pet keeps its pack.
  const [own, setOwn] = useState<PetLines | null>(null);
  const ownFor = rescue ? null : own;
  useEffect(() => {
    setOwn(null);
    const req = petRequest(habit.id, view.stage, t0);
    if (!req) return;
    let live = true;
    void aiPetLines(companion.id, req).then((r) => { if (live) setOwn(r); });
    return () => { live = false; };
    // One set of lines per pet, day, Voice and personality; the counts inside are read as they are at that moment.
  }, [companion.id, habit.id, t0, tone, personality]);
  const line = note ?? (just === "clean" ? ownFor?.goalMet ?? cleanLine(tone, companion.name, streak)
    : trackPaused && !checkedIn ? pausedLine(tone, companion.name)
    : away ? ownFor?.away ?? say(away, personality, tone, progress.quiet, `${t0}:${companion.id}`)
    : slippedToday && !just ? ownFor?.afterSlip ?? afterSlipLine(tone, companion.name)
      : progress.today === "rest" ? restLine(tone)
      : !checkedIn ? ownFor?.waiting ?? waitingLine(tone, companion.name)
      : cleanToday && ownFor ? ownFor.goalMet : statusLine(tone, companion.name, view.stage));
  // A goal met gets a jolly hop while the cheer runs; nothing else plays a gesture.
  const gesture: Gesture = just === "clean" ? "hop" : "none";

  const careOpts = () => ({ tone, personality, name: companion.name, userName: data.settings.userName, enabled: data.settings.careNotes && data.settings.remindersOn && track.status === "active" });

  function clean() {
    if (cleanToday) return;
    if (!actions.markClean(habit.id)) { haptic.warn(); setNote(t("home.today.slip_blocks_goal")); return; }
    haptic.success();
    setJust("clean"); setSparks((s) => s + 1);
    setNote(rescue ? packLine(habit.cls, "thanks", tone) : ownFor?.goalMet ?? say("cleanThanks", personality, tone));
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

  const now = new Date();
  const ambient = ambientFor(now, data.settings.ambient !== false);
  // With time of day off, the room keeps daylight; health still sets its weather.
  const scene = sceneFor({ wellness: healthPct, rescue, slipToday: slippedToday, milestoneToday: milestone !== null, hour: ambient ? now.getHours() : 12 });
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
    toast(t("home.today.slip_logged"), { kind: "bad", extra: { label: t("ui.common.undo"), run: () => { actions.deleteEntry(id); setJust(null); } },
      action: { label: t("home.today.add_details"), run: () => { actions.deleteEntry(id); setSheet(true); } } });
  }

  const meta = [streak > 0 ? t("home.today.run", { n: streak }) : null, nextMilestone ? t("home.today.next", { n: nextMilestone }) : null].filter((x): x is string => !!x).join(" · ");
  const bar = { green: Math.round(healthPct / (100 / HEALTH_SEGMENTS)) };
  // The streak (docs/RECOVERY_RULES.md): goal-met and urge days add one, a slip ends it, quiet days don't break it.
  // Lit once today counts; until then it waits, like a streak you still have time to keep.
  const streakLit = progress.today === "met" || progress.today === "urge";
  const streakBadge = (
    <span className="streak" data-lit={streakLit} title={streakLit ? t("home.today.streak_hint_on") : t("home.today.streak_hint_wait")}>
      {Icon.flame}<span>{t("home.today.streak", { n: streak })}</span>
    </span>
  );

  return (
    <main className="screen scene-screen" ref={screenRef}>
      <PetScene scene={scene} ambient={ambient} label={t("home.hero.hero_aria", { name: companion.name, day: days, health: healthPct })}>
        <div className="hs-bar">
          {onBack ? <button className="track-back" onClick={() => { haptic.select(); onBack(); }}>{Icon.chevL}<span>{t("home.header.all_pets")}</span></button> : <span />}
        </div>
        {/* Scrolling down tucks the room up: the greeting, streak line and health caption fade, the pet shrinks, the rest slides up (foldRoom below, styles.css). */}
        <p className="hs-greet">{greeting(tone, new Date().getHours(), data.settings.userName)}</p>
        <h1 className="hs-name">{companion.name}</h1>
        {meta && <p className="hs-meta">{meta}</p>}
        <div className="hs-stage">
          <Burst burst={sparks} kind="spark" count={10} />
          <div className="hs-pet">
            <LiveCompanion species={companion.species} coat={companion.coat} breed={companion.breed} personality={personality} light={scene.light}
              stage={view.stage} mood={mood} age={age} size={262} gesture={gesture} onReact={react} condition={missions?.mode === "rescue" ? missions.traits : undefined} />
          </div>
        </div>
        <div className="hs-speech">
        <AnimatePresence mode="wait">
          <motion.p key={line} className="speech" aria-live="polite" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={spring.soft}>
            {line}
          </motion.p>
        </AnimatePresence>
        </div>
        <div className="vitals" role="group" aria-label={t("home.hero.vitals_aria", { name: companion.name })}>
          {VITALS.map((v) => (
            <motion.button key={v.id} className="vital" onClick={() => { haptic.tap(); setHealth(v.id); }} whileTap={{ scale: 0.92 }} transition={spring.snappy}
              aria-label={v.id === "health" ? t("home.hero.health_aria", { title: report.title, heart: report.heart }) : v.label}>
              <span className="vital-ico">{v.id === "health" ? <Heart value={report.heart} level={report.level} size={24} /> : v.icon}
                {v.id === "conditions" && conds.length > 0 && <i className="care-badge" data-tone={conds.some((c) => c.tone === "serious") ? "bad" : "warn"}>{conds.length}</i>}</span>
              <span>{v.id === "health" ? `${report.heart}` : v.label}</span>
            </motion.button>
          ))}
          <motion.button className="vital" onClick={() => { haptic.tap(); setMissionsOpen(true); }} whileTap={{ scale: 0.92 }} transition={spring.snappy}
            aria-label={activeMissions === 0 ? t("missions.sheet.button_aria_done") : activeMissions === 1 ? t("missions.sheet.button_aria_one", { n: 1 }) : t("missions.sheet.button_aria_other", { n: activeMissions })}>
            <span className="vital-ico">{Icon.paw}{activeMissions > 0 && <i className="care-badge">{activeMissions}</i>}</span>
            <span>{t("missions.sheet.button")}</span>
          </motion.button>
        </div>
        {/* The bar is the pet's health; the line under it says what moves it. */}
        <div className="health-block">
          <div className="agetext"><b>{t("home.hero.vital_health")}</b><span>{t("home.hero.health_score", { n: healthPct })}</span></div>
          <div className="healthbar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={healthPct}
            aria-valuetext={t("home.hero.bar_text", { green: bar.green, total: HEALTH_SEGMENTS })} aria-label={t("home.hero.bar_aria", { name: companion.name })}>
            {Array.from({ length: HEALTH_SEGMENTS }, (_, i) => <i key={i} data-s={i < bar.green ? "ok" : "hurt"} />)}
          </div>
          {journeyLine && <p className="health-why">{journeyLine}</p>}
        </div>
      </PetScene>

      <div className="scene-body">
        <AnimatePresence>
          {update && (
            <motion.button className="update-banner" disabled={updating !== null} onClick={() => { haptic.tap(); setUpdating(0); void runUpdate(update, setUpdating).finally(() => setUpdating(null)); }}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
              <span><b>{t("home.header.update_title")}</b><span className="small">{update.notes ? t("home.header.update_version_notes", { version: update.name, notes: update.notes }) : t("home.header.update_version", { version: update.name })}</span></span>
              <span className="update-cta">{updating === null ? t("home.header.update_cta") : updating > 0 ? `${updating}%` : t("home.header.update_downloading")}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {trackPaused && (
          <section className="card row paused-card" aria-label={t("home.paused.aria")}>
            <span className="small">{pauseHint(tone)}</span>
            <Button variant="secondary" onClick={() => { if (actions.resumeTrack(habit.id)) { haptic.select(); toast(resumeToast(tone), { kind: "good" }); } }}>{t("home.paused.resume")}</Button>
          </section>
        )}

        <section className="card today" aria-label={t("home.today.today")}>
          {!resting ? (
            <>
              <div className="today-head"><h2>{t("home.today.how")}</h2><div className="today-sub"><p>{fmtDay(t0)}</p>{streakBadge}</div></div>
              {/* Once today is logged the card keeps its shape: the choice is marked, the other dims, and the marked one opens the edit panel. */}
              <div className="today-actions" data-logged={checked || undefined}>
                {cleanToday
                  ? <Button className="picked" aria-label={t("home.today.picked_aria", { choice: t("home.today.goal_met") })} onClick={() => setEditing((e) => !e)}>{Icon.check}{t("home.today.goal_met")}</Button>
                  : <Button onClick={clean} disabled={slippedToday}>{t("home.today.goal_met")}</Button>}
                {slippedToday
                  ? <Button variant="secondary" className="picked" aria-label={t("home.today.picked_aria", { choice: t("home.today.slipped") })} onClick={() => setEditing((e) => !e)}>{Icon.check}{t("home.today.slipped")}</Button>
                  : <Button variant="secondary" onClick={slip} disabled={cleanToday}>{t("home.today.slipped")}</Button>}
              </div>
              <button type="button" className="urge-btn" onClick={() => { haptic.tap(); setUrge(true); }}>
                <span className="urge-ico" aria-hidden>{Icon.wave}</span>
                <span className="urge-text"><b>{t("home.today.urge")}</b><small>{t("sheets.quick.urge_hint")}</small></span>
                <span className="srow-chev" aria-hidden>{Icon.chevR}</span>
              </button>
              {editing && checked && <DayDetail day={t0} standalone onMarkMet={clean} onSlipSaved={saved} />}
            </>
          ) : (
            <>
              <div className="today-head"><div className="today-sub"><h2>{fmtDay(t0)}</h2>{streakBadge}</div></div>
              <div className="today-done"><span>{loggedLine}</span><Button variant="text" onClick={() => setEditing((e) => !e)}>{t("home.today.edit")}</Button></div>
              {editing && <DayDetail day={t0} standalone onMarkMet={clean} onSlipSaved={saved} />}
            </>
          )}
        </section>

      </div>

      <i className="room-end" aria-hidden />
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


/**
 * The room folds as the page scrolls, with transforms only so it stays smooth. The room keeps its full size and sticks to the top, offset
 * upwards by `--room-d`, so the page itself slides it away natively. Each part then gets a small transform (see styles.css, "the room folds")
 * that carries it to its place in the folded room. This measures where every part is now and where it should end up, and hands the
 * numbers to the CSS. Does nothing where scroll-driven animation isn't supported; the room then just scrolls away.
 */
const FOLD = { nameScale: 0.68, petScale: 0.62, toIcons: 14, toMeter: 22, pad: 18 };
function foldRoom(screen: HTMLElement | null): (() => void) | void {
  const scene = screen?.querySelector<HTMLElement>(".pscene");
  if (!screen || !scene || !CSS.supports("animation-timeline", "scroll()")) return;
  const q = (sel: string) => scene.querySelector<HTMLElement>(sel);
  // Position inside the room, ignoring transforms.
  const top = (el: HTMLElement) => { let y = 0; let n: HTMLElement | null = el; while (n && n !== scene) { y += n.offsetTop; n = n.offsetParent as HTMLElement | null; } return y; };
  const px = (name: string, v: number) => screen.style.setProperty(name, `${Math.round(v * 10) / 10}px`);
  const measure = () => {
    const bar = q(".hs-bar"), name = q(".hs-name"), stage = q(".hs-stage"), speech = q(".hs-speech"), vitals = q(".vitals"), health = q(".health-block"), meter = q(".healthbar");
    if (!bar || !name || !stage || !speech || !vitals || !health || !meter) return;
    const { nameScale, petScale, toIcons, toMeter, pad } = FOLD;
    // Where each part ends up (top edge), stacked in the folded room. The labels under the icons and the "Health 70/100" row fade out, so
    // only the icons and the health bar remain, with more room between them.
    const dName = top(bar) + bar.offsetHeight;
    const dStage = dName + name.offsetHeight * nameScale - 6;
    const dSpeech = dStage + stage.offsetHeight * petScale - 12;
    const dVitals = dSpeech + speech.offsetHeight + toIcons;
    const dMeter = dVitals + (q(".vital-ico")?.offsetHeight ?? 54) + toMeter;
    const dHealth = dMeter - (top(meter) - top(health));
    const folded = dMeter + meter.offsetHeight + pad;
    const full = scene.offsetHeight;
    const d = Math.max(0, full - folded);
    const k = (end: number, now: HTMLElement) => (d > 0 ? d + end - top(now) : 0);
    px("--room-d", d);
    screen.style.setProperty("--room-r", String(d > 0 ? folded / full : 1));
    px("--k-bar", d);
    px("--k-name", k(dName, name));
    px("--k-stage", k(dStage, stage));
    px("--k-speech", k(dSpeech, speech));
    px("--k-vitals", k(dVitals, vitals));
    px("--k-health", k(dHealth, health));
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(scene);
  void document.fonts?.ready.then(measure);
  return () => ro.disconnect();
}
