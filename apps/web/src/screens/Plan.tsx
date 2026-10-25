import { useState } from "react";
import { motion } from "motion/react";
import type { HabitClass } from "@detox/engine";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { haptic } from "../haptics";
import { rise } from "../motion";
import { FIRST_STEPS, GOALS, REASONS, SITUATIONS, STRATEGIES } from "../recovery";
import { actions, emptyPlan, useActiveView, useData } from "../store";
import { trackState } from "../tracks";
import { Button, Chip, Icon } from "../ui/Controls";
import { toast } from "../ui/Toast";
import type { RecoveryPlan } from "../types";

/** True when any free text in the plan needs the crisis message instead of being saved. */
export const planHasCrisis = (p: RecoveryPlan) =>
  [...p.reasons, ...p.situations, ...p.ifThen, p.firstStep, p.supportName].some(hasCrisisLanguage);

/** Suggestion chips plus the person's own entries, with a field to add one. Picking toggles. */
function ChipList({ label, options, value, onChange, max, placeholder }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }) {
  const [own, setOwn] = useState("");
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (x: string) => { haptic.select(); onChange(value.includes(x) ? value.filter((v) => v !== x) : [...value, x].slice(0, max)); };
  const add = () => { const t = own.trim(); if (t && !value.includes(t)) onChange([...value, t].slice(0, max)); setOwn(""); };
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chips" role="group" aria-label={label}>{all.map((x) => <Chip key={x} pressed={value.includes(x)} onClick={() => toggle(x)}>{x}</Chip>)}</div>
      <div className="inline-add">
        <input className="input" autoComplete="off" maxLength={80} value={own} placeholder={placeholder} aria-label={`${label}: add your own`}
          onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button variant="secondary" onClick={add} disabled={!own.trim()}>Add</Button>
      </div>
    </div>
  );
}

export function GoalPicker({ value, onChange }: { value: RecoveryPlan["goal"]; onChange: (g: RecoveryPlan["goal"]) => void }) {
  return (
    <div className="choice-grid" role="radiogroup" aria-label="Your goal">
      {GOALS.map((g) => (
        <motion.button key={g.id} type="button" role="radio" aria-checked={value === g.id} className="choice" whileTap={{ scale: 0.97 }}
          onClick={() => { haptic.select(); onChange(value === g.id ? null : g.id); }}>
          <b>{g.label}</b><div className="small muted">{g.hint}</div>
        </motion.button>
      ))}
    </div>
  );
}

/** Why it matters and where it's hard. Onboarding step one of the plan. */
export function WhySection({ plan, set }: { plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void }) {
  return (<>
    <div className="field"><span className="field-label">What are you aiming for?</span><GoalPicker value={plan.goal} onChange={(goal) => set({ goal })} /></div>
    <ChipList label="Why it matters to you" options={REASONS} value={plan.reasons} onChange={(reasons) => set({ reasons })} max={8} placeholder="In your own words" />
    <ChipList label="Situations that tend to be hard" options={SITUATIONS} value={plan.situations} onChange={(situations) => set({ situations })} max={8} placeholder="Another situation" />
  </>);
}

/** A first step and what helps. Onboarding step two of the plan. */
export function HelpSection({ plan, set, cls }: { plan: RecoveryPlan; set: (p: Partial<RecoveryPlan>) => void; cls: HabitClass }) {
  const toggle = (id: RecoveryPlan["strategies"][number]) => { haptic.select(); set({ strategies: plan.strategies.includes(id) ? plan.strategies.filter((s) => s !== id) : [...plan.strategies, id] }); };
  return (<>
    <div className="field">
      <span className="field-label">One small first step</span>
      <div className="chips" role="radiogroup" aria-label="Suggested first steps">
        {FIRST_STEPS[cls].map((s) => <Chip key={s} pressed={plan.firstStep === s} onClick={() => set({ firstStep: plan.firstStep === s ? "" : s })}>{s}</Chip>)}
      </div>
      <input className="input" autoComplete="off" maxLength={140} value={plan.firstStep} placeholder="Or write your own" aria-label="First step in your own words" onChange={(e) => set({ firstStep: e.target.value })} />
    </div>
    <div className="field">
      <span className="field-label">When an urge hits, what would you like to try first?</span>
      <div className="chips" role="group" aria-label="Preferred strategies">
        {STRATEGIES.map((s) => <Chip key={s.id} pressed={plan.strategies.includes(s.id)} onClick={() => toggle(s.id)}>{s.title}</Chip>)}
      </div>
      <span className="muted small">All of them stay available. These just come first.</span>
    </div>
    <label className="field"><span className="field-label">Someone you could message (optional)</span>
      <input className="input" autoComplete="off" maxLength={40} value={plan.supportName} placeholder="A first name is enough" onChange={(e) => set({ supportName: e.target.value })} />
      <span className="muted small">Only the name is kept, to remind you. Pawse never contacts anyone.</span>
    </label>
  </>);
}

/** You → Your plan: everything in one editable page. */
export function PlanPage() {
  const data = useData();
  const view = useActiveView()!;
  const habit = view.habit!;
  const [plan, setPlan] = useState<RecoveryPlan>(() => trackState(data, habit.id).plan ?? emptyPlan());
  const set = (p: Partial<RecoveryPlan>) => setPlan((x) => ({ ...x, ...p }));
  const crisis = planHasCrisis(plan);
  return (
    <div className="stack">
      <p className="muted">Your plan, in your words. Everything is optional and you can change it any time. It shapes what Pawse offers you when an urge hits and after a slip.</p>
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
      {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
      <section className="card stack" aria-label="More support">
        <h2>More support</h2>
        <p className="small">Pawse is a self-help tool, not treatment, and its AI is not a clinician. If this is affecting your health, work, money or relationships, a doctor, counsellor or support service can help, and asking is a strong move, not a failure.</p>
        <p className="small">If you drink heavily every day, don't stop suddenly without medical advice: withdrawal can be dangerous. A doctor can help you cut down safely.</p>
        <p className="small muted">Free helplines: India Tele-MANAS 14416 (mental health). US SAMHSA National Helpline 1-800-662-4357 (substance use), or call or text 988 in a crisis. UK Samaritans 116 123. Elsewhere, your local emergency number.</p>
      </section>
      <motion.div variants={rise}><Button disabled={crisis} onClick={() => { actions.savePlan(plan, habit.id); haptic.success(); toast("Plan saved", { kind: "good" }); }}>Save plan</Button></motion.div>
    </div>
  );
}
