import { motion } from "motion/react";
import { MILESTONES } from "../copy";
import { daysBetween, today } from "../dates";
import { rise, spring, stagger } from "../motion";
import { bestStreak, cleanStreak, useActiveView, useData } from "../store";
import { careDays } from "../recovery";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Icon } from "../ui/Controls";
import { CalendarSections } from "./Calendar";
import { Reflect } from "./Reflect";

/** The long view: how far you've come, the next milestone, and every day on the calendar. */
export function Journey() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const together = Math.max(1, daysBetween(companion.bornOn, today()) + 1);
  const slipDays = new Set(data.entries.filter((e) => e.habitId === habit.id).map((e) => e.day));
  const cleanTotal = data.cleanDays.filter((c) => c.habitId === habit.id && !slipDays.has(c.day)).length;
  const streak = cleanStreak(data, habit.id);
  const best = Math.max(bestStreak(data, habit.id), streak);
  // Milestones count days of care (goal met or an urge managed). They only add up, so a slip never resets them.
  const care = careDays(data, habit.id);
  const managed = data.urges.filter((u) => u.habitId === habit.id && u.outcome === "rode_it_out").length;
  const next = MILESTONES.find((m) => m > care);
  const prev = [...MILESTONES].reverse().find((m) => m <= care) ?? 0;
  const pct = next ? ((care - prev) / (next - prev)) * 100 : 100;

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>Journey</motion.h1>

      <motion.section className="stats" aria-label="So far" variants={rise}>
        <div className="card stat"><div className="muted small">Days together</div><div className="v"><AnimatedNumber value={together} /></div></div>
        <div className="card stat"><div className="muted small">Good days</div><div className="v"><AnimatedNumber value={cleanTotal} /></div></div>
        <div className="card stat"><div className="muted small">Urges managed</div><div className="v"><AnimatedNumber value={managed} /></div></div>
        <div className="card stat"><div className="muted small">Best streak</div><div className="v"><AnimatedNumber value={best} /> <small>{best === 1 ? "day" : "days"}</small></div></div>
      </motion.section>

      <motion.section className="card stack" aria-label="Milestones" variants={rise}>
        <div className="row"><h2>Milestones</h2>{next && <span className="muted small">{next - care} to go</span>}</div>
        <div className="milestones">
          {MILESTONES.map((m, i) => {
            const got = care >= m;
            return (
              <motion.div key={m} className="badge" data-got={got} data-next={m === next}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.1 + i * 0.05 }}>
                <span className="badge-disc">{got ? Icon.check : m}</span>
                <span className="small">{m}d</span>
              </motion.div>
            );
          })}
        </div>
        {next
          ? <>
              <div className="progress" aria-hidden><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={spring.calm} /></div>
              <p className="muted small">{care} of {next} days of care: days with your goal met or an urge managed. They add up and never reset.</p>
            </>
          : <p className="muted small">Every milestone reached. {companion.name} is proud of you.</p>}
      </motion.section>

      <motion.div variants={rise}><Reflect /></motion.div>

      <CalendarSections />
    </motion.main>
  );
}
