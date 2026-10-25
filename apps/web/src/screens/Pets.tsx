import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STAGE_LABEL } from "@detox/engine";
import type { HabitClass } from "@detox/engine";
import { moodFor, PetPortrait } from "../Companion";
import { CRISIS_MESSAGE, pauseHint, pauseRefused, pauseToast, RESTRICTION_NOTE, resumeHint, resumeToast } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { today } from "../dates";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { NAMES, SPECIES } from "../pets";
import { inferClass, inferMeasure, isRestrictionRelated, MEASURES, SUGGESTIONS } from "../questions";
import { dayStatus, STATUS_LABEL } from "../recovery";
import { actions, useData, viewCompanion } from "../store";
import { focusedTrackId, listTracks, trackState } from "../tracks";
import type { Measure, Species } from "../types";
import { Button, Chip, Icon } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";

/** Every 3D pet is its own graphics context, which phones cap, so only the first few cards are 3D. */
const MAX_3D_CARDS = 4;

/**
 * The Pets tab: one card per recovery track. Each track is a habit with its own companion, so the grid is
 * built straight from the stored habits; nothing here is calculated that the rest of the app doesn't already show.
 */
export function Pets({ onOpen }: { onOpen: (habitId: string) => void }) {
  const data = useData();
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const t0 = today();
  // Archived tracks are read-only and leave the grid; a track whose pet is missing (damaged data) is skipped
  // rather than crashing the grid.
  const tracks = useMemo(() => listTracks(data, ["active", "paused"]).filter((t) => t.companion).map(({ habit }) => {
    const view = viewCompanion(data, habit.companionId, t0);
    const status = dayStatus(data, habit.id, t0, t0);
    return { habit, view, status, paused: trackState(data, habit.id).status === "paused" };
  }), [data, t0]);
  const open = (id: string) => { haptic.tap(); actions.selectTrack(id); onOpen(id); };

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="stack tight" variants={rise}>
        <h1>Pets</h1>
        <p className="muted small">Each pet looks after one recovery track.</p>
      </motion.header>

      {tracks.length === 0 ? (
        <motion.section className="card stack center-text" variants={rise}>
          <h2>No recovery tracks yet</h2>
          <p className="muted">Pick one behaviour you'd like to understand or change, and a pet will keep you company while you work on it.</p>
          <Button onClick={() => setAdding(true)}>Add a recovery track</Button>
        </motion.section>
      ) : (
        <motion.section className="pet-grid" aria-label="Recovery tracks" variants={rise}>
          {tracks.map(({ habit, view, status, paused }, i) => {
            const checked = status === "met" || status === "lapse" || status === "urge";
            const mood = moodFor(view.stage, { checkedToday: checked, slippedToday: status === "lapse", age: view.age, notTracking: paused || status === "rest" || status === "paused" });
            // A paused track says so first; today's state still shows when something was logged.
            const day = status === "unrecorded" ? "Not checked in" : STATUS_LABEL[status];
            const line = view.dead ? STAGE_LABEL.dead : paused ? (checked ? `Paused · ${day}` : "Paused") : `${STAGE_LABEL[view.stage]} · ${day}`;
            return (
              <div key={habit.id} className="pet-card-wrap">
                <motion.button className="pet-card" data-active={habit.id === focusedTrackId(data)} data-paused={paused}
                  onClick={() => open(habit.id)} whileTap={{ scale: 0.97 }} transition={spring.snappy}
                  aria-label={`${view.companion.name}, ${habit.name}. ${line}. Open this track.`}>
                  <span className="pet-card-art" aria-hidden>
                    <PetPortrait still={i >= MAX_3D_CARDS} species={view.companion.species} coat={view.companion.coat} stage={view.stage} mood={mood} age={view.age} size={100} />
                  </span>
                  <b className="pet-card-name">{view.companion.name}</b>
                  <span className="pet-card-track small">{habit.name}</span>
                  <span className="pet-card-status small" data-s={paused ? "paused" : status}>{line}</span>
                </motion.button>
                <button className="icon-btn pet-card-more" aria-haspopup="dialog" aria-label={`More for ${habit.name}`} onClick={() => { haptic.tap(); setMenu(habit.id); }}>{Icon.more}</button>
              </div>
            );
          })}
          {data.habits.length < 50 && <motion.button className="pet-card pet-card-add" onClick={() => { haptic.tap(); setAdding(true); }} whileTap={{ scale: 0.97 }} transition={spring.snappy}>
            <span className="pet-card-plus" aria-hidden>{Icon.plus}</span>
            <b className="pet-card-name">Add a recovery track</b>
            <span className="pet-card-track small muted">A new pet for another habit</span>
          </motion.button>}
        </motion.section>
      )}

      <TrackMenu habitId={menu} onClose={() => setMenu(null)} onOpen={(id) => { setMenu(null); open(id); }} />
      <AddTrack open={adding} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); onOpen(id); }} />
    </motion.main>
  );
}

