import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { baselineMonths, computeSeverity, simulate, STAGE_LABEL, type DayInput } from "@detox/engine";
import { LiveCompanion, moodFor } from "../Companion";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Button, Icon, Segmented } from "../ui/Controls";
import type { Habit, Species } from "../types";

/**
 * A sandbox that plays a life forward, one simulated day per tick, with the real engine.
 * It never reads or writes the person's logs.
 */

type Pattern = "light" | "daily" | "heavy" | "random" | "recover";
const PATTERNS: { value: Pattern; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "2 slips a week" },
  { value: "daily", label: "Daily", hint: "1 slip a day" },
  { value: "heavy", label: "Heavy", hint: "3 slips a day" },
  { value: "random", label: "Mixed", hint: "Good and bad days" },
  { value: "recover", label: "Recover", hint: "A rough week, two good months, then a one-off slip and a binge" },
];
const SPEEDS = [{ value: "2000", label: "2s" }, { value: "1000", label: "1s" }, { value: "400", label: "Fast" }, { value: "100", label: "Max" }];

/** Slips for simulated day i. Light, daily and heavy match the PRD 5.3 pacing table. */
function dayFor(p: Pattern, i: number, weight: number, rnd: () => number): number[] {
  if (p === "recover") {
    const n = i < 7 ? 2 : i === 70 ? 1 : i === 90 ? 3 : 0;
    return Array.from({ length: n }, (_, k) => baselineMonths(1, k + 1));
  }
  const n = p === "light" ? (i % 7 === 2 || i % 7 === 5 ? 1 : 0) : p === "daily" ? 1 : p === "heavy" ? 3 : [0, 0, 0, 1, 1, 2, 3][Math.floor(rnd() * 7)];
  const severity = p === "heavy" ? 1.5 : p === "random" ? computeSeverity({ classWeight: weight, triggers: Math.floor(rnd() * 3) }) : 1;
  return Array.from({ length: n }, (_, k) => baselineMonths(severity, k + 1));
}

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export function Simulator({ open, onClose, species, coat, name, habit }: { open: boolean; onClose: () => void; species: Species; coat?: string; name: string; habit: Habit }) {
  const [pattern, setPattern] = useState<Pattern>("heavy");
  const [speed, setSpeed] = useState("2000");
  const [days, setDays] = useState<DayInput[]>([]);
  const [playing, setPlaying] = useState(false);
  const rnd = useRef(seeded(7));

  const states = useMemo(() => simulate(days), [days]);
  const cur = states[states.length - 1];
  const age = cur?.visibleAge ?? 0;
  const dead = (cur?.stage ?? "baby") === "dead";
  const today = days[days.length - 1];

  function reset(p = pattern) { setDays([]); setPlaying(false); rnd.current = seeded(7); setPattern(p); }

  useEffect(() => {
    if (!open || !playing || dead) return;
    const t = setInterval(() => {
      setDays((ds) => {
        const i = ds.length;
        const damage = dayFor(pattern, i, habit.classWeight, rnd.current);
        if (damage.length) haptic.tap();
        return [...ds, { day: String(i + 1), damage, clean: damage.length === 0 }];
      });
    }, Number(speed));
    return () => clearInterval(t);
  }, [open, playing, dead, pattern, speed, habit.classWeight]);

  useEffect(() => { if (dead) { setPlaying(false); haptic.heavy(); } }, [dead]);
  useEffect(() => { if (!open) setPlaying(false); }, [open]);

  const mood = dead ? "dying" : moodFor(cur?.stage ?? "baby", { checkedToday: true, slippedToday: !!today?.damage.length, justLogged: today?.damage.length ? "slip" : today ? "clean" : null, age });
  const W = 320, H = 60;
  const pts = states.map((s, i) => `${(i / Math.max(1, states.length - 1)) * W},${H - (s.visibleAge / 100) * (H - 4) - 2}`).join(" ");
  const recent = states.slice(-5).reverse();
  const lost = states.reduce((a, s) => a + s.damageMonths, 0);
  const healed = states.reduce((a, s) => a + s.healedMonths, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sim" role="dialog" aria-modal="true" aria-label="Simulation"
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={spring.soft}>
          <div className="screen">
            <div className="row">
              <div><p className="muted small">Simulation · nothing here touches your logs</p><h1>A life in fast forward</h1></div>
              <button className="icon-btn" aria-label="Close simulation" onClick={onClose}>{Icon.close}</button>
            </div>

            <section className={`hero sim-hero${age >= 80 ? " hero-danger" : ""}`}>
              <div className="hero-name"><h2>{name}</h2><span className="stage-tag">{STAGE_LABEL[cur?.stage ?? "baby"]}</span></div>
              <motion.div animate={{ opacity: dead ? 0.55 : 1, filter: dead ? "grayscale(0.8)" : "grayscale(0)" }} transition={{ duration: 1.2 }}>
                <LiveCompanion species={species} coat={coat} stage={cur?.stage === "dead" ? "frail" : cur?.stage ?? "baby"} mood={mood} age={age} size={170} interactive={false} />
              </motion.div>
              <AnimatePresence mode="wait">
                <motion.p key={days.length} className="speech" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  {!today ? `Day 0. ${name} is brand new.`
                    : dead ? `${name} died on day ${days.length}.`
                      : today.damage.length && cur.absorbedMonths > 0 && cur.damageMonths < 0.05 ? `Day ${days.length}: a slip, but ${name} shrugged it off. Good days built a cushion.`
                      : today.damage.length ? `Day ${days.length}: ${today.damage.length} ${today.damage.length === 1 ? "slip" : "slips"}, −${(cur.damageMonths).toFixed(1)} months${cur.binge ? ". Binge: part of it scars for good" : ""}${cur.absorbedMonths > 0 ? ` (${cur.absorbedMonths.toFixed(1)} absorbed)` : ""}`
                        : cur.healedMonths > 0 ? `Day ${days.length}: goal met, healed ${cur.healedMonths.toFixed(1)} months` : `Day ${days.length}: goal met, but scars don't heal`}
                </motion.p>
              </AnimatePresence>
              <div className="agetext"><span>Day <b><AnimatedNumber value={days.length} /></b></span><span>Age <b><AnimatedNumber value={Math.round(age)} /></b> of 100</span></div>
              <div className={`agebar${age >= 80 ? " danger" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(age)} aria-label="Simulated age">
                <motion.i initial={false} animate={{ width: `${Math.max(1.5, age)}%` }} transition={spring.calm} />
              </div>
            </section>

            <div className="actions">
              {dead
                ? <Button onClick={() => reset()}>Run again</Button>
                : <Button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : days.length ? "Resume" : "Start"}</Button>}
              <Button variant="secondary" onClick={() => reset()} disabled={!days.length}>Reset</Button>
            </div>

            <section className="card stack">
              <span className="field-label">Pattern</span>
              <Segmented label="Pattern" value={pattern} onChange={(p) => reset(p)} options={PATTERNS.map((p) => ({ value: p.value, label: p.label }))} />
              <p className="muted small">{PATTERNS.find((p) => p.value === pattern)!.hint}. Days without a slip count as clean and heal, down to the scar floor.</p>
              <span className="field-label">One day every</span>
              <Segmented label="Speed" value={speed} onChange={setSpeed} options={SPEEDS} />
            </section>

            <section className="card stack">
              <div className="row"><h2>Age curve</h2><span className="muted small">{lost.toFixed(0)} months lost · {healed.toFixed(0)} healed</span></div>
              {states.length > 1
                ? <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Simulated age over time">
                    {[70, 80].map((a) => <line key={a} x1="0" x2={W} y1={H - (a / 100) * (H - 4) - 2} y2={H - (a / 100) * (H - 4) - 2} stroke="var(--negative)" strokeOpacity=".25" strokeDasharray="3 4" />)}
                    <polyline points={pts} fill="none" stroke="var(--chart)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                : <p className="muted small">Press Start to watch the curve draw.</p>}
              <div className="list">
                <AnimatePresence initial={false}>
                  {recent.map((s) => (
                    <motion.div key={s.day} layout className="item sim-row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <span>Day {s.day}</span>
                      <span className={s.damageMonths ? "neg" : "muted"}>{s.damageMonths ? `−${s.damageMonths.toFixed(1)} mo` : s.absorbedMonths ? "shrugged off" : s.healedMonths ? `+${s.healedMonths.toFixed(1)} mo` : "clean"}</span>
                      <b>{s.visibleAge.toFixed(1)}</b>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
