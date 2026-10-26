import { useState } from "react";
import { motion } from "motion/react";
import { PetPortrait } from "../Companion";
import { deathLine } from "../copy";
import { addDays } from "../dates";
import { daysTogether } from "../progress";
import { haptic } from "../haptics";
import { actions, useData, type CompanionView } from "../store";
import { Button, plainOpts, Select, SelectOther } from "../ui/Controls";
import { NAMES, PICKABLE } from "../pets";
import type { Species } from "../types";

const BABY: Record<Species, string> = { dog: "puppy", cat: "kitten", rabbit: "bunny", fox: "kit", owl: "owlet", panda: "cub" };
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
    <main className="screen memorial">
      <div className="stars" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 40}%`, animationDelay: `${(i % 7) * 0.6}s` }} />)}</div>
      <motion.h1 {...slow(0.2)}>{companion.name}</motion.h1>
      {data.settings.deathScene && (
        <motion.div className="memorial-art" initial={{ opacity: 1, filter: "grayscale(0)" }} animate={{ opacity: 0.75, filter: "grayscale(0.7)" }} transition={{ duration: 3, ease: "easeOut" }}>
          <PetPortrait species={companion.species} coat={companion.coat} stage="frail" mood="dying" age={100} size={220} />
        </motion.div>
      )}
      <motion.p {...slow(1.2)}>{deathLine(tone, companion.name)}</motion.p>
      <motion.section className="card stack memorial-card" {...slow(2)}>
        <h2>A life in numbers</h2>
        <div className="row"><span>Lived</span><b>{lived} {lived === 1 ? "day" : "days"}</b></div>
        <div className="row"><span>Slips</span><b>{es.length}</b></div>
        {habit?.unit === "money" && <div className="row"><span>Spent</span><b>{data.settings.currency} {Math.round(spend).toLocaleString()}</b></div>}
        <div className="row"><span>Slips in the final month</span><b>{lastMonth}</b></div>
      </motion.section>
      <motion.section className="stack memorial-card" {...slow(2.8)}>
        <h2>Start again</h2>
        <p className="muted small">The new life begins at age 0. Your history stays in your reports, and {companion.name} stays in the Hall of Companions.</p>
        <div className="field"><span className="field-label">Who comes next?</span>
          <Select label="Species" value={species} onChange={setSpecies} options={PICKABLE.map((s) => ({ value: s.id, label: s.label }))} /></div>
        <div className="field"><span className="field-label">New name</span>
          <SelectOther label="New name" value={name} onChange={setName} options={plainOpts(NAMES[species])} maxLength={20} placeholder={`Pick a name, like ${NAMES[species][0]}`} otherLabel="Another name…" otherPlaceholder="Type a name" /></div>
        <Button onClick={() => { haptic.success(); actions.adopt(habit!.id, name, species, companion.personality); actions.resetCelebrations(habit!.id); onDone(); }}>Adopt a new {BABY[species]}</Button>
      </motion.section>
    </main>
  );
}
