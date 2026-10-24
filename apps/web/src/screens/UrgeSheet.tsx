import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LiveCompanion } from "../Companion";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { actions, useActiveView, useData } from "../store";
import { Burst, Button } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { say } from "../voice";

/**
 * Urge surfing: cravings rise, peak and fall, usually within minutes, whether or not you act on them.
 * Two minutes of paced breathing with the companion, then an honest answer about how it ended.
 * Ridden-out urges are counted as wins; they never change the companion's age.
 */
const LENGTH = 120;
const BREATH: { label: string; secs: number; scale: number }[] = [
  { label: "Breathe in", secs: 4, scale: 1.18 },
  { label: "Hold", secs: 4, scale: 1.18 },
  { label: "Breathe out", secs: 6, scale: 0.9 },
];
const CYCLE = BREATH.reduce((a, b) => a + b.secs, 0);

export function UrgeSheet({ open, onClose, onSlipped }: { open: boolean; onClose: () => void; onSlipped: () => void }) {
  return <Sheet open={open} onClose={onClose} label="Ride out an urge">{open && <UrgeBody onClose={onClose} onSlipped={onSlipped} />}</Sheet>;
}

function UrgeBody({ onClose, onSlipped }: { onClose: () => void; onSlipped: () => void }) {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const { tone } = data.settings;
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"rate" | "breathe" | "won">("rate");
  const [strength, setStrength] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [line] = useState(() => say("urgeStart", companion.personality, tone));
  const [win, setWin] = useState("");
  const ridden = data.urges.filter((u) => u.habitId === habit.id && u.outcome === "rode_it_out").length;

  useEffect(() => {
    if (phase !== "breathe") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => { if (phase === "breathe" && elapsed >= LENGTH) haptic.success(); }, [phase, elapsed]);

  const inCycle = elapsed % CYCLE;
  let acc = 0;
  const step = BREATH.find((b) => (acc += b.secs) > inCycle) ?? BREATH[0];
  useEffect(() => { if (phase === "breathe" && !reduce) haptic.select(); }, [step.label, phase, reduce]);
  const left = Math.max(0, LENGTH - elapsed);

  function passed() {
    actions.recordUrge(habit.id, strength, "rode_it_out");
    haptic.success();
    setWin(say("rodeOut", companion.personality, tone));
    setPhase("won");
  }
  function slipped() {
    actions.recordUrge(habit.id, strength, "slipped");
    onSlipped();
  }

  if (phase === "rate") return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.h2 variants={rise}>Having an urge?</motion.h2>
      <motion.p className="muted" variants={rise}>Good that you noticed. Urges rise, peak and fade, usually within minutes. You don't have to act on this one.</motion.p>
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
      <motion.div variants={rise}><Button onClick={() => { haptic.tap(); setPhase("breathe"); }}>Ride it out with {companion.name}</Button></motion.div>
    </motion.div>
  );

  if (phase === "won") return (
    <motion.div className="stack center-text urge-won" variants={stagger} initial="hidden" animate="show">
      <Burst burst={1} kind="spark" count={14} />
      <motion.div variants={rise}><LiveCompanion species={companion.species} coat={companion.coat} personality={companion.personality} accessory={data.settings.wear} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={150} interactive={false} /></motion.div>
      <motion.h2 variants={rise}>{win}</motion.h2>
      <motion.p className="muted" variants={rise}>{ridden} {ridden === 1 ? "urge" : "urges"} ridden out so far. Each one makes the next a little quieter.</motion.p>
      <motion.div variants={rise}><Button onClick={onClose}>Back to {companion.name}</Button></motion.div>
    </motion.div>
  );

  return (
    <div className="stack center-text urge">
      <p className="speech urge-speech">{line}</p>
      <div className="breath">
        <motion.div className="breath-ring" animate={reduce ? undefined : { scale: step.scale }} transition={{ duration: step.secs, ease: "easeInOut" }} />
        <motion.div animate={reduce ? undefined : { scale: step.scale * 0.92 }} transition={{ duration: step.secs, ease: "easeInOut" }}>
          <LiveCompanion species={companion.species} coat={companion.coat} personality="calm" accessory={data.settings.wear} stage={view.stage} mood="idle" age={view.age} size={150} interactive={false} />
        </motion.div>
      </div>
      <AnimatePresence mode="wait"><motion.h2 key={step.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{step.label}</motion.h2></AnimatePresence>
      <p className="muted small" aria-live="polite">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left` : "Two minutes done. How is it now?"}</p>
      <div className="progress" aria-hidden><motion.i animate={{ width: `${(elapsed / LENGTH) * 100}%` }} transition={{ duration: 1, ease: "linear" }} /></div>
      <Button onClick={passed} disabled={elapsed < 20}>{elapsed < 20 ? "Stay a little longer…" : "It passed"}</Button>
      <Button variant="text" onClick={slipped}>I gave in</Button>
    </div>
  );
}
