import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LiveCompanion } from "../Companion";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { MOODS } from "../questions";
import { frictionIdeas, REPLACEMENTS, strategyOrder, urgeManagedLine } from "../recovery";
import { trackSummary } from "../progress";
import { today } from "../dates";
import { actions, useActiveView, useData } from "../store";
import { Burst, Button, Chip } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import type { StrategyId } from "../types";

/**
 * Support for an urge, in the moment. The person picks how strong it is, then any strategy, and can switch
 * whenever one isn't helping. Nothing here promises the urge ends by a set time: urges vary, and the person
 * decides when it has eased. Managed urges are counted as wins; they never change the companion's age.
 */
const BREATH: { label: string; secs: number; scale: number }[] = [
  { label: "Breathe in", secs: 4, scale: 1.18 },
  { label: "Hold", secs: 4, scale: 1.18 },
  { label: "Breathe out", secs: 6, scale: 0.9 },
];
const CYCLE = BREATH.reduce((a, b) => a + b.secs, 0);

export function UrgeSheet({ open, onClose, onSlipped }: { open: boolean; onClose: () => void; onSlipped: () => void }) {
  return <Sheet open={open} onClose={onClose} label="Support for an urge">{open && <UrgeBody onClose={onClose} onSlipped={onSlipped} />}</Sheet>;
}

