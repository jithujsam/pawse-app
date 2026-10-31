import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AdoptionMode, MissionState } from "@detox/engine";
import { companionMissions, type CompanionMissions } from "../missions";
import { doneWord, missionText, statusText } from "../mission-text";
import { spring } from "../motion";
import { today } from "../dates";
import { useData } from "../store";
import { haptic } from "../haptics";
import { Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { t, tt } from "../text";
import type { Tone } from "../types";

/**
 * Missions: one sheet for both adoption modes. Everything comes from companionMissions(), so the sheet never works
 * out progress itself; the mode only changes the words, the scale and the finished label.
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
  const active = m.states.filter((s) => !s.completed);
  const done = m.states.filter((s) => s.completed);
  return (
    <div className="missions">
      <header className="missions-head">
        <h2 className="missions-title">{t("missions.sheet.title")}</h2>
        <p className="muted">{t("missions.sheet.subtitle", { name })}</p>
        <span className="mode-tag" data-mode={m.mode}>{m.mode === "rescue" ? t("missions.sheet.mode_rescue") : t("missions.sheet.mode_raise")}</span>
      </header>

      <Overview m={m} name={name} tone={tone} />

      {m.setback && <p className="banner reassure" role="status">{tt("missions.sheet.setback", tone, { name })}</p>}

      {active.length > 0 && (
        <section aria-label={t("missions.sheet.active")} className="mission-group">
          <h3 className="group-title">{t("missions.sheet.active")}</h3>
          {active.map((s) => <MissionCard key={s.id} s={s} mode={m.mode} name={name} goalMetDays={m.goalMetDays} />)}
        </section>
      )}
      {done.length > 0 && (
        <section aria-label={t("missions.sheet.completed")} className="mission-group">
          <h3 className="group-title">{t("missions.sheet.completed")}</h3>
          {done.map((s) => <MissionCard key={s.id} s={s} mode={m.mode} name={name} goalMetDays={m.goalMetDays} />)}
        </section>
      )}
      <p className="muted small">{t("missions.sheet.how_levels")}</p>
      {m.mode === "rescue" && <p className="muted small">{t("missions.sheet.fiction", { name })}</p>}
    </div>
  );
}

function Overview({ m, name, tone }: { m: CompanionMissions; name: string; tone: Tone }) {
  const { overall } = m;
  const pct = Math.round(overall.pct * 100);
  const line = !m.next ? tt("missions.sheet.all_done", tone, { name })
    : m.next.toGo === 1 ? tt("missions.sheet.encourage_one", tone)
      : tt("missions.sheet.encourage", tone, { n: m.next.toGo });
  return (
    <section className="card missions-overview" aria-label={t("missions.sheet.overall")}>
      <div className="row"><b>{t("missions.sheet.overall")}</b><span className="muted small">{pct}%</span></div>
      <Bar pct={overall.pct} label={t("missions.sheet.overall_aria", { passed: overall.passed, total: overall.total })} />
      <div className="row small muted">
        <span>{t("missions.sheet.count_active", { n: overall.active })}</span>
        <span>{t("missions.sheet.count_completed", { n: overall.completed })}</span>
      </div>
      <p className="small">{m.goalMetDays === 1 ? t("missions.sheet.goal_met_one", { n: 1, name }) : t("missions.sheet.goal_met_other", { n: m.goalMetDays, name })}</p>
      {(m.next?.toGo ?? 1) > 0 && <p className="small muted">{line}</p>}
    </section>
  );
}

function Bar({ pct, label }: { pct: number; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="progress mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={label}>
      <motion.i initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} transition={spring.calm} />
    </div>
  );
}

/** One mission. The summary is always visible; the story, requirements and milestones open below it. */
export function MissionCard({ s, mode, name, goalMetDays, initialOpen = false }: { s: MissionState; mode: AdoptionMode; name: string; goalMetDays: number; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const bodyId = useId();
  const words = missionText(s.id);
  const rehab = s.scale === "rehab";
  const finished = doneWord(mode);
  const valueLabel = rehab ? t("missions.sheet.value_rehab", { value: s.value }) : t("missions.sheet.value_growth", { value: s.value });
  return (
    <article className="mission-card" data-done={s.completed} data-mode={mode}>
      <button className="mission-summary" aria-expanded={open} aria-controls={bodyId} onClick={() => { haptic.select(); setOpen((o) => !o); }}>
        <div className="mission-top">
          <h4>{s.completed ? (mode === "rescue" ? t("missions.sheet.done_title_rescue", { title: words.title }) : t("missions.sheet.done_title_raise", { title: words.title })) : words.title}</h4>
          {s.completed
            ? <span className="mission-pill done">{Icon.check}{finished}</span>
            : <span className="mission-pill">{t("missions.sheet.level", { level: s.level })}</span>}
        </div>
        <dl className="mission-facts">
          <div><dt>{rehab ? t("missions.sheet.condition") : t("missions.sheet.development")}</dt><dd>{valueLabel}</dd></div>
          <div><dt>{t("missions.sheet.status")}</dt><dd>{s.completed ? finished : statusText(mode, s.status)}</dd></div>
        </dl>
        <Bar pct={s.pct} label={rehab ? t("missions.sheet.bar_rehab_aria", { value: s.value }) : t("missions.sheet.bar_growth_aria", { value: s.value })} />
        {!s.completed && s.nextAt !== null && (
          <dl className="mission-facts">
            <div><dt>{t("missions.sheet.progress")}</dt><dd>{t("missions.sheet.progress_days", { have: Math.min(goalMetDays, s.nextAt), need: s.nextAt })}</dd></div>
            <div><dt>{t("missions.sheet.next")}</dt><dd>{s.nextLevel === 0 ? (mode === "rescue" ? t("missions.sheet.next_done_rescue") : t("missions.sheet.next_done_raise")) : t("missions.sheet.next_level", { level: s.nextLevel ?? 0 })}</dd></div>
          </dl>
        )}
        <span className="mission-more small muted">{open ? t("missions.sheet.less") : t("missions.sheet.more")}<span className="chev" data-open={open}>{Icon.chevR}</span></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={bodyId} className="mission-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.soft}>
            <div className="mission-body-inner">
              <h5>{t("missions.sheet.why")}</h5><p>{words.why}</p>
              <h5>{t("missions.sheet.effect")}</h5><p>{words.effect}</p>
              {!s.completed && <><h5>{t("missions.sheet.unlocks")}</h5><p>{words.unlock}</p></>}
              <h5>{t("missions.sheet.requirements")}</h5>
              <p>{s.completed || s.nextAt === null ? t("missions.sheet.requirement_done") : t("missions.sheet.requirement", { need: s.nextAt, name })}</p>
              {s.extra && (
                <>
                  <h5>{t("missions.sheet.extra")}</h5>
                  <p>{s.extra.kind === "urgesManaged" ? t("missions.sheet.extra_urges", { have: s.extra.have, target: s.extra.target }) : t("missions.sheet.extra_pet_days", { have: s.extra.have, target: s.extra.target, name })}
                    {s.extra.done && <span className="extra-done" aria-hidden>{Icon.check}</span>}</p>
                  <p className="muted small">{t("missions.sheet.extra_note")}</p>
                </>
              )}
              <h5>{t("missions.sheet.milestones")}</h5>
              {s.reached.length === 0 ? <p className="muted">{t("missions.sheet.milestones_none")}</p> : (
                <ul className="milestone-chips">
                  {[...s.reached].reverse().map((lv) => (
                    <li key={lv}>{Icon.check}{lv === 0 ? (mode === "rescue" ? t("missions.sheet.milestone_done_rescue") : t("missions.sheet.milestone_done_raise")) : t("missions.sheet.milestone_level", { level: lv })}</li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
