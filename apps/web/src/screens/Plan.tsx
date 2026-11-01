import { useRef, useState } from "react";
import { motion } from "motion/react";
import type { HabitClass } from "@detox/engine";
import { concernInAny, hasCrisis } from "../guard";
import { t, tt } from "../text";
import { haptic } from "../haptics";
import { rise } from "../motion";
import { FIRST_STEPS, REASONS, SITUATIONS, STRATEGIES, strategy, trackLessons } from "../recovery";
import { fmtDay } from "../dates";
import { actions, emptyPlan, useData } from "../store";
import { trackState } from "../tracks";
import { Button, GuardedInput, Icon, MultiSelect, plainOpts, Select, SelectOther, type Opt } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { goalTarget } from "../goal";
import type { Baseline, GoalKind, RecoveryPlan } from "../types";

const planTexts = (p: RecoveryPlan) => [...p.reasons, ...p.situations, ...p.ifThen, p.firstStep, p.supportName, p.identity ?? ""];

/** True when any free text in the plan needs the crisis message instead of being saved. */
export const planHasCrisis = (p: RecoveryPlan) => planTexts(p).some(hasCrisis);

/** What the plan's typed text needs before it can be saved: the crisis message, the food and weight note, or nothing. */
export const planConcern = (p: RecoveryPlan) => concernInAny(planTexts(p));

/** The goal in a few words, for Me and the Insights card: "Quit completely", "At most 3 a week", "Understanding it first", or "Not set". */
export function goalSummary(plan: RecoveryPlan | null | undefined): string {
  const g = goalTarget(plan);
  if (!g) return t("goal.setup.summary_none");
  return g.kind === "quit" ? t("goal.setup.summary_quit") : g.kind === "limit" ? t("goal.setup.summary_limit", { n: g.perWeek }) : t("goal.setup.summary_learn");
}

const START_OPTS: Opt<Baseline>[] = [
  { value: "many_daily", label: t("goal.setup.start_many_daily") }, { value: "daily", label: t("goal.setup.start_daily") },
  { value: "few_weekly", label: t("goal.setup.start_few_weekly") }, { value: "weekly", label: t("goal.setup.start_weekly") },
];

/**
 * What the person is aiming for, in a form the app can measure: quit completely, cut down to a number a week, or just understand it
 * first. Plus where they're starting from and who they want to be. Insights holds their days against this (src/goal.ts).
 * Used in onboarding and at the top of the plan page; it edits the plan it is given and saves nothing itself.
 */
export function GoalSetup({ plan, set, baseline, onBaseline }: {
  plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void; baseline?: Baseline | null; onBaseline?: (b: Baseline | null) => void;
}) {
  const kinds: { id: GoalKind; label: string; hint: string }[] = [
    { id: "stop", label: t("goal.setup.quit"), hint: t("goal.setup.quit_hint") },
    { id: "reduce", label: t("goal.setup.cut"), hint: t("goal.setup.cut_hint") },
    { id: "understand", label: t("goal.setup.learn"), hint: t("goal.setup.learn_hint") },
  ];
  const limit = plan.limitPerWeek ?? 3;
  const pick = (g: GoalKind) => { haptic.select(); set({ goal: g, limitPerWeek: g === "reduce" ? plan.limitPerWeek ?? 3 : null }); };
  const nudge = (by: number) => { haptic.select(); set({ limitPerWeek: Math.max(1, Math.min(99, limit + by)) }); };
  return (
    <div className="stack goal-setup">
      <div className="adopt-cards" role="radiogroup" aria-label={t("goal.setup.kind_aria")}>
        {kinds.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={plan.goal === k.id} className="adopt-card" onClick={() => pick(k.id)}>
            <span className="adopt-top"><b>{k.label}</b></span>
            <span className="small muted">{k.hint}</span>
          </button>
        ))}
      </div>
      {plan.goal === "reduce" && (
        <div className="field">
          <span className="field-label" id="goal-limit">{t("goal.setup.limit_label")}</span>
          <div className="stepper" role="group" aria-labelledby="goal-limit">
            <button type="button" className="icon-btn" aria-label={t("goal.setup.less")} disabled={limit <= 1} onClick={() => nudge(-1)}>−</button>
            <output aria-live="polite" aria-label={t("goal.setup.limit_aria")}>{limit === 1 ? t("goal.setup.times_one", { n: limit }) : t("goal.setup.times_other", { n: limit })}</output>
            <button type="button" className="icon-btn" aria-label={t("goal.setup.more")} disabled={limit >= 99} onClick={() => nudge(1)}>+</button>
          </div>
        </div>
      )}
      {onBaseline && (
        <div className="field">
          <span className="field-label">{t("goal.setup.start_label")}</span>
          <Select label={t("goal.setup.start_aria")} value={baseline ?? ("" as Baseline)} options={START_OPTS} placeholder={t("goal.setup.start_choose")} onChange={(b) => onBaseline(b)} />
          <span className="muted small">{t("goal.setup.start_hint")}</span>
        </div>
      )}
      <label className="field"><span className="field-label">{t("goal.setup.identity_label")}</span>
        <GuardedInput className="input" autoComplete="off" maxLength={80} value={plan.identity ?? ""} placeholder={t("goal.setup.identity_placeholder")} aria-label={t("goal.setup.identity_aria")}
          onChange={(e) => set({ identity: e.target.value })} />
        <span className="muted small">{t("goal.setup.identity_hint")}</span>
      </label>
    </div>
  );
}