function UrgeBody({ onClose, onSlipped }: { onClose: () => void; onSlipped: () => void }) {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const { tone, plan } = data.settings;
  const order = strategyOrder(plan?.strategies);
  const [phase, setPhase] = useState<"rate" | "support" | "won">("rate");
  const [strength, setStrength] = useState(3);
  const [current, setCurrent] = useState<StrategyId>(order[0].id);
  const [trigger, setTrigger] = useState("");
  const [win, setWin] = useState("");
  const managed = trackSummary(data, habit.id, today()).managedUrges;
  const crisis = hasCrisisLanguage(trigger);

  function end(outcome: "rode_it_out" | "slipped") {
    actions.recordUrge(habit.id, strength, outcome, { strategy: current, trigger: crisis ? null : trigger });
    if (outcome === "slipped") { onSlipped(); return; }
    haptic.success();
    setWin(urgeManagedLine(tone, companion.name));
    setPhase("won");
  }
  function next() {
    haptic.select();
    const i = order.findIndex((s) => s.id === current);
    setCurrent(order[(i + 1) % order.length].id);
  }

  if (phase === "rate") return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.h2 variants={rise}>Having an urge?</motion.h2>
      <motion.p className="muted" variants={rise}>Good that you noticed. You don't have to act on it, and you don't have to fight it alone.</motion.p>
      <motion.div className="field" variants={rise}>
        <span className="field-label">How strong is it?</span>
        <div className="scale-dots" role="radiogroup" aria-label="Urge strength">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} type="button" role="radio" aria-checked={strength === n} aria-label={`${n} of 5`} className="scale-dot" data-on={n <= strength}
              whileTap={{ scale: 0.85 }} transition={spring.snappy} onClick={() => { haptic.select(); setStrength(n); }}>
              {strength === n && <motion.span layoutId="urge-scale" className="scale-pill" transition={spring.snappy} />}
              <span>{n}</span>
            </motion.button>
          ))}
        </div>
        <div className="scale-ends muted small"><span>A nudge</span><span>Overwhelming</span></div>
      </motion.div>
      {plan?.reasons.length ? <motion.p className="small" variants={rise}>You said this matters because of: <b>{plan.reasons.slice(0, 3).join(", ")}</b>.</motion.p> : null}
      <motion.div className="stack tight" variants={rise}>
        <Button onClick={() => { haptic.tap(); setPhase("support"); }}>Get through it with {companion.name}</Button>
        <Button variant="text" onClick={() => end("slipped")}>I already acted on it</Button>
      </motion.div>
    </motion.div>
  );

  if (phase === "won") return (
    <motion.div className="stack center-text urge-won" variants={stagger} initial="hidden" animate="show">
      <Burst burst={1} kind="spark" count={14} />
      <motion.div variants={rise}><LiveCompanion species={companion.species} coat={companion.coat} personality={companion.personality} accessory={data.settings.wear} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={150} interactive={false} /></motion.div>
      <motion.h2 variants={rise}>{win}</motion.h2>
      <motion.p className="muted" variants={rise}>{managed} {managed === 1 ? "urge" : "urges"} managed so far. Each one is practice.</motion.p>
      <motion.div variants={rise}><Button onClick={onClose}>Back to {companion.name}</Button></motion.div>
    </motion.div>
  );

  const s = order.find((x) => x.id === current)!;
  return (
    <div className="stack urge">
      <div className="chips scroll-x" role="tablist" aria-label="Ways to get through it">
        {order.map((x) => <Chip key={x.id} pressed={x.id === current} onClick={() => { haptic.select(); setCurrent(x.id); }}>{x.title}</Chip>)}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={current} className="stack" role="tabpanel" aria-label={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.soft}>
          <h2>{s.title}</h2>
          {current !== "breathe" && <ul className="steps">{s.steps.map((t) => <li key={t}>{t}</li>)}</ul>}
          {current === "breathe" && <Breathing />}
          {current === "name" && (
            <div className="field">
              <div className="chips" role="radiogroup" aria-label="What's going on">
                {[...MOODS.map((m) => m.label), ...(plan?.situations ?? [])].map((l) => <Chip key={l} pressed={trigger === l} onClick={() => setTrigger(trigger === l ? "" : l)}>{l}</Chip>)}
              </div>
              <input className="input" autoComplete="off" maxLength={40} value={trigger} placeholder="Or in your own words" aria-label="What set it off, in your own words" onChange={(e) => setTrigger(e.target.value)} />
              {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
            </div>
          )}
          {current === "friction" && <Checklist items={frictionIdeas(habit.cls, habit.name)} />}
          {current === "replace" && <Checklist items={REPLACEMENTS} />}
          {current === "reach" && (
            <p>{plan?.supportName ? <>You named <b>{plan.supportName}</b> as someone you could message.</> : "Is there someone you could message? You can add a name in Me → Your plan."} If you ever feel unsafe, contact local emergency services.</p>
          )}
          {current === "move" && plan?.ifThen[0] && <p className="small">Your plan: {plan.ifThen[0]}</p>}
        </motion.section>
      </AnimatePresence>
      <div className="card stack tight urge-check">
        <span className="field-label">How is it now?</span>
        <Button onClick={() => end("rode_it_out")}>It's eased. I managed it</Button>
        <Button variant="secondary" onClick={next}>Still strong. Try something else</Button>
        <Button variant="text" onClick={() => end("slipped")}>I acted on it</Button>
      </div>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<string[]>([]);
  return (
    <div className="chips" role="group" aria-label="Ideas">
      {items.map((t) => <Chip key={t} pressed={done.includes(t)} onClick={() => { haptic.select(); setDone(done.includes(t) ? done.filter((x) => x !== t) : [...done, t]); }}>{t}</Chip>)}
    </div>
  );
}

/** Paced breathing, 4 in, 4 hold, 6 out, for as long as the person wants. Counts up, never down. */
function Breathing() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const reduce = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const t = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(t); }, []);
  const inCycle = elapsed % CYCLE;
  let acc = 0;
  const step = BREATH.find((b) => (acc += b.secs) > inCycle) ?? BREATH[0];
  useEffect(() => { if (!reduce) haptic.select(); }, [step.label, reduce]);
  return (
    <div className="stack center-text">
      <div className="breath">
        <motion.div className="breath-ring" animate={reduce ? undefined : { scale: step.scale }} transition={{ duration: step.secs, ease: "easeInOut" }} />
        <motion.div animate={reduce ? undefined : { scale: step.scale * 0.92 }} transition={{ duration: step.secs, ease: "easeInOut" }}>
          <LiveCompanion species={companion.species} coat={companion.coat} personality="calm" accessory={data.settings.wear} stage={view.stage} mood="idle" age={view.age} size={130} interactive={false} />
        </motion.div>
      </div>
      <AnimatePresence mode="wait"><motion.p className="breath-label" aria-live="polite" key={step.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{step.label}</motion.p></AnimatePresence>
      <p className="muted small">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} so far. Stop whenever you like.</p>
    </div>
  );
}
