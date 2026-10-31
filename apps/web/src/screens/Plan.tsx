import { useRef, useState } from "react";
import { concernInAny, hasCrisis } from "../guard";
import { t } from "../text";
import { haptic } from "../haptics";
import { FIRST_STEPS, GOALS, REASONS, SITUATIONS, STRATEGIES, strategy, trackLessons } from "../recovery";
import { fmtDay } from "../dates";
import { actions, emptyPlan, useData } from "../store";
import { trackState } from "../tracks";
import { Button, GuardedInput, Icon, MultiSelect, plainOpts, Select, SelectOther, type Opt } from "../ui/Controls";
import { toast } from "../ui/Toast";
import type { RecoveryPlan } from "../types";

const planTexts = (p: RecoveryPlan) => [...p.reasons, ...p.situations, ...p.ifThen, p.firstStep, p.supportName];

/** True when any free text in the plan needs the crisis message instead of being saved. */
export const planHasCrisis = (p: RecoveryPlan) => planTexts(p).some(hasCrisis);

/** What the plan's typed text needs before it can be saved: the crisis message, the food and weight note, or nothing. */
export const planConcern = (p: RecoveryPlan) => concernInAny(planTexts(p));

type GoalChoice = NonNullable<RecoveryPlan["goal"]> | "none";
const GOAL_OPTIONS: Opt<GoalChoice>[] = [...GOALS.map((g) => ({ value: g.id, label: `${g.label}: ${g.hint}` })), { value: "none", label: t("sheets.plan.goal_none") }];

