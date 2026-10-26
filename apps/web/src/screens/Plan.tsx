import { useState } from "react";
import { motion } from "motion/react";
import type { HabitClass } from "@detox/engine";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { haptic } from "../haptics";
import { rise } from "../motion";
import { FIRST_STEPS, GOALS, REASONS, SITUATIONS, STRATEGIES, strategy, trackLessons } from "../recovery";
import { fmtDay } from "../dates";
import { actions, emptyPlan, useData } from "../store";
import { trackState } from "../tracks";
import { Button, Icon, MultiSelect, plainOpts, Select, SelectOther, type Opt } from "../ui/Controls";
import { toast } from "../ui/Toast";
import type { RecoveryPlan } from "../types";

/** True when any free text in the plan needs the crisis message instead of being saved. */
export const planHasCrisis = (p: RecoveryPlan) =>
  [...p.reasons, ...p.situations, ...p.ifThen, p.firstStep, p.supportName].some(hasCrisisLanguage);

type GoalChoice = NonNullable<RecoveryPlan["goal"]> | "none";
const GOAL_OPTIONS: Opt<GoalChoice>[] = [...GOALS.map((g) => ({ value: g.id, label: `${g.label}: ${g.hint}` })), { value: "none", label: "Not sure yet" }];

export function GoalPicker({ value, onChange }: { value: RecoveryPlan["goal"]; onChange: (g: RecoveryPlan["goal"]) => void }) {
  return <Select label="Your goal" value={value ?? "none"} options={GOAL_OPTIONS} onChange={(g) => onChange(g === "none" ? null : g)} />;
}

/**
 * Why it matters and where it's hard. Onboarding step one of the plan leaves out hard situations
 * (situations={false}): onboarding has just asked what sets it off, and asking twice adds nothing.
 */
export function WhySection({ plan, set, situations = true }: { plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void; situations?: boolean }) {
  return (<>
    <div className="field"><span className="field-label">What are you aiming for?</span><GoalPicker value={plan.goal} onChange={(goal) => set({ goal })} /></div>
    <div className="field"><span className="field-label">Why does this matter to you?</span>
      <MultiSelect label="Reasons" options={plainOpts(REASONS)} value={plan.reasons} onChange={(reasons) => set({ reasons })} max={8} placeholder="Pick the ones that fit" /></div>
    {situations && <div className="field"><span className="field-label">When is it hardest?</span>
      <MultiSelect label="Hard situations" options={plainOpts(SITUATIONS)} value={plan.situations} onChange={(v) => set({ situations: v })} max={8} placeholder="Pick the ones that fit" /></div>}
  </>);
}

