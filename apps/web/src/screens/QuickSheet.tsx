import { motion } from "motion/react";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { requestQuick, type QuickAction } from "../quick";
import { actions, useActiveView, useData } from "../store";
import { Row } from "../ui/Settings";
import { dayControls, trackSummary } from "../progress";
import { today } from "../dates";
import { Icon, TrackContext } from "../ui/Controls";
import { listTracks, needsTrackContext } from "../tracks";
import { Sheet } from "../ui/Sheet";
import { t } from "../text";

/** The centre button: the three things you come to the app to do, one tap each. */
export function QuickSheet({ open, onClose, onPick, onPlan }: { open: boolean; onClose: () => void; onPick: () => void; onPlan: (habitId: string) => void }) {
  const data = useData();
  const view = useActiveView();
  const pets = listTracks(data, ["active", "paused"]).filter((tr) => tr.companion);
  if (!view?.habit) return null;
  const habit = view.habit;
  const t0 = today();
  const progress = trackSummary(data, habit.id, t0);
  const slipped = progress.today === "lapse";
  const clean = progress.today === "met";
  const streak = progress.current;
  const pick = (a: QuickAction) => { requestQuick(a); onPick(); };
  const todayCtl = dayControls(data, habit.id, t0, t0);
  // Urges managed today (not on the whole track), which is what the tile says.
  const ridden = todayCtl.managedUrges;
  const tiles: { id: QuickAction; icon: React.JSX.Element; title: string; hint: string; disabled?: boolean }[] = [
    { id: "clean", icon: clean ? Icon.check : Icon.sun, title: t("sheets.quick.met"), hint: slipped ? t("sheets.quick.met_slipped") : clean ? (streak === 1 ? t("sheets.quick.met_streak_one") : t("sheets.quick.met_streak_other", { n: streak })) : t("sheets.quick.met_hint") },
    { id: "slip", icon: Icon.slip, title: t("sheets.quick.slip"), hint: t("sheets.quick.slip_hint") },
    { id: "urge", icon: Icon.wave, title: t("sheets.quick.urge"), hint: ridden ? t("sheets.quick.urge_managed", { n: ridden }) : t("sheets.quick.urge_hint") },
  ];
  return (
    <Sheet open={open} onClose={onClose} label={t("nav.tabs.quick")}>
      <h2>{t("sheets.quick.title")}</h2>
      {pets.length > 1
        ? <div className="chips" role="group" aria-label={t("sheets.quick.pets_aria")}>
            {pets.map((p) => <button key={p.habit.id} type="button" className="chip" aria-pressed={p.habit.id === habit.id} onClick={() => { haptic.select(); actions.selectTrack(p.habit.id); }}>{p.companion!.name}</button>)}
          </div>
        : needsTrackContext(data, habit.id) && <TrackContext name={habit.name} pet={view.companion.name} paused={progress.paused} />}
      <motion.div className="quick-grid" variants={stagger} initial="hidden" animate="show">
        {tiles.map((tile) => (
          <motion.button key={tile.id} className="quick-tile" disabled={tile.disabled} variants={rise}
            whileTap={tile.disabled ? undefined : { scale: 0.98 }} transition={spring.snappy} onClick={() => pick(tile.id)}>
            <span className="quick-ico" aria-hidden>{tile.icon}</span>
            <b>{tile.title}</b>
            <span className="muted small">{tile.hint}</span>
          </motion.button>
        ))}
      </motion.div>
      <div className="group-body"><Row icon={Icon.list} label={t("sheets.quick.plan")} onClick={() => onPlan(habit.id)} /></div>
    </Sheet>
  );
}
