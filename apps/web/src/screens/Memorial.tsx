import { useState } from "react";
import { motion } from "motion/react";
import { PetImage } from "../Companion";
import { sceneFor } from "../scene";
import { PetScene } from "../ui/PetScene";
import { deathLine } from "../copy";
import { addDays } from "../dates";
import { daysTogether } from "../progress";
import { haptic } from "../haptics";
import { actions, useData, type CompanionView } from "../store";
import { Button, plainOpts, Select, SelectOther } from "../ui/Controls";
import { NAMES, PICKABLE } from "../pets";
import { concernIn } from "../guard";
import { money } from "../format";
import { t } from "../text";
import type { Species } from "../types";

const BABY: Record<Species, string> = { dog: t("sheets.memorial.kind_dog"), cat: t("sheets.memorial.kind_cat"), fox: t("sheets.memorial.kind_fox") };
/** A storm at night, whatever the hour. */
const MEMORIAL_SCENE = sceneFor({ wellness: 0, rescue: false, slipToday: false, milestoneToday: false, hour: 23 });
const slow = (delay: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.2, delay, ease: [0.22, 0.8, 0.3, 1] as const } });

export function Memorial({ view, onDone }: { view: CompanionView; onDone: () => void }) {
  const data = useData();
  const { companion, habit } = view;
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>(PICKABLE.some((s) => s.id === companion.species) ? companion.species : "dog");
  const es = data.entries.filter((e) => e.companionId === companion.id);
  const lived = daysTogether(companion.bornOn, companion.diedOn ?? companion.bornOn);
  const spend = es.reduce((a, e) => a + (e.amount ?? 0), 0);
  const lastMonth = es.filter((e) => e.day > addDays(companion.diedOn ?? companion.bornOn, -30)).length;
  const tone = data.settings.tone;

  return (
    <main className="screen scene-screen memorial">
      <PetScene scene={MEMORIAL_SCENE} label={companion.name}>
        {data.settings.deathScene && <PetImage species={companion.species} coat={companion.coat} breed={companion.breed} mood="dying" size={220} />}
      </PetScene>
      <div className="scene-body">
      <motion.h1 className="t-display" {...slow(0.2)}>{companion.name}</motion.h1>
      <motion.p {...slow(1.2)}>{deathLine(tone, companion.name)}</motion.p>
      <motion.section className="card stack memorial-card" {...slow(2)}>
        <h2>{t("sheets.memorial.life")}</h2>
        <div className="row"><span>{t("sheets.memorial.lived")}</span><b>{lived} {lived === 1 ? t("sheets.memorial.day") : t("sheets.memorial.days")}</b></div>
        <div className="row"><span>{t("sheets.memorial.slips")}</span><b>{es.length}</b></div>
        {habit?.unit === "money" && <div className="row"><span>{t("sheets.memorial.spent")}</span><b>{money(data.settings.currency, Math.round(spend))}</b></div>}
        <div className="row"><span>{t("sheets.memorial.final_month")}</span><b>{lastMonth}</b></div>
      </motion.section>
      <motion.section className="stack memorial-card" {...slow(2.8)}>
        <h2>{t("sheets.memorial.start_again")}</h2>
        <p className="muted small">{t("sheets.memorial.start_body", { name: companion.name })}</p>
        <div className="field"><span className="field-label">{t("sheets.memorial.next")}</span>
          <Select label={t("sheets.memorial.species")} value={species} onChange={setSpecies} options={PICKABLE.map((s) => ({ value: s.id, label: s.label }))} /></div>
        <div className="field"><span className="field-label">{t("sheets.memorial.new_name")}</span>
          <SelectOther label={t("sheets.memorial.new_name")} value={name} onChange={setName} options={plainOpts(NAMES[species])} maxLength={20} placeholder={t("sheets.memorial.name_placeholder", { name: NAMES[species][0] })} otherLabel={t("sheets.memorial.name_other")} otherPlaceholder={t("sheets.memorial.name_own")} /></div>
        <Button disabled={concernIn(name) !== null} onClick={() => { haptic.success(); actions.adopt(habit!.id, name, species, companion.personality); actions.resetCelebrations(habit!.id); onDone(); }}>{t("sheets.memorial.adopt", { kind: BABY[species] })}</Button>
      </motion.section>
      </div>
    </main>
  );
}