/**
 * The card menu: open the track, or pause and resume it. Pausing never changes a record or the person's reminder
 * settings; while a track is paused its days count neither way and the app plans no reminders for it.
 */
function TrackMenu({ habitId, onClose, onOpen }: { habitId: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const data = useData();
  const habit = habitId ? data.habits.find((h) => h.id === habitId) : undefined;
  const companion = habit && data.companions.find((c) => c.id === habit.companionId);
  const { tone } = data.settings;
  const paused = habit ? trackState(data, habit.id).status === "paused" : false;
  const toggle = () => {
    if (!habit) return;
    const ok = paused ? actions.resumeTrack(habit.id) : actions.pauseTrack(habit.id);
    if (!ok) { haptic.warn(); toast(pauseRefused(tone)); return; }
    haptic.select();
    toast(paused ? resumeToast(tone) : pauseToast(tone, companion?.name ?? ""), { kind: paused ? "good" : undefined });
    onClose();
  };
  return (
    <Sheet open={!!habit} onClose={onClose} label={habit ? `${habit.name} options` : "Track options"}>
      {habit && <div className="stack">
        <div className="stack tight">
          <h2>{habit.name}</h2>
          <p className="muted small">{companion?.name}{paused ? " · Paused" : ""}</p>
        </div>
        <Button onClick={() => onOpen(habit.id)}>Open</Button>
        <Button variant="secondary" onClick={toggle}>{paused ? "Resume tracking" : "Pause tracking"}</Button>
        <p className="muted small">{paused ? resumeHint(tone) : pauseHint(tone)}</p>
      </div>}
    </Sheet>
  );
}

/** Adds a recovery track with the same building blocks as onboarding: what, how it's measured, and a pet. */
function AddTrack({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (habitId: string) => void }) {
  const [what, setWhat] = useState("");
  const [cls, setCls] = useState<HabitClass>("custom");
  const [measure, setMeasure] = useState<Measure>("none");
  const [touched, setTouched] = useState(false);
  const [species, setSpecies] = useState<Species>("cat");
  const [name, setName] = useState("");
  const crisis = hasCrisisLanguage(what) || hasCrisisLanguage(name);
  const restriction = isRestrictionRelated(what);
  const pick = (text: string, c?: HabitClass, m?: Measure) => {
    const k = c ?? inferClass(text);
    setWhat(text); setCls(k);
    if (!touched) setMeasure(m ?? inferMeasure(k));
  };
  const reset = () => { setWhat(""); setCls("custom"); setMeasure("none"); setTouched(false); setName(""); };
  const save = () => {
    const petName = name.trim() || NAMES[species][0];
    const id = actions.addTrack({ what, cls, measure, species, name: petName });
    if (!id) { haptic.warn(); return; } // the 50-track limit; the add card is hidden before that
    haptic.success();
    toast(`${petName} is here for ${what.trim()}`, { kind: "good" });
    reset();
    onAdded(id);
  };

  return (
    <Sheet open={open} onClose={onClose} label="Add a recovery track">
      <div className="stack">
        <h2>Add a recovery track</h2>
        <div className="field">
          <span className="field-label">What would you like to change?</span>
          <div className="chips">{SUGGESTIONS.map((s) => <Chip key={s.label} pressed={what === s.label} onClick={() => pick(s.label, s.cls, s.measure)}>{s.label}</Chip>)}</div>
          <input className="input" autoComplete="off" value={what} maxLength={60} placeholder="Or in your own words" aria-label="In your own words" onChange={(e) => pick(e.target.value)} />
        </div>
        <AnimatePresence>
          {crisis && <motion.div className="banner danger" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{CRISIS_MESSAGE}</motion.div>}
          {restriction && <motion.div className="banner" role="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{RESTRICTION_NOTE}</motion.div>}
        </AnimatePresence>
        <div className="field">
          <span className="field-label">How does it show up?</span>
          <div className="chips" role="radiogroup" aria-label="How it's measured">
            {MEASURES.map((m) => <Chip key={m.id} pressed={measure === m.id} onClick={() => { setMeasure(m.id); setTouched(true); }}>{m.label}</Chip>)}
          </div>
        </div>
        <div className="field">
          <span className="field-label">Its pet</span>
          <div className="chips" role="radiogroup" aria-label="Species">
            {SPECIES.map((s) => <Chip key={s.id} pressed={species === s.id} onClick={() => setSpecies(s.id)}>{s.label}</Chip>)}
          </div>
          <input className="input" autoComplete="off" value={name} maxLength={20} placeholder={NAMES[species][0]} aria-label="Pet name" onChange={(e) => setName(e.target.value)} />
        </div>
        <Button disabled={!what.trim() || crisis || restriction} onClick={save}>Add track</Button>
        <p className="muted small">Each track has its own pet, plan, check-ins and history. Your voice and reminders stay shared.</p>
      </div>
    </Sheet>
  );
}