/** A first step and what helps. Onboarding step two of the plan. */
export function HelpSection({ plan, set, cls = "custom" }: { plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void; cls?: HabitClass }) {
  return (<>
    <div className="field">
      <span className="field-label">One small first step</span>
      <SelectOther label="First step" options={plainOpts(FIRST_STEPS[cls])} value={plan.firstStep} onChange={(firstStep) => set({ firstStep })} maxLength={140} placeholder="Pick something small" otherPlaceholder="Write your own first step" />
    </div>
    <div className="field">
      <span className="field-label">When an urge hits, what would you like to try first?</span>
      <MultiSelect label="Preferred strategies" allowOther={false} options={STRATEGIES.map((s) => ({ value: s.id, label: `${s.title}: ${s.hint}` }))}
        value={plan.strategies} onChange={(v) => set({ strategies: v as RecoveryPlan["strategies"] })} max={STRATEGIES.length} placeholder="Pick the ones you like" />
      <span className="muted small">All of them stay available. These just come first.</span>
    </div>
    <label className="field"><span className="field-label">Someone you could reach out to (optional)</span>
      <input className="input" autoComplete="off" maxLength={40} value={plan.supportName} placeholder="A first name is enough" onChange={(e) => set({ supportName: e.target.value })} />
      <span className="muted small">Only the name is kept, to remind you. pawse never contacts anyone.</span>
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
  const [plan, setPlan] = useState<RecoveryPlan>(() => trackState(data, habitId).plan ?? emptyPlan());
  if (!habit) return null;
  const set = (p: Partial<RecoveryPlan>) => setPlan((x) => ({ ...x, ...p }));
  const crisis = planHasCrisis(plan);
  return (
    <div className="stack">
      <p className="track-context small"><span className="muted">For</span> <b>{habit.name}</b>{companion ? <span className="muted"> · {companion.name}</span> : null}</p>
      <p className="muted">Your plan, in your words. Everything is optional and you can change it any time. It shapes what pawse offers you when an urge hits and after a slip.</p>
      <section className="card stack"><WhySection plan={plan} set={set} /></section>
      <section className="card stack"><HelpSection plan={plan} set={set} cls={habit.cls} /></section>
      <section className="card stack" aria-label="If-then plans">
        <h2>If-then plans</h2>
        {plan.ifThen.length === 0
          ? <p className="muted small">None yet. After a slip or a weekly review you can add one, like "If I'm home alone after 10, then I'll make tea and text Asha."</p>
          : <div className="list">{plan.ifThen.map((x) => (
              <div key={x} className="item row"><span>{x}</span>
                <button className="icon-btn danger" aria-label={`Remove: ${x}`} onClick={() => set({ ifThen: plan.ifThen.filter((y) => y !== x) })}>{Icon.trash}</button></div>
            ))}</div>}
      </section>
      <Lessons habitId={habit.id} />
      {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
      <section className="card stack" aria-label="More support">
        <h2>More support</h2>
        <p className="small">pawse is a self-help tool, not treatment, and its AI is not a clinician. If this is affecting your health, work, money or relationships, a doctor, counselor or support service can help, and asking is a strong move, not a failure.</p>
        <p className="small">If you drink heavily every day, don't stop suddenly without medical advice: withdrawal can be dangerous. A doctor can help you cut down safely.</p>
        <p className="small muted">Free helplines: India Tele-MANAS 14416 (mental health). US SAMHSA National Helpline 1-800-662-4357 (substance use), or call or text 988 in a crisis. UK Samaritans 116 123. Elsewhere, your local emergency number.</p>
      </section>
      <motion.div variants={rise}><Button disabled={crisis} onClick={() => { actions.savePlan(plan, habit.id); haptic.success(); toast("Plan saved", { kind: "good" }); onSaved?.(); }}>Save plan</Button></motion.div>
    </div>
  );
}

/** What this track's own history shows so far: reflections after slips, triggers and ways through that worked. */
function Lessons({ habitId }: { habitId: string }) {
  const data = useData();
  const l = trackLessons(data, habitId);
  return (
    <section className="card stack" aria-label="What you've noticed">
      <h2>What you've noticed</h2>
      {l.reflections.length === 0 && l.needed > 0 && (
        <p className="muted small">Nothing here yet. Reflections after a slip, and what set off your urges, collect here for this track.{l.urges > 0 ? ` ${l.needed} more ${l.needed === 1 ? "urge" : "urges"} before patterns show.` : ""}</p>
      )}
      {l.triggers.length > 0 && <p className="small"><span className="muted">Urges often came with:</span> {l.triggers.map(([t, n]) => `${t} (${n})`).join(", ")}</p>}
      {l.helped.length > 0 && <p className="small"><span className="muted">Helped you through:</span> {l.helped.map((r) => `${strategy(r.id).title} (${r.managed} of ${r.total})`).join(", ")}</p>}
      {l.reflections.length > 0 && (
        <div className="list" aria-label="Reflections after slips">
          {l.reflections.map((r, i) => (
            <div key={`${r.day}-${i}`} className="item stack tight">
              <span className="muted small">{fmtDay(r.day)}</span>
              {r.before && <span className="small">Before: {r.before}</span>}
              {r.adjust && <span className="small">Next time: {r.adjust}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
