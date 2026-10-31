import { MILESTONES } from "../copy";
import { fmtDay, today } from "../dates";
import { useActiveView, useData } from "../store";
import { needsTrackContext, trackState } from "../tracks";
import { milestoneProgress, trackSummary } from "../progress";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { TrackContext } from "../ui/Controls";
import { CalendarSections } from "./Calendar";
import { t } from "../text";
import { TopBar } from "../ui/TopBar";
import { MOODS } from "./Reflect";

/** The Calendar tab: how the pet is ageing, every day on the calendar, how far you've come so far, then milestones. Reflection lives in the check-in on Insights. */
export function Journey() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit!;
  const progress = trackSummary(data, habit.id, today());
  // Milestones count days of care (goal met or an urge managed). They only add up, so a slip never resets them.
  const care = progress.care;
  const { next } = milestoneProgress(care, MILESTONES);
  const reached = MILESTONES.filter((m) => care >= m).reverse();
  const notes = [...data.journal].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);

  return (
    <main className="screen">
      <TopBar title={t("calendar.stats.title")} />
      {needsTrackContext(data, habit.id) && <TrackContext name={habit.name} pet={companion.name} paused={trackState(data, habit.id).status === "paused"} />}

      <CalendarSections />

      <section className="stack" aria-label={t("calendar.stats.runs")}>
        <h2>{t("calendar.stats.runs")}</h2>
        <div className="runs">
          <div><span className="t-figure"><AnimatedNumber value={progress.current} /></span><span className="muted">{t("calendar.stats.current_run")}</span></div>
          <div><span className="t-figure"><AnimatedNumber value={progress.best} /></span><span className="muted">{t("calendar.stats.best_run")}</span></div>
          <div><span className="t-figure"><AnimatedNumber value={progress.metDays} /></span><span className="muted">{t("calendar.stats.goal_met_days")}</span></div>
        </div>
      </section>

      <section className="stack" aria-label={t("calendar.milestones.title")}>
        <h2>{t("calendar.milestones.title")}</h2>
        <div className="milestones-card">
          <div className="milestones">{MILESTONES.map((m) => <div key={m} className="badge" data-got={care >= m} data-next={m === next}><span className="badge-disc">{m}</span></div>)}</div>
        </div>
        <div className="ms-list">
          {next && <div><b>{t("calendar.milestones.badge", { n: next })}</b><span className="muted">{next - care === 1 ? t("calendar.milestones.to_go_one", { n: next - care }) : t("calendar.milestones.to_go_other", { n: next - care })}</span></div>}
          {reached.map((m) => <div key={m}><b>{t("calendar.milestones.badge", { n: m })}</b><span className="muted">{t("calendar.milestones.reached")}</span></div>)}
        </div>
        <p className="muted small">{next ? t("calendar.milestones.progress", { care, next }) : t("calendar.milestones.done", { name: companion.name })}</p>
      </section>

      {notes.length > 0 && (
        <section className="stack" aria-label={t("calendar.stats.notes")}>
          <h2>{t("calendar.stats.notes")}</h2>
          <div className="notes-list">
            {notes.map((j) => (
              <div key={j.day}>
                <div className="row"><b>{fmtDay(j.day)}</b><span className="muted small">{MOODS[j.mood - 1]?.l}</span></div>
                {j.body && <span>{j.body}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
