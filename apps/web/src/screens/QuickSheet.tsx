import { motion } from "motion/react";
import { rise, spring, stagger } from "../motion";
import { requestQuick, type QuickAction } from "../quick";
import { useActiveView, useData } from "../store";
import { dayControls, trackSummary } from "../progress";
import { today } from "../dates";
import { Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";

/** The centre button: the three things you come to the app to do, one tap each. */
export function QuickSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: () => void }) {
  const data = useData();
  const view = useActiveView();
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
  const tiles: { id: QuickAction; icon: React.JSX.Element; title: string; hint: string; tone: string; disabled?: boolean; wide?: boolean }[] = [
    { id: "urge", icon: Icon.wave, title: "Having an urge", hint: ridden ? `Pick a way through it. ${ridden} managed so far.` : "Pick a way through it, with your companion.", tone: "calm", wide: true },
    { id: "clean", icon: clean ? Icon.check : Icon.sun, title: "Goal met today", hint: slipped ? "Today already has a slip" : clean ? `${streak} ${streak === 1 ? "day" : "days"} in a row` : "One tap. Helps your companion heal.", tone: "good", disabled: slipped || clean },
    { id: "slip", icon: Icon.slip, title: "I slipped", hint: "Ten seconds. Honest is enough.", tone: "bad" },
    { id: "rest", icon: resting ? Icon.check : Icon.info, title: "Not tracking today", hint: resting ? "Today counts neither way" : !todayCtl.canRest ? "Today is already recorded" : "Counts neither way", tone: "calm", disabled: resting || !todayCtl.canRest, wide: true },
  ];
  return (
    <Sheet open={open} onClose={onClose} label="Log or check in">
      <h2>What’s going on?</h2>
      <motion.div className="quick-grid" variants={stagger} initial="hidden" animate="show">
        {tiles.map((t) => (
          <motion.button key={t.id} className={`quick-tile${t.wide ? " wide" : ""}`} data-tone={t.tone} disabled={t.disabled} variants={rise}
            whileTap={t.disabled ? undefined : { scale: 0.96 }} transition={spring.snappy} onClick={() => pick(t.id)}>
            <span className="quick-ico" aria-hidden>{t.icon}</span>
            <b>{t.title}</b>
            <span className="muted small">{t.hint}</span>
          </motion.button>
        ))}
      </motion.div>
    </Sheet>
  );
}
