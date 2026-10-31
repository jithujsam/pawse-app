import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { JOURNEY_TARGETS, type AdoptionMode, type JourneyEvent, type JourneyTarget, type MissionState } from "@detox/engine";
import { companionMissions, type CompanionMissions } from "../missions";
import { currentWord, healedWord, missionText } from "../mission-text";
import { spring } from "../motion";
import { today } from "../dates";
import { actions, useData } from "../store";
import { haptic } from "../haptics";
import { Burst, Button, Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { t, tt } from "../text";
import type { Tone } from "../types";

/**
 * Missions: the pet's recovery (Rescue) or training (Raise). A summary with the percentage and the one rule that
 * matters, the journey goal, then the six conditions in treatment order. Everything comes from companionMissions().
 */
export function MissionsSheet({ open, onClose, companionId }: { open: boolean; onClose: () => void; companionId: string }) {
  return <Sheet open={open} onClose={onClose} label={t("missions.sheet.label")}>{open && <Body companionId={companionId} />}</Sheet>;
}

function Body({ companionId }: { companionId: string }) {
  const data = useData();
  const tone = data.settings.tone;
  const companion = data.companions.find((c) => c.id === companionId);
  const m = companionMissions(data, companionId, today());
  if (!companion || !m) return null;
  const name = companion.name;
  const habit = data.habits.find((h) => h.id === (companion.trackId ?? "") || h.companionId === companion.id);
  return (
    <div className="missions">
      <header className="missions-head">
        <h2 className="missions-title">{t("missions.sheet.title")}</h2>
        <p className="muted">{m.mode === "rescue" ? t("missions.sheet.subtitle_rescue", { name }) : t("missions.sheet.subtitle_raise", { name })}</p>
      </header>
      <Summary m={m} />
      {m.setback && <p className="banner reassure" role="status">{tt("missions.sheet.setback", tone, { name })}</p>}
      <Goal m={m} companionId={companionId} disabled={!!companion.diedOn} />
      {m.journey.missions.map((s) => <MissionCard key={s.id} s={s} mode={m.mode} />)}
      {habit?.cls === "alcohol" && <p className="banner safety small" role="note">{t("missions.sheet.safety_alcohol")}</p>}
      {m.mode === "rescue" && <p className="muted small">{t("missions.sheet.fiction", { name })}</p>}
    </div>
  );
}

function Summary({ m }: { m: CompanionMissions }) {
  const j = m.journey;
  const rescue = m.mode === "rescue";
  const last = missionText(j.missions[5].id).title;
  return (
    <section className="card missions-summary" aria-live="polite">
      <div className="missions-pct">
        <b>{j.recovered ? (rescue ? t("missions.sheet.recovered") : t("missions.sheet.trained")) : rescue ? t("missions.sheet.pct_rescue", { pct: j.pct }) : t("missions.sheet.pct_raise", { pct: j.pct })}</b>
        {j.recovered && <span className="mission-pill done">{Icon.check}</span>}
      </div>
      <div className="progress mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={j.pct} aria-label={t("missions.sheet.bar_aria", { pct: j.pct })}>
        <motion.i initial={false} animate={{ width: `${j.pct}%` }} transition={spring.calm} />
      </div>
      {!j.recovered ? (
        <>
          <p className="small">{rescue ? t("missions.sheet.plan_rescue", { days: j.recoveryDays }) : t("missions.sheet.plan_raise", { days: j.recoveryDays })}</p>
          <p className="small muted">{rescue ? t("missions.sheet.rule_rescue") : t("missions.sheet.rule_raise")}</p>
        </>
      ) : j.complete ? (
        <p className="small">{t("missions.sheet.journey_done", { target: j.target })}</p>
      ) : (
        <>
          <p className="small">{t("missions.sheet.keep_up", { target: j.target, days: j.goalMetDays })}</p>
          <p className="small muted">{rescue ? t("missions.sheet.relapse_risk", { n: m.slipsInWindow, condition: last }) : t("missions.sheet.relapse_risk_raise", { n: m.slipsInWindow, condition: last })}</p>
        </>
      )}
    </section>
  );
}

/** The journey goal. It can be made longer, never shorter, so it can't be used to speed recovery up. */
function Goal({ m, companionId, disabled }: { m: CompanionMissions; companionId: string; disabled: boolean }) {
  const current = m.journey.target;
  return (
    <section className="missions-goal" aria-label={t("missions.sheet.goal")}>
      <div className="row"><span className="mission-label">{t("missions.sheet.goal")}</span></div>
      <div className="segmented" role="radiogroup" aria-label={t("missions.sheet.goal")}>
        {JOURNEY_TARGETS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={current === n} className="seg" disabled={disabled || n < current}
            onClick={() => { if (n > current) { haptic.select(); actions.setJourneyTarget(companionId, n as JourneyTarget); } }}>
            {current === n && <motion.span layoutId="goal-pill" className="seg-pill" transition={spring.snappy} />}
            <span className="seg-label">{t("missions.sheet.goal_days", { n })}</span>
          </button>
        ))}
      </div>
      <p className="muted small">{t("missions.sheet.goal_hint")}</p>
    </section>
  );
}

