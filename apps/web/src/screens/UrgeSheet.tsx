import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LiveCompanion } from "../Companion";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { frictionIdeas, REPLACEMENTS, strategy, strategyOrder, urgeActedLine, urgeActedNote, urgeDetails, urgeManagedLine, urgePauseLine, withStrategyFirst } from "../recovery";
import { trackSummary } from "../progress";
import { today } from "../dates";
import { actions, useActiveView, useData } from "../store";
import { trackState } from "../tracks";
import { Burst, Button, Chip } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import type { StrategyId } from "../types";

/**
 * Support for an urge, in the moment: a pause, what's going on (optional), a way through, and how it went. The
 * person can switch strategy whenever one isn't helping and close the sheet at any step. "I acted on it" saves the
 * urge as a check-in and then only offers the slip sheet: nothing becomes a slip unless the person logs one. Nothing here promises the urge ends by a set time: urges vary, and the person
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
  const { tone } = data.settings;
  const track = trackState(data, habit.id);
  const { plan } = track;
  const order = strategyOrder(plan?.strategies);
  // pause: notice it and say what's going on. support: a way through. won: it eased. acted: they acted on it.
  const [phase, setPhase] = useState<"pause" | "support" | "won" | "acted">("pause");
  const [strength, setStrength] = useState(3);
  const [current, setCurrent] = useState<StrategyId>(order[0].id);
  const [trigger, setTrigger] = useState("");
  const [win, setWin] = useState("");
  const [helped, setHelped] = useState<StrategyId | null>(null);
  const managed = trackSummary(data, habit.id, today()).managedUrges;
  const crisis = hasCrisisLanguage(trigger);
  const situations = plan?.situations ?? [];

  function end(outcome: "rode_it_out" | "slipped") {
    if (crisis) return;
    const supported = phase === "support";
    actions.recordUrge(habit.id, strength, outcome, urgeDetails({ supported, strategy: current, trigger, crisis }));
    // Acting on an urge is a check-in, never a slip: the slip sheet is only offered, on the next step.
    if (outcome === "slipped") { haptic.select(); setPhase("acted"); return; }
    haptic.success();
    setWin(urgeManagedLine(tone, companion.name));
    setHelped(supported && plan?.strategies[0] !== current ? current : null);
    setPhase("won");
  }
  function next() {
    haptic.select();
    const i = order.findIndex((s) => s.id === current);
    setCurrent(order[(i + 1) % order.length].id);
  }
  const context = <p className="muted small track-context">For <b>{habit.name}</b> · {companion.name}</p>;

  if (phase === "pause") return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.div className="stack tight" variants={rise}><h2>Having an urge?</h2>{context}</motion.div>
      <motion.p className="muted" variants={rise}>{urgePauseLine(tone)}</motion.p>
      <motion.div className="field" variants={rise}>
        <span className="field-label" id="urge-strength">How strong is it?</span>
        <div className="scale-dots" role="radiogroup" aria-labelledby="urge-strength">
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
      <motion.div className="field" variants={rise}>
        <span className="field-label" id="urge-what">What's going on? (optional)</span>
        {situations.length > 0 && <div className="chips" role="group" aria-labelledby="urge-what">
          {situations.map((l) => <Chip key={l} pressed={trigger === l} onClick={() => { haptic.select(); setTrigger(trigger === l ? "" : l); }}>{l}</Chip>)}
        </div>}
        <input className="input" autoComplete="off" maxLength={40} value={situations.includes(trigger) ? "" : trigger} placeholder="In your own words" aria-label="What's going on, in your own words" onChange={(e) => setTrigger(e.target.value)} />
        {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
      </motion.div>
      {plan?.reasons.length ? <motion.p className="small" variants={rise}>You said this matters because of: <b>{plan.reasons.slice(0, 3).join(", ")}</b>.</motion.p> : null}
      <motion.div className="stack tight" variants={rise}>
        <Button disabled={crisis} onClick={() => { haptic.tap(); setPhase("support"); }}>Help me through it</Button>
        <Button variant="text" disabled={crisis} onClick={() => end("slipped")}>I already acted on it</Button>
        <Button variant="text" onClick={onClose}>Close</Button>
      </motion.div>
    </motion.div>
  );

  if (phase === "acted") return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.h2 variants={rise}>{urgeActedLine(tone)}</motion.h2>
      <motion.p className="muted" variants={rise}>{urgeActedNote(tone)}</motion.p>
      {plan?.ifThen[0] && <motion.p className="small" variants={rise}>Your plan for next time: {plan.ifThen[0]}</motion.p>}
      <motion.div className="stack tight" variants={rise}>
        <Button variant="secondary" onClick={onSlipped}>Log it as a slip</Button>
        <Button variant="text" onClick={onClose}>Not now</Button>
      </motion.div>
    </motion.div>
  );

  if (phase === "won") return (
    <motion.div className="stack center-text urge-won" variants={stagger} initial="hidden" animate="show">
      <Burst burst={1} kind="spark" count={14} />
      <motion.div variants={rise}><LiveCompanion species={companion.species} coat={companion.coat} personality={companion.personality} accessory={track.wear} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={150} interactive={false} /></motion.div>
      <motion.h2 variants={rise}>{win}</motion.h2>
      <motion.p className="muted" variants={rise}>{managed} {managed === 1 ? "urge" : "urges"} managed so far on this track. Each one is practice.</motion.p>
      {helped && (
        <motion.div variants={rise}>
          <Button variant="secondary" onClick={() => { actions.savePlan(withStrategyFirst(plan, helped), habit.id); haptic.success(); setHelped(null); toast("Added to your plan", { kind: "good" }); }}>
            Offer "{strategy(helped).title}" first next time
          </Button>
        </motion.div>
      )}
      <motion.div variants={rise}><Button onClick={onClose}>Back to {companion.name}</Button></motion.div>
    </motion.div>
  );

  const s = order.find((x) => x.id === current)!;
  return (
    <div className="stack urge">
      {context}
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
              <div className="chips" role="group" aria-label="What's going on">
                {situations.map((l) => <Chip key={l} pressed={trigger === l} onClick={() => setTrigger(trigger === l ? "" : l)}>{l}</Chip>)}
              </div>
              <input className="input" autoComplete="off" maxLength={40} value={situations.includes(trigger) ? "" : trigger} placeholder="Or in your own words" aria-label="What set it off, in your own words" onChange={(e) => setTrigger(e.target.value)} />
              {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
            </div>
          )}
          {current === "friction" && <Checklist items={frictionIdeas(habit.cls, habit.name)} />}
          {current === "replace" && <Checklist items={REPLACEMENTS} />}
          {current === "reach" && (
            <p>{plan?.supportName ? <>You named <b>{plan.supportName}</b> as someone you could message.</> : "Is there someone you could message? You can add a name to this track's plan."} If you ever feel unsafe, contact local emergency services.</p>
          )}
          {plan?.ifThen[0] && (current === "move" || current === "observe") && <p className="small">Your plan: {plan.ifThen[0]}</p>}
        </motion.section>
      </AnimatePresence>
      <div className="card stack tight urge-check">
        <span className="field-label">How is it now?</span>
        <Button disabled={crisis} onClick={() => end("rode_it_out")}>It's eased. I managed it</Button>
        <Button variant="secondary" onClick={next}>Still strong. Try something else</Button>
        <Button variant="text" disabled={crisis} onClick={() => end("slipped")}>I acted on it</Button>
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
          <LiveCompanion species={companion.species} coat={companion.coat} personality="calm" accessory={trackState(data, view.habit!.id).wear} stage={view.stage} mood="idle" age={view.age} size={130} interactive={false} />
        </motion.div>
      </div>
      <AnimatePresence mode="wait"><motion.p className="breath-label" aria-live="polite" key={step.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{step.label}</motion.p></AnimatePresence>
      <p className="muted small">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} so far. Stop whenever you like.</p>
    </div>
  );
}
