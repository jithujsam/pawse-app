import { motion } from "motion/react";
import { MILESTONES } from "../copy";
import { today } from "../dates";
import { rise, spring, stagger } from "../motion";
import { useActiveView, useData } from "../store";
import { needsTrackContext, trackState } from "../tracks";
import { daysTogether, milestoneProgress, trackSummary } from "../progress";
import { stats } from "../health";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { TrackContext } from "../ui/Controls";
import { CalendarSections } from "./Calendar";

/** The Calendar tab: how the pet is ageing, every day on the calendar, how far you've come so far, then milestones. Reflection lives in the check-in on Insights. */
export function Journey() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const together = daysTogether(companion.bornOn, today());
  const progress = trackSummary(data, habit.id, today());
  const cleanTotal = progress.metDays;
  const best = progress.best;
  // Milestones count days of care (goal met or an urge managed). They only add up, so a slip never resets them.
  const care = progress.care;
  const healed = stats(data, view).healed;
  const { next, pct } = milestoneProgress(care, MILESTONES);

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>Journey</motion.h1>
      {needsTrackContext(data, habit.id) && <motion.div variants={rise}><TrackContext name={habit.name} pet={companion.name} paused={trackState(data, habit.id).status === "paused"} /></motion.div>}

      <CalendarSections />

      <motion.section className="stats" aria-label="So far" variants={rise}>
        <div className="card stat"><div className="muted small">Days together</div><div className="v"><AnimatedNumber value={together} /></div></div>
        <div className="card stat"><div className="muted small">Good days</div><div className="v"><AnimatedNumber value={cleanTotal} /></div></div>
        <div className="card stat"><div className="muted small">Life healed</div><div className="v"><AnimatedNumber value={healed} decimals={1} /> <small>mo</small></div></div>
        <div className="card stat"><div className="muted small">Best streak</div><div className="v"><AnimatedNumber value={best} /> <small>{best === 1 ? "day" : "days"}</small></div></div>
      </motion.section>

      <motion.section className="card stack" aria-label="Milestones" variants={rise}>
        <div className="row"><h2>Milestones</h2>{next && <span className="muted small">{next - care} {next - care === 1 ? "day" : "days"} to go</span>}</div>
        <div className="milestones">
          {MILESTONES.map((m, i) => {
            const got = care >= m;
            return (
              <motion.div key={m} className="badge" data-got={got} data-next={m === next} role="img" aria-label={`${m} days${got ? ", reached" : ""}`}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.1 + i * 0.05 }}>
                <span className="badge-disc">{m}</span>
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

    </motion.main>
  );
}