/**
 * Why it matters and where it's hard. Onboarding step one of the plan leaves out hard situations
 * (situations={false}): onboarding has just asked what sets it off, and asking twice adds nothing.
 */
export function WhySection({ plan, set, situations = true }: { plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void; situations?: boolean }) {
  return (<>
    <div className="field"><span className="field-label">{t("sheets.plan.why")}</span>
      <MultiSelect label={t("sheets.plan.reasons_aria")} options={plainOpts(REASONS)} value={plan.reasons} onChange={(reasons) => set({ reasons })} max={8} placeholder={t("sheets.plan.pick_fit")} /></div>
    {situations && <div className="field"><span className="field-label">{t("sheets.plan.hardest")}</span>
      <MultiSelect label={t("sheets.plan.hard_aria")} options={plainOpts(SITUATIONS)} value={plan.situations} onChange={(v) => set({ situations: v })} max={8} placeholder={t("sheets.plan.pick_fit")} /></div>}
  </>);
}

/** A first step and what helps. Onboarding step two of the plan. */
export function HelpSection({ plan, set, cls = "custom" }: { plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void; cls?: HabitClass }) {
  return (<>
    <div className="field">
      <span className="field-label">{t("sheets.plan.first_step")}</span>
      <SelectOther label={t("sheets.plan.first_step_aria")} options={plainOpts(FIRST_STEPS[cls])} value={plan.firstStep} onChange={(firstStep) => set({ firstStep })} maxLength={140} placeholder={t("sheets.plan.first_step_placeholder")} otherPlaceholder={t("sheets.plan.first_step_own")} />
    </div>
    <div className="field">
      <span className="field-label">{t("sheets.plan.try_first")}</span>
      <MultiSelect label={t("sheets.plan.strategies_aria")} allowOther={false} options={STRATEGIES.map((s) => ({ value: s.id, label: `${s.title}: ${s.hint}` }))}
        value={plan.strategies} onChange={(v) => set({ strategies: v as RecoveryPlan["strategies"] })} max={STRATEGIES.length} placeholder={t("sheets.plan.strategies_placeholder")} />
      <span className="muted small">{t("sheets.plan.strategies_note")}</span>
    </div>
    <label className="field"><span className="field-label">{t("sheets.plan.reach")}</span>
      <GuardedInput className="input" autoComplete="off" maxLength={40} value={plan.supportName} placeholder={t("sheets.plan.reach_placeholder")} onChange={(e) => set({ supportName: e.target.value })} />
      <span className="muted small">{t("sheets.plan.reach_note")}</span>
    </label>
  </>);
}

/**
 * One track's plan, in one editable page. It belongs to that track only: the page is given its track id and
 * saves to it, and callers remount it per track (key={habitId}), so switching tracks can never carry one
 * track's unsaved plan into another.
 */
