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
import { t } from "../text";

/** The centre button: the three things you come to the app to do, one tap each. */
export function QuickSheet({ open, onClose, onPick, onPlan }: { open: boolean; onClose: () => void; onPick: () => void; onPlan: (habitId: string) => void }) {
  const data = useData();
  const view = useActiveView();
  // "Make a plan" asks which pet it is for when there is more than one; with one it goes straight to the plan.
  const [choosing, setChoosing] = useState(false);
  const pets = listTracks(data, ["active", "paused"]).filter((tr) => tr.companion);
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
  const todayCtl = dayControls(data, habit.id, t0, t0);
  // Urges managed today (not on the whole track), which is what the tile says.
  const ridden = todayCtl.managedUrges;
  const plan = () => { if (pets.length <= 1) { onPlan(habit.id); return; } haptic.select(); setChoosing(true); };
  const tiles: { id: QuickAction; icon: React.JSX.Element; title: string; hint: string; tone: string; disabled?: boolean }[] = [
    { id: "urge", icon: Icon.wave, title: t("sheets.quick.urge"), hint: ridden ? t("sheets.quick.urge_managed", { n: ridden }) : t("sheets.quick.urge_hint"), tone: "calm" },
    { id: "clean", icon: clean ? Icon.check : Icon.sun, title: t("sheets.quick.met"), hint: slipped ? t("sheets.quick.met_slipped") : clean ? (streak === 1 ? t("sheets.quick.met_streak_one") : t("sheets.quick.met_streak_other", { n: streak })) : t("sheets.quick.met_hint"), tone: "good", disabled: slipped || clean },
    { id: "slip", icon: Icon.slip, title: t("sheets.quick.slip"), hint: t("sheets.quick.slip_hint"), tone: "bad" },
  ];
  if (choosing) return (
    <Sheet open={open} onClose={onClose} label={t("sheets.quick.choose_label")}>
      <div className="stack">
        <h2>{t("sheets.quick.whose")}</h2>
        <p className="muted small">{t("sheets.quick.each")}</p>
        <Select label={t("sheets.quick.pet_aria")} value={planFor || undefined} placeholder={t("sheets.quick.choose_pet")} onChange={setPlanFor}
          options={pets.map((p) => ({ value: p.habit.id, label: `${p.companion!.name} · ${p.habit.name}` }))} />
        <div className="actions">
          <Button variant="secondary" onClick={() => setChoosing(false)}>{t("ui.common.back")}</Button>
          <Button disabled={!planFor} onClick={() => onPlan(planFor)}>{t("sheets.quick.open_plan")}</Button>
        </div>
      </div>
    </Sheet>
  );
  return (
    <Sheet open={open} onClose={onClose} label={t("nav.tabs.quick")}>
      <h2>{t("sheets.quick.title")}</h2>
      {needsTrackContext(data, habit.id) && <TrackContext name={habit.name} pet={view.companion.name} paused={progress.paused} />}
      <motion.div className="quick-grid" variants={stagger} initial="hidden" animate="show">
        {tiles.map((tile) => (
          <motion.button key={tile.id} className="quick-tile" data-tone={tile.tone} disabled={tile.disabled} variants={rise}
            whileTap={tile.disabled ? undefined : { scale: 0.98 }} transition={spring.snappy} onClick={() => pick(tile.id)}>
            <span className="quick-ico" aria-hidden>{tile.icon}</span>
            <b>{tile.title}</b>
            <span className="muted small">{tile.hint}</span>
          </motion.button>
        ))}
        <motion.button className="quick-tile" data-tone="calm" variants={rise} whileTap={{ scale: 0.98 }} transition={spring.snappy} onClick={plan}>
          <span className="quick-ico" aria-hidden>{Icon.list}</span>
          <b>{t("sheets.quick.plan")}</b>
          <span className="muted small">{t("sheets.quick.plan_hint")}</span>
        </motion.button>
      </motion.div>
    </Sheet>
  );
}
