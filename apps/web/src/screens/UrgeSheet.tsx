import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LiveCompanion } from "../Companion";
import { concernIn } from "../guard";
import { t } from "../text";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { frictionIdeas, REPLACEMENTS, SITUATIONS, strategy, strategyOrder, urgeActedLine, urgeActedNote, urgeDetails, urgeManagedLine, urgePauseLine, withStrategyFirst } from "../recovery";
import { trackSummary } from "../progress";
import { today } from "../dates";
import { actions, useActiveView, useData } from "../store";
import { trackState } from "../tracks";
import { Burst, Button, plainOpts, Select, SelectOther } from "../ui/Controls";
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
  { label: t("sheets.urge.breathe_in"), secs: 4, scale: 1.18 },
  { label: t("sheets.urge.hold"), secs: 4, scale: 1.18 },
  { label: t("sheets.urge.breathe_out"), secs: 6, scale: 0.9 },
];
const CYCLE = BREATH.reduce((a, b) => a + b.secs, 0);

export function UrgeSheet({ open, onClose, onSlipped }: { open: boolean; onClose: () => void; onSlipped: () => void }) {
  return <Sheet open={open} onClose={onClose} label={t("sheets.urge.label")}>{open && <UrgeBody onClose={onClose} onSlipped={onSlipped} />}</Sheet>;
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
  const crisis = concernIn(trigger) !== null;
  // The plan's own situations first, then common ones, so the list is never empty. Anything else can be typed.
  const situations = [...new Set([...(plan?.situations ?? []), ...SITUATIONS])];

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
  const context = <p className="muted small track-context">{t("sheets.urge.context", { track: habit.name, name: companion.name })}</p>;

  if (phase === "pause") return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.div className="stack tight" variants={rise}><h2>{t("sheets.urge.title")}</h2>{context}</motion.div>
      <motion.p className="muted" variants={rise}>{urgePauseLine(tone)}</motion.p>
      <motion.div className="field" variants={rise}>
        <span className="field-label" id="urge-strength">{t("sheets.urge.strength")}</span>
        <Select label={t("sheets.urge.strength")} value={String(strength)} onChange={(v) => setStrength(Number(v))}
          options={[{ value: "1", label: t("sheets.urge.s1") }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: t("sheets.urge.s5") }]} />
      </motion.div>
      <motion.div className="field" variants={rise}>
        <span className="field-label" id="urge-what">{t("sheets.urge.going_on")}</span>
        <SelectOther label={t("sheets.urge.going_on_aria")} options={plainOpts(situations)} value={trigger} onChange={setTrigger} maxLength={40} placeholder={t("sheets.urge.choose_fit")} clearLabel={t("sheets.urge.not_sure")} otherPlaceholder={t("sheets.urge.own")} />
      </motion.div>
      {plan?.reasons.length ? <motion.p className="small" variants={rise}>{t("sheets.urge.reasons", { reasons: plan.reasons.slice(0, 3).join(", ") })}</motion.p> : null}
      <motion.div className="stack tight" variants={rise}>
        <Button disabled={crisis} onClick={() => { haptic.tap(); setPhase("support"); }}>{t("sheets.urge.help")}</Button>
        <Button variant="text" disabled={crisis} onClick={() => end("slipped")}>{t("sheets.urge.already")}</Button>
        <Button variant="text" onClick={onClose}>{t("sheets.urge.close")}</Button>
      </motion.div>
    </motion.div>
  );

  if (phase === "acted") return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.h2 variants={rise}>{urgeActedLine(tone)}</motion.h2>
      <motion.p className="muted" variants={rise}>{urgeActedNote(tone)}</motion.p>
      {plan?.ifThen[0] && <motion.p className="small" variants={rise}>{t("sheets.urge.plan_next", { text: plan.ifThen[0] })}</motion.p>}
      <motion.div className="stack tight" variants={rise}>
        <Button variant="secondary" onClick={onSlipped}>{t("sheets.urge.log_slip")}</Button>
        <Button variant="text" onClick={onClose}>{t("sheets.urge.not_now")}</Button>
      </motion.div>
    </motion.div>
  );

  if (phase === "won") return (
    <motion.div className="stack center-text urge-won" variants={stagger} initial="hidden" animate="show">
      <Burst burst={1} kind="spark" count={14} />
      <motion.div variants={rise}><LiveCompanion species={companion.species} coat={companion.coat} personality={companion.personality} accessory={track.wear} stage={view.stage} mood="happy" gesture="hop" age={view.age} size={150} interactive={false} /></motion.div>
      <motion.h2 variants={rise}>{win}</motion.h2>
      <motion.p className="muted" variants={rise}>{managed === 1 ? t("sheets.urge.managed_one") : t("sheets.urge.managed_other", { n: managed })}</motion.p>
      {helped && (
        <motion.div variants={rise}>
          <Button variant="secondary" onClick={() => { actions.savePlan(withStrategyFirst(plan, helped), habit.id); haptic.success(); setHelped(null); toast(t("sheets.urge.added"), { kind: "good" }); }}>
            {t("sheets.urge.offer_first", { title: strategy(helped).title })}
          </Button>
        </motion.div>
      )}
      <motion.div variants={rise}><Button onClick={onClose}>{t("sheets.urge.back_to", { name: companion.name })}</Button></motion.div>
    </motion.div>
  );

  const s = order.find((x) => x.id === current)!;
  return (
    <div className="stack urge">
      {context}
      <div className="field">
        <span className="field-label">{t("sheets.urge.way")}</span>
        <Select label={t("sheets.urge.way_aria")} value={current} onChange={(id) => setCurrent(id)} options={order.map((x) => ({ value: x.id, label: x.title }))} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={current} className="stack" aria-label={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.soft}>
          <h2>{s.title}</h2>
          {current !== "breathe" && <ul className="steps">{s.steps.map((t) => <li key={t}>{t}</li>)}</ul>}
          {current === "breathe" && <Breathing />}
          {current === "name" && (
            <div className="field">
              <SelectOther label={t("sheets.urge.set_off")} options={plainOpts(situations)} value={trigger} onChange={setTrigger} maxLength={40} placeholder={t("sheets.urge.choose_fit")} clearLabel={t("sheets.urge.not_sure")} otherPlaceholder={t("sheets.urge.own")} />
            </div>
          )}
          {current === "friction" && <Checklist items={frictionIdeas(habit.cls, habit.name)} />}
          {current === "replace" && <Checklist items={REPLACEMENTS} />}
          {current === "reach" && (
            <p>{plan?.supportName ? t("sheets.urge.reach_named", { name: plan.supportName }) : t("sheets.urge.reach_none")}{t("sheets.urge.reach_safe")}</p>
          )}
          {plan?.ifThen[0] && (current === "move" || current === "observe") && <p className="small">{t("sheets.urge.your_plan", { text: plan.ifThen[0] })}</p>}
        </motion.section>
      </AnimatePresence>
      <div className="card stack tight urge-check">
        <span className="field-label">{t("sheets.urge.how_now")}</span>
        <Button disabled={crisis} onClick={() => end("rode_it_out")}>{t("sheets.urge.eased")}</Button>
        <Button variant="secondary" onClick={next}>{t("sheets.urge.still_strong")}</Button>
        <Button variant="text" disabled={crisis} onClick={() => end("slipped")}>{t("sheets.urge.acted")}</Button>
      </div>
    </div>
  );
}

/** Ideas for the next few minutes: pick one, or write your own. */
function Checklist({ items }: { items: string[] }) {
  const [pick, setPick] = useState("");
  return <SelectOther label={t("sheets.urge.ideas")} options={plainOpts(items)} value={pick} onChange={(v) => { setPick(v); if (v) haptic.select(); }} maxLength={80} placeholder={t("sheets.urge.pick_try")} clearLabel={t("sheets.urge.not_now")} otherPlaceholder={t("sheets.urge.idea_own")} />;
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
      <p className="muted small">{t("sheets.urge.elapsed", { time: `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` })}</p>
    </div>
  );
}