export function PlanPage({ habitId, onSaved }: { habitId: string; onSaved?: () => void }) {
  const data = useData();
  const habit = data.habits.find((h) => h.id === habitId);
  const companion = habit && data.companions.find((c) => c.id === habit.companionId);
  const [plan, setPlan] = useState<RecoveryPlan>(() => ({ ...emptyPlan(), ...(trackState(data, habitId).plan ?? {}) }));
  const [baseline, setBaseline] = useState<Baseline | null>(() => trackState(data, habitId).baseline);
  if (!habit) return null;
  const set = (p: Partial<RecoveryPlan>) => setPlan((x) => ({ ...x, ...p }));
  const blocked = planConcern(plan) !== null;
  return (
    <div className="stack">
      <p className="track-context small"><span className="muted">{t("sheets.plan.for")}</span> <b>{habit.name}</b>{companion ? <span className="muted"> · {companion.name}</span> : null}</p>
      <p className="muted">{t("sheets.plan.intro")}</p>
      <section className="card stack" aria-label={t("goal.setup.title")}>
        <h2>{t("goal.setup.title")}</h2>
        <p className="muted small">{tt("goal.setup.intro", data.settings.tone)}</p>
        <GoalSetup plan={plan} set={set} baseline={baseline} onBaseline={setBaseline} />
      </section>
      <section className="card stack"><WhySection plan={plan} set={set} /></section>
      <section className="card stack"><HelpSection plan={plan} set={set} cls={habit.cls} /></section>
      <section className="card stack" aria-label={t("sheets.plan.if_then_aria")}>
        <h2>{t("sheets.plan.if_then")}</h2>
        {plan.ifThen.length === 0
          ? <p className="muted small">{t("sheets.plan.if_then_empty")}</p>
          : <div className="list">{plan.ifThen.map((x) => (
              <div key={x} className="item row"><span>{x}</span>
                <button className="icon-btn danger" aria-label={t("sheets.plan.remove_aria", { text: x })} onClick={() => set({ ifThen: plan.ifThen.filter((y) => y !== x) })}>{Icon.trash}</button></div>
            ))}</div>}
      </section>
      <Lessons habitId={habit.id} />
      <section className="card stack" aria-label={t("safety.support.title")}>
        <h2>{t("safety.support.title")}</h2>
        <p className="small">{t("safety.support.tool")}</p>
        <p className="small">{t("safety.support.alcohol")}</p>
        <p className="small muted">{t("safety.helplines.full")}</p>
      </section>
      <motion.div variants={rise}><Button disabled={blocked} onClick={() => { actions.updateTrack(habit.id, { plan, baseline }); haptic.success(); toast(t("sheets.plan.saved"), { kind: "good" }); onSaved?.(); }}>{t("sheets.plan.save")}</Button></motion.div>
    </div>
  );
}

/** What this track's own history shows so far: reflections after slips, triggers and ways through that worked. */
function Lessons({ habitId }: { habitId: string }) {
  const data = useData();
  const l = trackLessons(data, habitId);
  return (
    <section className="card stack" aria-label={t("sheets.plan.noticed")}>
      <h2>{t("sheets.plan.noticed")}</h2>
      {l.reflections.length === 0 && l.needed > 0 && (
        <p className="muted small">{t("sheets.plan.noticed_empty")}{l.urges > 0 ? (l.needed === 1 ? t("sheets.plan.more_one") : t("sheets.plan.more_other", { n: l.needed })) : ""}</p>
      )}
      {l.triggers.length > 0 && <p className="small"><span className="muted">{t("sheets.plan.triggers")}</span> {l.triggers.map(([t, n]) => `${t} (${n})`).join(", ")}</p>}
      {l.helped.length > 0 && <p className="small"><span className="muted">{t("sheets.plan.helped")}</span> {l.helped.map((r) => `${strategy(r.id).title} (${r.managed} of ${r.total})`).join(", ")}</p>}
      {l.reflections.length > 0 && (
        <div className="list" aria-label={t("sheets.plan.reflections_aria")}>
          {l.reflections.map((r, i) => (
            <div key={`${r.day}-${i}`} className="item stack tight">
              <span className="muted small">{fmtDay(r.day)}</span>
              {r.before && <span className="small">{t("sheets.plan.before", { text: r.before })}</span>}
              {r.adjust && <span className="small">{t("sheets.plan.next_time", { text: r.adjust })}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
