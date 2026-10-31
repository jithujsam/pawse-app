import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CONSISTENCY_DAYS, ISSUE_DAYS, RECOVERY_DAYS, THRIVING_REWARD_EVERY, type Journey, type JourneyEvent } from "@detox/engine";
import { companionMissions } from "../missions";
import { healedWord, missionText, rewardName, tierWord } from "../mission-text";
import { spring } from "../motion";
import { today } from "../dates";
import { useData } from "../store";
import { haptic } from "../haptics";
import { Burst, Button, Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { t, tt } from "../text";
import type { Tone } from "../types";

/**
 * Missions: the pet's 21-day journey. One big count (21 days to recover, then 21 days of consistency), an issue to
 * clear if a slip brought one, and the six conditions with the day each heals on. Everything comes from
 * companionMissions(), so the sheet never works anything out itself.
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
  const j = m.journey;
  const habit = data.habits.find((h) => h.id === companion.trackId || h.companionId === companion.id);
  return (
    <div className="missions">
      <header className="missions-head">
        <h2 className="missions-title">{t("missions.sheet.title")}</h2>
        <p className="muted">{m.mode === "rescue" ? t("missions.sheet.subtitle_rescue", { name }) : t("missions.sheet.subtitle_raise", { name })}</p>
      </header>
      <Count j={j} name={name} />
      {m.setback && <p className="banner reassure" role="status">{tt("missions.sheet.setback", tone, { name })}</p>}
      {j.issue && <IssueCard j={j} name={name} />}
      {j.phase === "recovery" ? <Conditions j={j} name={name} /> : <AfterRecovery j={j} />}
      <footer className="missions-foot">
        {habit?.cls === "alcohol" && <p role="note">{t("missions.sheet.safety_alcohol")}</p>}
        {m.mode === "rescue" && <p>{t("missions.sheet.fiction", { name })}</p>}
      </footer>
    </div>
  );
}

/** The one number that matters, large: goal-met days still to go in this stage, with a thin bar under it. */
function Count({ j, name }: { j: Journey; name: string }) {
  const rescue = j.mode === "rescue";
  if (j.phase === "thriving") return (
    <section className="journey-hero">
      <b className="journey-num word">{t("missions.sheet.thriving_big")}</b>
      <span className="journey-for">{t("missions.sheet.thriving_days", { n: j.thriving, k: THRIVING_REWARD_EVERY - (j.thriving % THRIVING_REWARD_EVERY) })}</span>
    </section>
  );
  const recovery = j.phase === "recovery";
  const done = recovery ? j.run : j.consistency;
  const left = (recovery ? RECOVERY_DAYS : CONSISTENCY_DAYS) - done;
  return (
    <section className="journey-hero">
      <b className="journey-num">{left}</b>
      <span className="journey-unit">{left === 1 ? t("missions.sheet.unit_one") : t("missions.sheet.unit_other")}</span>
      <span className="journey-for">{recovery ? (rescue ? t("missions.sheet.for_rescue", { name }) : t("missions.sheet.for_raise", { name })) : t("missions.sheet.for_consistency", { name })}</span>
      <span className="journey-bar" role="progressbar" aria-valuemin={0} aria-valuemax={21} aria-valuenow={done} aria-label={t("missions.sheet.boxes_aria", { n: done })}>
        <motion.i initial={false} animate={{ width: `${(done / 21) * 100}%` }} transition={spring.calm} />
      </span>
      <span className="journey-meta">{j.bestRun > done && recovery ? t("missions.sheet.day_best", { n: done, best: j.bestRun }) : t("missions.sheet.day_of", { n: done })}</span>
      <p className="journey-rule">{recovery ? t("missions.sheet.rule_recovery") : t("missions.sheet.rule_after", { name })}</p>
    </section>
  );
}

function IssueCard({ j, name }: { j: Journey; name: string }) {
  const issue = j.issue!;
  const words = missionText(issue.id);
  return (
    <article className="mission-card issue-card" data-tier={issue.tier}>
      <div className="mission-top"><h3>{words.title}</h3><span className="mission-pill issue">{tierWord(issue.tier)}</span></div>
      <p className="mission-why">{words.why}</p>
      <div className="mission-meter">
        <span className="days-boxes" role="meter" aria-valuemin={0} aria-valuemax={issue.need} aria-valuenow={issue.have} aria-label={t("missions.sheet.issue_days", { have: issue.have, need: issue.need })}>
          {Array.from({ length: issue.need }, (_, i) => <i key={i} data-on={i < issue.have} />)}
        </span>
        <b>{t("missions.sheet.issue_days", { have: issue.have, need: issue.need })}</b>
      </div>
      {j.phase === "consistency" && <p className="small muted">{t("missions.sheet.issue_note", { name })}</p>}
    </article>
  );
}

/** In recovery: what's healing now gets the attention; healed ones are small chips; the rest is one quiet line. */
function Conditions({ j }: { j: Journey; name: string }) {
  const current = j.missions.find((x) => x.status === "current");
  const healed = j.missions.filter((x) => x.status === "healed");
  const ahead = j.missions.filter((x) => x.status === "waiting");
  const rescue = j.mode === "rescue";
  const left = current ? current.at - j.run : 0;
  return (
    <>
      {current && (
        <section className="now-healing">
          <span className="eyebrow">{rescue ? t("missions.sheet.now_healing") : t("missions.sheet.now_learning")}</span>
          <h3>{missionText(current.id).title}</h3>
          <p>{missionText(current.id).why}</p>
          <span className="now-when">{left === 1 ? t("missions.sheet.heals_in_one", { at: current.at }) : t("missions.sheet.heals_in_other", { at: current.at, n: left })}</span>
        </section>
      )}
      {healed.length > 0 && (
        <section className="healed-chips" aria-label={healedWord(j.mode)}>
          {healed.map((x) => <span key={x.id}>{Icon.check}{missionText(x.id).title}</span>)}
        </section>
      )}
      {ahead.length > 0 && <p className="ahead"><span className="eyebrow">{t("missions.sheet.ahead")}</span> {ahead.map((x) => missionText(x.id).title).join(" · ")}</p>}
    </>
  );
}

/** After recovery: rewards earned, and the slip rule spelled out so it's never a surprise. */
function AfterRecovery({ j }: { j: Journey }) {
  return (
    <>
      {j.rewards > 0 && (
        <section aria-label={t("missions.sheet.rewards")}>
          <h3 className="group-title">{t("missions.sheet.rewards")}</h3>
          <ul className="reward-chips">{Array.from({ length: j.rewards }, (_, i) => <li key={i}>{Icon.paw}{rewardName(i + 1)}</li>)}</ul>
        </section>
      )}
      <p className="small muted">{t("missions.sheet.slips_rule")}</p>
    </>
  );
}

/**
 * The pop-up for a journey event: a condition healed, recovery, a reward or an issue cleared (celebrated), or a slip
 * that brought an issue or started recovery over (calm, with what it takes to put right).
 */
export function JourneyMoment({ event, companionId, onClose }: { event: JourneyEvent | null; companionId: string; onClose: () => void }) {
  const data = useData();
  const tone: Tone = data.settings.tone;
  const companion = data.companions.find((c) => c.id === companionId);
  const m = companion ? companionMissions(data, companionId, today()) : null;
  const good = event?.kind === "healed" || event?.kind === "recovered" || event?.kind === "reward" || event?.kind === "cleared";
  useEffect(() => { if (event) (good ? haptic.success : haptic.warn)(); }, [event, good]);
  const content = () => {
    if (!event || !companion || !m) return null;
    const name = companion.name;
    const rescue = m.mode === "rescue";
    const what = event.id ? missionText(event.id).title : "";
    const current = m.journey.missions.find((x) => x.status === "current");
    switch (event.kind) {
      case "healed": return { title: rescue ? t("missions.moment.healed_title", { condition: what }) : t("missions.moment.learned_title", { condition: what }), body: tt("missions.moment.healed_body", tone, { name }), extra: current ? t("missions.moment.next_up", { condition: missionText(current.id).title, n: current.at }) : null };
      case "recovered": return { title: rescue ? t("missions.moment.recovered_title", { name }) : t("missions.moment.trained_title", { name }), body: tt("missions.moment.recovered_body", tone, { name }), extra: null };
      case "reward": return { title: rewardName(event.n ?? 1), body: tt("missions.moment.reward_body", tone, { name }), extra: null };
      case "cleared": return { title: t("missions.moment.cleared_title", { issue: what }), body: tt("missions.moment.cleared_body", tone, { name }), extra: null };
      case "issue": return { title: what, body: tt("missions.moment.issue_body", tone, { name }), extra: t("missions.moment.issue_clear", { need: ISSUE_DAYS[event.tier ?? 1] }) };
      case "restart": return { title: t("missions.moment.restart_title"), body: tt("missions.moment.restart_body", tone, { name }), extra: t("missions.moment.restart_extra") };
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