export function GoalPicker({ value, onChange }: { value: RecoveryPlan["goal"]; onChange: (g: RecoveryPlan["goal"]) => void }) {
  return <Select label={t("sheets.plan.goal")} value={value ?? "none"} options={GOAL_OPTIONS} onChange={(g) => onChange(g === "none" ? null : g)} />;
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
  const [plan, setPlan] = useState<RecoveryPlan>(() => trackState(data, habitId).plan ?? emptyPlan());
  if (!habit) return null;
  const set = (p: Partial<RecoveryPlan>) => setPlan((x) => ({ ...x, ...p }));
  const blocked = planConcern(plan) !== null;
  const refs = { why: useRef<HTMLElement>(null), first: useRef<HTMLElement>(null), ifThen: useRef<HTMLElement>(null) };
  const missing = [
    plan.reasons.length === 0 && { k: "why" as const, label: t("sheets.plan.sec_why") },
    !plan.firstStep && { k: "first" as const, label: t("sheets.plan.sec_first") },
    plan.ifThen.length === 0 && { k: "ifThen" as const, label: t("sheets.plan.if_then") },
  ].filter((x): x is { k: "why" | "first" | "ifThen"; label: string } => !!x);
  return (
    <div className="stack sections">
      <p className="track-context small"><span className="muted">{t("sheets.plan.for")}</span> <b>{habit.name}</b>{companion ? <span className="muted"> · {companion.name}</span> : null}</p>
      <p className="muted">{t("sheets.plan.intro")}</p>
      {missing.length > 0 && (
        <section className="stack" aria-label={t("sheets.plan.finish")}>
          <h2>{t("sheets.plan.finish")}</h2>
          <div className="group-body">{missing.map((m) => (
            <button key={m.k} type="button" className="srow" onClick={() => { haptic.select(); refs[m.k].current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <span className="srow-label">{m.label}</span><span className="srow-chev" aria-hidden>{Icon.chevR}</span>
            </button>))}</div>
        </section>
      )}
      <section className="stack" aria-label={t("sheets.plan.sec_goal")}>
        <h2>{t("sheets.plan.sec_goal")}</h2>
        <div className="card stack"><div className="field"><span className="field-label">{t("sheets.plan.aiming")}</span><GoalPicker value={plan.goal} onChange={(goal) => set({ goal })} /></div></div>
      </section>
      <section ref={refs.why} className="stack plan-sec" aria-label={t("sheets.plan.sec_why")}>
        <h2>{t("sheets.plan.sec_why")}</h2>
        <div className="card stack">
          <div className="field"><span className="field-label">{t("sheets.plan.why")}</span>
            <MultiSelect label={t("sheets.plan.reasons_aria")} options={plainOpts(REASONS)} value={plan.reasons} onChange={(reasons) => set({ reasons })} max={8} placeholder={t("sheets.plan.pick_fit")} /></div>
          <div className="field"><span className="field-label">{t("sheets.plan.hardest")}</span>
            <MultiSelect label={t("sheets.plan.hard_aria")} options={plainOpts(SITUATIONS)} value={plan.situations} onChange={(v) => set({ situations: v })} max={8} placeholder={t("sheets.plan.pick_fit")} /></div>
        </div>
      </section>
      <section ref={refs.first} className="stack plan-sec" aria-label={t("sheets.plan.sec_first")}>
        <h2>{t("sheets.plan.sec_first")}</h2>
        <div className="card stack"><div className="field">
          <span className="field-label">{t("sheets.plan.first_step")}</span>
          <SelectOther label={t("sheets.plan.first_step_aria")} options={plainOpts(FIRST_STEPS[habit.cls])} value={plan.firstStep} onChange={(firstStep) => set({ firstStep })} maxLength={140} placeholder={t("sheets.plan.first_step_placeholder")} otherPlaceholder={t("sheets.plan.first_step_own")} />
        </div></div>
      </section>
      <section ref={refs.ifThen} className="stack plan-sec" aria-label={t("sheets.plan.if_then_aria")}>
        <h2>{t("sheets.plan.if_then")}</h2>
        {plan.ifThen.length === 0
          ? <p className="muted small">{t("sheets.plan.if_then_empty")}</p>
          : <div className="card list">{plan.ifThen.map((x) => (
              <div key={x} className="item row"><span>{x}</span>
                <button className="icon-btn danger" aria-label={t("sheets.plan.remove_aria", { text: x })} onClick={() => set({ ifThen: plan.ifThen.filter((y) => y !== x) })}>{Icon.trash}</button></div>
            ))}</div>}
      </section>
      <section className="stack" aria-label={t("sheets.plan.sec_helps")}>
        <h2>{t("sheets.plan.sec_helps")}</h2>
        <div className="card stack"><div className="field">
          <span className="field-label">{t("sheets.plan.try_first")}</span>
          <MultiSelect label={t("sheets.plan.strategies_aria")} allowOther={false} options={STRATEGIES.map((s) => ({ value: s.id, label: `${s.title}: ${s.hint}` }))}
            value={plan.strategies} onChange={(v) => set({ strategies: v as RecoveryPlan["strategies"] })} max={STRATEGIES.length} placeholder={t("sheets.plan.strategies_placeholder")} />
          <span className="muted small">{t("sheets.plan.strategies_note")}</span>
        </div></div>
      </section>
      <section className="stack" aria-label={t("safety.support.title")}>
        <h2>{t("sheets.plan.sec_support")}</h2>
        <div className="card stack">
          <label className="field"><span className="field-label">{t("sheets.plan.reach")}</span>
            <GuardedInput className="input" autoComplete="off" maxLength={40} value={plan.supportName} placeholder={t("sheets.plan.reach_placeholder")} onChange={(e) => set({ supportName: e.target.value })} />
            <span className="muted small">{t("sheets.plan.reach_note")}</span>
          </label>
          <p className="small">{t("safety.support.tool")}</p>
          <p className="small">{t("safety.support.alcohol")}</p>
          <p className="small muted">{t("safety.helplines.full")}</p>
        </div>
      </section>
      <Lessons habitId={habit.id} />
      <Button disabled={blocked} onClick={() => { actions.savePlan(plan, habit.id); haptic.success(); toast(t("sheets.plan.saved"), { kind: "good" }); onSaved?.(); }}>{t("sheets.plan.save")}</Button>
    </div>
  );
}

/** What this track's own history shows so far: reflections after slips, triggers and ways through that worked. */
function Lessons({ habitId }: { habitId: string }) {
  const data = useData();
  const l = trackLessons(data, habitId);
  return (
    <section className="stack" aria-label={t("sheets.plan.noticed")}>
      <h2>{t("sheets.plan.noticed")}</h2>
      <div className="card stack">
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
      </div>
    </section>
  );
}
