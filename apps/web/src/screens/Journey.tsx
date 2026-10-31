import { motion } from "motion/react";
import { MILESTONES } from "../copy";
import { fmtDay, today } from "../dates";
import { rise, spring, stagger } from "../motion";
import { useActiveView, useData } from "../store";
import { needsTrackContext, trackState } from "../tracks";
import { milestoneProgress, trackSummary } from "../progress";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { TrackContext } from "../ui/Controls";
import { CalendarSections } from "./Calendar";
import { t } from "../text";
import { MOODS } from "./Reflect";

/** The Calendar tab: how the pet is ageing, every day on the calendar, how far you've come so far, then milestones. Reflection lives in the check-in on Insights. */
export function Journey() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const progress = trackSummary(data, habit.id, today());
  const cleanTotal = progress.metDays;
  const best = progress.best;
  // Milestones count days of care (goal met or an urge managed). They only add up, so a slip never resets them.
  const care = progress.care;
  const { next, pct } = milestoneProgress(care, MILESTONES);
  const notes = [...data.journal].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>{t("calendar.stats.title")}</motion.h1>
      {needsTrackContext(data, habit.id) && <motion.div variants={rise}><TrackContext name={habit.name} pet={companion.name} paused={trackState(data, habit.id).status === "paused"} /></motion.div>}

      <CalendarSections />

      <motion.section className="stack" aria-label={t("calendar.stats.runs")} variants={rise}>
        <h2>{t("calendar.stats.runs")}</h2>
        <div className="stats runs3">
          <div className="card stat"><div className="muted small">{t("calendar.stats.current_run")}</div><div className="v"><AnimatedNumber value={progress.current} /></div></div>
          <div className="card stat"><div className="muted small">{t("calendar.stats.best_run")}</div><div className="v"><AnimatedNumber value={best} /></div></div>
          <div className="card stat"><div className="muted small">{t("calendar.stats.goal_met_days")}</div><div className="v"><AnimatedNumber value={cleanTotal} /></div></div>
        </div>
      </motion.section>

      <motion.section className="card stack" aria-label={t("calendar.milestones.title")} variants={rise}>
        <div className="row"><h2>{t("calendar.milestones.title")}</h2>{next && <span className="muted small">{next - care === 1 ? t("calendar.milestones.to_go_one", { n: next - care }) : t("calendar.milestones.to_go_other", { n: next - care })}</span>}</div>
        <div className="milestones">
          {MILESTONES.map((m, i) => {
            const got = care >= m;
            return (
              <motion.div key={m} className="badge" data-got={got} data-next={m === next} role="img" aria-label={got ? t("calendar.milestones.badge_reached", { n: m }) : t("calendar.milestones.badge", { n: m })}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.1 + i * 0.05 }}>
                <span className="badge-disc">{m}</span>
              </motion.div>
            );
          })}
        </div>
        {next
          ? <>
              <div className="progress" aria-hidden><motion.i initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={spring.calm} /></div>
              <p className="muted small">{t("calendar.milestones.progress", { care, next })}</p>
            </>
          : <p className="muted small">{t("calendar.milestones.done", { name: companion.name })}</p>}
      </motion.section>

      {notes.length > 0 && (
        <motion.section className="stack" aria-label={t("calendar.stats.notes")} variants={rise}>
          <h2>{t("calendar.stats.notes")}</h2>
          <div className="list">
            {notes.map((j) => (
              <div className="item" key={j.day}>
                <div className="row"><b>{fmtDay(j.day)}</b><span className="muted small">{MOODS[j.mood - 1]?.l}</span></div>
                {j.body && <span className="small">{j.body}</span>}
              </div>
            ))}
          </div>
        </motion.section>
      )}

    </motion.main>
  );
}