/** One condition (or skill): headline, why it matters, and where it stands. */
export function MissionCard({ s, mode }: { s: MissionState; mode: AdoptionMode }) {
  const words = missionText(s.id);
  return (
    <article className="mission-card" data-status={s.status}>
      <div className="mission-top">
        <h3>{words.title}</h3>
        {s.status === "healed" && <span className="mission-pill done">{Icon.check}{healedWord(mode)}</span>}
        {s.status === "current" && <span className="mission-pill current">{currentWord(mode)}</span>}
        {s.status === "waiting" && <span className="mission-pill">{t("missions.sheet.next")}</span>}
      </div>
      <p className="mission-why">{words.why}</p>
      {s.status === "current" && (
        <div className="mission-meter">
          <span className="days-boxes" role="meter" aria-valuemin={0} aria-valuemax={s.need} aria-valuenow={s.have} aria-label={t("missions.sheet.progress_aria", { have: s.have, need: s.need })}>
            {Array.from({ length: s.need }, (_, i) => <i key={i} data-on={i < s.have} />)}
          </span>
          <b>{t("missions.sheet.days_in_row", { have: s.have, need: s.need })}</b>
        </div>
      )}
      {s.status === "waiting" && <p className="mission-days muted">{t("missions.sheet.needs_days", { need: s.need })}</p>}
    </article>
  );
}

/**
 * The pop-up for a journey event: a condition healed, full recovery, the goal reached (celebrated), or a condition
 * coming back after a slip (calm, with how to heal it again).
 */
export function JourneyMoment({ event, companionId, onClose }: { event: JourneyEvent | null; companionId: string; onClose: () => void }) {
  const data = useData();
  const tone: Tone = data.settings.tone;
  const companion = data.companions.find((c) => c.id === companionId);
  const m = companion ? companionMissions(data, companionId, today()) : null;
  const good = event?.kind === "healed" || event?.kind === "recovered" || event?.kind === "complete";
  useEffect(() => { if (event) (good ? haptic.success : haptic.warn)(); }, [event, good]);
  const content = () => {
    if (!event || !companion || !m) return null;
    const name = companion.name;
    const rescue = m.mode === "rescue";
    const cond = event.mission ? missionText(event.mission).title : "";
    const current = m.journey.missions.find((x) => x.status === "current");
    const next = current ? t("missions.moment.next_up", { condition: missionText(current.id).title, need: current.need }) : null;
    const again = event.mission ? m.journey.missions.find((x) => x.id === event.mission) : undefined;
    switch (event.kind) {
      case "healed": return { title: rescue ? t("missions.moment.healed_title", { condition: cond }) : t("missions.moment.learned_title", { condition: cond }), body: tt("missions.moment.healed_body", tone, { name }), extra: next };
      case "recovered": return { title: rescue ? t("missions.moment.recovered_title", { name }) : t("missions.moment.trained_title", { name }), body: tt("missions.moment.recovered_body", tone, { name }), extra: null };
      case "complete": return { title: t("missions.moment.complete_title"), body: tt("missions.moment.complete_body", tone, { name }), extra: null };
      case "relapse": return { title: t("missions.moment.relapse_title", { condition: cond }), body: tt("missions.moment.relapse_body", tone, { name }), extra: again ? t("missions.moment.heal_again", { need: again.need }) : null };
      case "reset": return { title: t("missions.moment.reset_title", { condition: cond }), body: tt("missions.moment.reset_body", tone), extra: next };
    }
  };
  const c = content();
  return createPortal(
    <AnimatePresence>
      {c && (
        <motion.div className="scrim center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="celebrate journey-moment" data-good={good} role="dialog" aria-modal="true" aria-label={t("missions.moment.aria")} onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }} transition={good ? spring.bouncy : spring.soft}>
            {good && <Burst burst={1} kind="spark" count={14} />}
            <span className="moment-icon" aria-hidden>{good ? Icon.check : Icon.paw}</span>
            <h2>{c.title}</h2>
            <p className="muted">{c.body}</p>
            {c.extra && <p className="small">{c.extra}</p>}
            <Button onClick={onClose}>{t("missions.moment.ok")}</Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
