import type { AdoptionMode, MissionState } from "@detox/engine";
import { companionMissions } from "../missions";
import { doneWord, missionText, severityWord } from "../mission-text";
import { today } from "../dates";
import { useData } from "../store";
import { Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { t, tt } from "../text";

/**
 * Missions: one sheet for both adoption modes. Each mission is a headline, why it matters, how severe it still is
 * (Rescue) or how far it has come (Raise), and the goal-met days left. Overall progress lives on the health bar.
 * Everything comes from companionMissions(), so the sheet never works out progress itself.
 */
export function MissionsSheet({ open, onClose, companionId }: { open: boolean; onClose: () => void; companionId: string }) {
  return <Sheet open={open} onClose={onClose} label={t("missions.sheet.label")}>{open && <Body companionId={companionId} />}</Sheet>;
}

function Body({ companionId }: { companionId: string }) {
  const data = useData();
  const tone = data.settings.tone;
  const companion = data.companions.find((c) => c.id === companionId);
  const m = companionMissions(data, companionId, today());
  if (!companion || !m) return null;
  const name = companion.name;
  // Missions still in progress first, then finished ones.
  const states = [...m.states.filter((s) => !s.completed), ...m.states.filter((s) => s.completed)];
  return (
    <div className="missions">
      <header className="missions-head">
        <h2 className="missions-title">{t("missions.sheet.title")}</h2>
        <p className="muted">{t("missions.sheet.subtitle", { name })}</p>
      </header>
      {m.setback && <p className="banner reassure" role="status">{tt("missions.sheet.setback", tone, { name })}</p>}
      {states.map((s) => <MissionCard key={s.id} s={s} mode={m.mode} />)}
      {m.mode === "rescue" && <p className="muted small">{t("missions.sheet.fiction", { name })}</p>}
    </div>
  );
}

/** One mission: headline, why it matters, how severe (or how far along), and goal-met days left. */
export function MissionCard({ s, mode }: { s: MissionState; mode: AdoptionMode }) {
  const words = missionText(s.id);
  const rehab = s.scale === "rehab";
  return (
    <article className="mission-card" data-done={s.completed}>
      <div className="mission-top">
        <h3>{words.title}</h3>
        {s.completed && <span className="mission-pill done">{Icon.check}{doneWord(mode)}</span>}
      </div>
      <p className="mission-why"><span className="sr-only">{t("missions.sheet.why")}: </span>{words.why}</p>
      {!s.completed && (
        <>
          {rehab ? <Severity value={s.value} level={s.level} /> : <Growth value={s.value} />}
          <p className="mission-days">{daysLine(mode, s.remaining)}</p>
        </>
      )}
    </article>
  );
}

const daysLine = (mode: AdoptionMode, n: number) =>
  mode === "rescue"
    ? (n === 1 ? t("missions.sheet.days_rescue_one", { n }) : t("missions.sheet.days_rescue_other", { n }))
    : (n === 1 ? t("missions.sheet.days_raise_one", { n }) : t("missions.sheet.days_raise_other", { n }));

/** Five boxes: the more are red, the more severe. -10 is all five, -2 and -1 are one, 0 is none. */
function Severity({ value, level }: { value: number; level: number }) {
  const red = Math.ceil(-value / 2);
  return (
    <div className="mission-meter">
      <span className="mission-label">{t("missions.sheet.severity")}</span>
      <span className="severity" role="meter" aria-valuemin={-10} aria-valuemax={0} aria-valuenow={value} aria-label={t("missions.sheet.severity_aria", { value })}>
        {Array.from({ length: 5 }, (_, i) => <i key={i} data-on={i < red} />)}
      </span>
      <b>{t("missions.sheet.severity_value", { word: severityWord(level), value })}</b>
    </div>
  );
}

function Growth({ value }: { value: number }) {
  return (
    <div className="mission-meter">
      <span className="mission-label">{t("missions.sheet.development")}</span>
      <span className="progress mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={t("missions.sheet.growth_aria", { value })}>
        <i style={{ width: `${value}%` }} />
      </span>
      <b>{t("missions.sheet.value_growth", { value })}</b>
    </div>
  );
}
