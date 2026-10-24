import { motion } from "motion/react";
import { rise, spring, stagger } from "../motion";
import { requestQuick, type QuickAction } from "../quick";
import { cleanStreak, useActiveView, useData } from "../store";
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
  const slipped = data.entries.some((e) => e.habitId === habit.id && e.day === t0);
  const clean = data.cleanDays.some((c) => c.habitId === habit.id && c.day === t0);
  const streak = cleanStreak(data, habit.id);
  const pick = (a: QuickAction) => { requestQuick(a); onPick(); };
  const ridden = data.urges.filter((u) => u.habitId === habit.id && u.outcome === "rode_it_out").length;
  const tiles: { id: QuickAction; icon: React.JSX.Element; title: string; hint: string; tone: string; disabled?: boolean; wide?: boolean }[] = [
    { id: "urge", icon: Icon.wave, title: "Having an urge", hint: ridden ? `Ride it out together. ${ridden} ridden out so far.` : "Two minutes with your companion. It passes.", tone: "calm", wide: true },
    { id: "clean", icon: Icon.sun, title: clean ? "Clean today ✓" : "Clean today", hint: slipped ? "Today already has a slip" : clean ? `${streak} ${streak === 1 ? "day" : "days"} in a row` : "One tap. Heals a little.", tone: "good", disabled: slipped || clean },
    { id: "slip", icon: Icon.slip, title: "I slipped", hint: "Ten seconds. Honest is enough.", tone: "bad" },
  ];
  return (
    <Sheet open={open} onClose={onClose} label="Log or check in">
      <h2>What happened?</h2>
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
