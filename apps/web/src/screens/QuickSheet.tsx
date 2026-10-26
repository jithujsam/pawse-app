import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { requestQuick, type QuickAction } from "../quick";
import { useActiveView, useData } from "../store";
import { dayControls, trackSummary } from "../progress";
import { today } from "../dates";
import { Button, Icon, Select, TrackContext } from "../ui/Controls";
import { listTracks, needsTrackContext } from "../tracks";
import { Sheet } from "../ui/Sheet";

/** The centre button: the three things you come to the app to do, one tap each. */
export function QuickSheet({ open, onClose, onPick, onPlan }: { open: boolean; onClose: () => void; onPick: () => void; onPlan: (habitId: string) => void }) {
  const data = useData();
  const view = useActiveView();
  // "Make a plan" asks which pet it is for when there is more than one; with one it goes straight to the plan.
  const [choosing, setChoosing] = useState(false);
  const pets = listTracks(data, ["active", "paused"]).filter((t) => t.companion);
  const [planFor, setPlanFor] = useState<string>("");
  useEffect(() => { if (!open) setChoosing(false); }, [open]);
  useEffect(() => { if (choosing) setPlanFor((cur) => (pets.some((p) => p.habit.id === cur) ? cur : pets.find((p) => p.habit.id === view?.habit?.id)?.habit.id ?? pets[0]?.habit.id ?? "")); }, [choosing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view?.habit) return null;
  const habit = view.habit;
  const t0 = today();
  const progress = trackSummary(data, habit.id, t0);
  const slipped = progress.today === "lapse";
  const clean = progress.today === "met";
  const streak = progress.current;
  const pick = (a: QuickAction) => { requestQuick(a); onPick(); };
  const ridden = progress.managedUrges;
  const todayCtl = dayControls(data, habit.id, t0, t0);
  // Rest or paused: today counts neither way, and a rest day can't be set over one.
  const resting = todayCtl.notTracking;
  const plan = () => { if (pets.length <= 1) { onPlan(habit.id); return; } haptic.select(); setChoosing(true); };
  const tiles: { id: QuickAction; icon: React.JSX.Element; title: string; hint: string; tone: string; disabled?: boolean }[] = [
    { id: "urge", icon: Icon.wave, title: "Having an urge", hint: ridden ? `${ridden} managed today` : "Get through it", tone: "calm" },
    { id: "clean", icon: clean ? Icon.check : Icon.sun, title: "Goal met today", hint: slipped ? "Today already has a slip" : clean ? `${streak} ${streak === 1 ? "day" : "days"} so far` : "Helps your pet heal", tone: "good", disabled: slipped || clean },
    { id: "slip", icon: Icon.slip, title: "I slipped", hint: "Log it in seconds", tone: "bad" },
    { id: "rest", icon: resting ? Icon.check : Icon.info, title: "Not tracking today", hint: resting ? (progress.paused ? "Paused: today counts neither way" : "Today counts neither way") : !todayCtl.canRest ? "Today is already recorded" : "Counts neither way", tone: "calm", disabled: resting || !todayCtl.canRest },
  ];
  if (choosing) return (
    <Sheet open={open} onClose={onClose} label="Choose a pet for the plan">
      <div className="stack">
        <h2>Whose plan?</h2>
        <p className="muted small">Each pet has its own plan.</p>
        <Select label="Pet" value={planFor || undefined} placeholder="Choose a pet" onChange={setPlanFor}
          options={pets.map((p) => ({ value: p.habit.id, label: `${p.companion!.name} · ${p.habit.name}` }))} />
        <div className="actions">
          <Button variant="secondary" onClick={() => setChoosing(false)}>Back</Button>
          <Button disabled={!planFor} onClick={() => onPlan(planFor)}>Open plan</Button>
        </div>
      </div>
    </Sheet>
  );
  return (
    <Sheet open={open} onClose={onClose} label="Log or check in">
      <h2>What's going on?</h2>
      {needsTrackContext(data, habit.id) && <TrackContext name={habit.name} pet={view.companion.name} paused={progress.paused} />}
      <motion.div className="quick-grid" variants={stagger} initial="hidden" animate="show">
        {tiles.map((t) => (
          <motion.button key={t.id} className="quick-tile" data-tone={t.tone} disabled={t.disabled} variants={rise}
            whileTap={t.disabled ? undefined : { scale: 0.98 }} transition={spring.snappy} onClick={() => pick(t.id)}>
            <span className="quick-ico" aria-hidden>{t.icon}</span>
            <b>{t.title}</b>
            <span className="muted small">{t.hint}</span>
          </motion.button>
        ))}
        <motion.button className="quick-tile" data-tone="calm" variants={rise} whileTap={{ scale: 0.98 }} transition={spring.snappy} onClick={plan}>
          <span className="quick-ico" aria-hidden>{Icon.list}</span>
          <b>Make or edit a plan</b>
          <span className="muted small">Goal, reasons, what helps</span>
        </motion.button>
      </motion.div>
    </Sheet>
  );
}
