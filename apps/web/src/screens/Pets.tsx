import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { STAGE_LABEL, type AdoptionMode } from "@detox/engine";
import { companionMissions, RESCUE_SPECIES } from "../missions";
import { moodFor, PetPortrait } from "../Companion";
import { has3D, STYLE_3D } from "../pet3d-support";
import { pauseHint, pauseRefused, pauseToast, resumeHint, resumeToast } from "../copy";
import { concernIn, concernInAny } from "../guard";
import { t } from "../text";
import { today } from "../dates";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { BREEDS, NAMES, PERSONALITIES, PICKABLE, SPECIES, breedFor, coatsFor } from "../pets";
import { AMOUNT_CHOICES, HABIT_CHOICES, inferClass, measureForLabel, NO_AMOUNT } from "../questions";
import { dayStatus, STATUS_LABEL } from "../recovery";
import { actions, useData, viewCompanion } from "../store";
import { focusedTrackId, listTracks, trackState } from "../tracks";
import type { Personality, Species } from "../types";
import { Button, Icon, plainOpts, Select, SelectOther } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";

/** Every 3D pet is its own graphics context, which phones cap, so only the first few cards are 3D. */
const MAX_3D_CARDS = 8;

/**
 * The Pets tab: one card per recovery track. Each track is a habit with its own companion, so the grid is
 * built straight from the stored habits; nothing here is calculated that the rest of the app doesn't already show.
 */
export function Pets({ onOpen }: { onOpen: (habitId: string) => void }) {
  const data = useData();
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  // Grid or list, remembered on this phone only (a display choice, never synced).
  const [layout, setLayout] = useState<"grid" | "list">(() => { try { return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; } });
  const pickLayout = (v: "grid" | "list") => { haptic.select(); setLayout(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* private mode */ } };
  const t0 = today();
  // Archived tracks are read-only and leave the grid; a track whose pet is missing (damaged data) is skipped
  // rather than crashing the grid.
  const tracks = useMemo(() => listTracks(data, ["active", "paused"]).filter((t) => t.companion).map(({ habit }) => {
    const view = viewCompanion(data, habit.companionId, t0);
    const status = dayStatus(data, habit.id, t0, t0);
    const missions = companionMissions(data, habit.companionId, t0);
    // A rescue shows its conditions here too, the same as on the pet's own screen.
    return { habit, view, status, paused: trackState(data, habit.id).status === "paused", wellness: missions?.healthCap ?? 100, condition: missions?.mode === "rescue" ? missions.traits : undefined };
  }), [data, t0]);
  const open = (id: string) => { haptic.tap(); actions.selectTrack(id); onOpen(id); };

  return (
    <main className="screen">
      <header className="pets-head">
        <div className="stack tight">
          <h1>{t("pets.grid.title")}</h1>
          <p className="muted small">{t("pets.grid.intro")}</p>
        </div>
        {tracks.length > 0 && (
          <div className="layout-toggle" role="radiogroup" aria-label={t("pets.grid.layout")}>
            <button type="button" role="radio" aria-checked={layout === "grid"} aria-label={t("pets.grid.layout_grid")} onClick={() => pickLayout("grid")}>{Icon.grid}</button>
            <button type="button" role="radio" aria-checked={layout === "list"} aria-label={t("pets.grid.layout_list")} onClick={() => pickLayout("list")}>{Icon.list}</button>
          </div>
        )}
      </header>

      {tracks.length === 0 ? (
        <section className="card stack center-text">
          <h2>{t("pets.grid.empty_title")}</h2>
          <p className="muted">{t("pets.grid.empty_body")}</p>
          <Button onClick={() => setAdding(true)}>{t("pets.grid.add")}</Button>
        </section>
      ) : (
        <section className="pet-grid" data-layout={layout} aria-label={t("pets.grid.tracks")}>
          {tracks.map(({ habit, view, status, paused, wellness, condition }, i) => {
            const checked = status === "met" || status === "lapse" || status === "urge";
            const mood = moodFor(view.stage, { checkedToday: checked, slippedToday: status === "lapse", age: view.age, notTracking: paused || status === "rest" || status === "paused" });
            // A paused track says so first; today's state still shows when something was logged.
            const day = status === "unrecorded" ? t("pets.grid.not_checked_in") : STATUS_LABEL[status];
            const line = view.dead ? STAGE_LABEL.dead : paused ? (checked ? t("pets.grid.paused_with", { day }) : t("pets.grid.paused")) : t("pets.grid.line", { wellness, day });
            return (
              <div key={habit.id} className="pet-card-wrap">
                <motion.button className="pet-card" data-active={habit.id === focusedTrackId(data)} data-paused={paused}
                  onClick={() => open(habit.id)} whileTap={{ scale: 0.97 }} transition={spring.snappy}
                  aria-label={t("pets.grid.card", { pet: view.companion.name, track: habit.name, line })}>
                  <span className="pet-card-art" aria-hidden>
                    <PetPortrait still={i >= MAX_3D_CARDS} species={view.companion.species} coat={view.companion.coat} breed={view.companion.breed} stage={view.stage} mood={mood} age={view.age} condition={condition} size={layout === "list" ? 84 : 100} />
                  </span>
                  <b className="pet-card-name">{view.companion.name}</b>
                  <span className="pet-card-track small">{habit.name}</span>
                  <span className="pet-card-status small" data-s={paused ? "paused" : status}>{line}</span>
                </motion.button>
                <button className="icon-btn pet-card-more" aria-haspopup="dialog" aria-label={t("pets.grid.more", { track: habit.name })} onClick={() => { haptic.tap(); setMenu(habit.id); }}>{Icon.more}</button>
              </div>
            );
          })}
          {data.habits.length < 50 && <motion.button className="pet-card pet-card-add" onClick={() => { haptic.tap(); setAdding(true); }} whileTap={{ scale: 0.97 }} transition={spring.snappy}>
            <span className="pet-card-plus" aria-hidden>{Icon.plus}</span>
            <b className="pet-card-name">{t("pets.grid.add")}</b>
            <span className="pet-card-track small muted">{t("pets.grid.add_hint")}</span>
          </motion.button>}
        </section>
      )}

      <TrackMenu habitId={menu} onClose={() => setMenu(null)} onOpen={(id) => { setMenu(null); open(id); }} />
      <AddTrack open={adding} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); onOpen(id); }} />
    </main>
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
  const [confirming, setConfirming] = useState(false);
  const remove = () => {
    if (!habit) return;
    const backup = actions.deleteTrack(habit.id, habit.name);
    if (!backup) { haptic.warn(); return; }
    haptic.success();
    setConfirming(false);
    onClose();
    toast(t("pets.menu.deleted", { name: companion?.name ?? t("pets.menu.your_pet") }), { action: { label: t("ui.common.undo"), run: () => { actions.restoreTrack(backup); } } });
  };
  const close = () => { setConfirming(false); onClose(); };
  const name = companion?.name ?? t("pets.menu.this_pet");
  return (
    <Sheet open={!!habit} onClose={close} label={habit ? t("pets.menu.label", { name }) : t("pets.menu.label_none")}>
      {habit && confirming && <div className="stack">
        <h2>{t("pets.menu.confirm_title", { name })}</h2>
        <p className="muted">{t("pets.menu.confirm_body", { name, track: habit.name })}</p>
        <Button variant="danger" onClick={remove}>{t("pets.menu.confirm_yes", { name })}</Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>{t("pets.menu.keep", { name })}</Button>
      </div>}
      {habit && !confirming && <div className="stack track-menu">
        <div className="stack tight">
          <h2>{name}</h2>
          <p className="muted small">{habit.name}{paused ? t("pets.menu.paused_suffix") : ""}</p>
        </div>
        <div className="track-menu-actions">
          <Button onClick={() => onOpen(habit.id)}>{t("pets.menu.open", { name })}</Button>
          <Button variant="secondary" onClick={toggle}>{paused ? t("pets.menu.resume") : t("pets.menu.pause")}</Button>
          <p className="muted small">{paused ? resumeHint(tone) : pauseHint(tone)}</p>
        </div>
        <div className="track-menu-danger">
          <Button variant="danger" onClick={() => setConfirming(true)}>{t("pets.menu.delete", { name })}</Button>
        </div>
      </div>}
    </Sheet>
  );
}

const LAYOUT_KEY = "pawse/pets-layout";

export interface PetPick { species: Species; coat: string; breed: string; personality: Personality; name: string; adoption?: AdoptionMode }
export const firstPet = (species: Species = "dog"): PetPick => ({ species, coat: "", breed: "", personality: "playful", name: "", adoption: "raise" });

/**
 * Step one of making a pet: every pet on show to pick from, then its name, coat and personality. Used when setting
 * up the app and when adding a recovery track, so a pet is made the same way both times.
 */
export function PetStep({ pet, onChange, compact }: { pet: PetPick; onChange: (p: Partial<PetPick>) => void; compact?: boolean }) {
  const coat = pet.coat || coatsFor(pet.species, pet.breed)[0].id;
  return (
    <div className="stack">
      <div className="species-grid" role="radiogroup" aria-label={t("pets.picker.group")}>
        {PICKABLE.map((s) => (
          <motion.button key={s.id} type="button" role="radio" aria-checked={pet.species === s.id} className="species-card" data-on={pet.species === s.id}
            whileTap={{ scale: 0.95 }} transition={spring.snappy} onClick={() => { haptic.select(); onChange({ species: s.id, coat: "", breed: "", name: pet.name && NAMES[pet.species].includes(pet.name) ? "" : pet.name }); }}>
            <motion.div animate={pet.species === s.id ? { y: [0, -8, 0] } : { y: 0 }} transition={{ duration: 0.5 }}>
              <PetPortrait species={s.id} stage="baby" mood={pet.species === s.id ? "happy" : "idle"} age={2} size={68} />
            </motion.div>
            <b>{has3D(s.id) ? STYLE_3D[s.id].label : s.label}</b>
          </motion.button>
        ))}
      </div>
      <p className="muted small center-text">{SPECIES.find((s) => s.id === pet.species)!.blurb}</p>
      <div className="field"><span className="field-label">{t("pets.picker.name")}</span>
        <SelectOther key={pet.species} label={t("pets.picker.name_aria")} value={pet.name} onChange={(name) => onChange({ name })} options={plainOpts(NAMES[pet.species])} maxLength={20}
          placeholder={t("pets.picker.name_placeholder", { name: NAMES[pet.species][0] })} otherLabel={t("pets.picker.name_other")} otherPlaceholder={t("pets.picker.name_own")} /></div>
      {!compact && <div className="field"><span className="field-label">{t("pets.picker.coat")}</span>
        <Select label={t("pets.picker.coat")} value={coat} options={coatsFor(pet.species, pet.breed).map((c) => ({ value: c.id, label: c.label }))} onChange={(id) => onChange({ coat: id })} /></div>}
      {BREEDS[pet.species] && <div className="field"><span className="field-label">{t("pets.picker.breed")}</span>
        <Select label={t("pets.picker.breed")} value={breedFor(pet.species, pet.breed)?.id ?? ""} options={BREEDS[pet.species]!.map((b) => ({ value: b.id, label: b.label }))} onChange={(id) => onChange({ breed: id })} /></div>}
      {!compact && <div className="field"><span className="field-label">{t("pets.picker.personality")}</span>
        <Select label={t("pets.picker.personality")} value={pet.personality} options={PERSONALITIES.map((p) => ({ value: p.id, label: `${p.label}: ${p.blurb}` }))} onChange={(personality) => onChange({ personality })} /></div>}
      {!compact && <Adoption pet={pet} onChange={onChange} />}
    </div>
  );
}

/** Raise or rescue, for every pet and breed. */
function Adoption({ pet, onChange }: { pet: PetPick; onChange: (p: Partial<PetPick>) => void }) {
  const canRescue = RESCUE_SPECIES.includes(pet.species);
  const mode: AdoptionMode = canRescue && pet.adoption === "rescue" ? "rescue" : "raise";
  return (
    <>
      {canRescue && (
        <div className="field"><span className="field-label">{t("pets.picker.adoption")}</span>
          <div className="segmented" role="radiogroup" aria-label={t("pets.picker.adoption")}>
            {(["raise", "rescue"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className="seg" onClick={() => { haptic.select(); onChange({ adoption: m }); }}>
                {mode === m && <motion.span layoutId="adopt-pill" className="seg-pill" transition={spring.snappy} />}
                <span className="seg-label">{m === "rescue" ? t("pets.picker.rescue") : t("pets.picker.raise")}</span>
              </button>
            ))}
          </div>
          <span className="muted small">{mode === "rescue" ? t("pets.picker.rescue_hint") : t("pets.picker.raise_hint")}</span>
        </div>
      )}
    </>
  );
}

/** Adds a recovery track in two steps: its pet, then what it is for. */
function AddTrack({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (habitId: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pet, setPet] = useState<PetPick>(() => firstPet("cat"));
  const [what, setWhat] = useState("");
  const [amountLabel, setAmountLabel] = useState("");
  const nameConcern = concernIn(pet.name);
  const whatConcern = concernInAny([what, amountLabel]);
  const [formKey, setFormKey] = useState(0);
  const reset = () => { setStep(1); setPet(firstPet("cat")); setWhat(""); setAmountLabel(""); setFormKey((k) => k + 1); };
  const close = () => { reset(); onClose(); };
  const save = () => {
    const petName = pet.name.trim() || NAMES[pet.species][0];
    const id = actions.addTrack({ what, cls: inferClass(what), measure: measureForLabel(amountLabel), amountLabel, species: pet.species, name: petName, coat: pet.coat || undefined, breed: pet.breed || undefined, personality: pet.personality, adoption: pet.adoption });
    if (!id) { haptic.warn(); return; } // the 50-track limit; the add card is hidden before that
    haptic.success();
    toast(t("pets.add.added", { name: petName, what: what.trim() }), { kind: "good" });
    reset();
    onAdded(id);
  };

  return (
    <Sheet open={open} onClose={close} label={t("pets.add.label")}>
      <div className="stack">
        <div className="row"><h2>{step === 1 ? t("pets.add.step1") : t("pets.add.step2")}</h2><span className="muted small">{t("pets.add.step_of", { step })}</span></div>
        {step === 1 && <>
          <PetStep pet={pet} onChange={(p) => setPet((x) => ({ ...x, ...p }))} />
          <Button disabled={nameConcern !== null} onClick={() => { haptic.select(); setStep(2); }}>{t("ui.common.continue")}</Button>
        </>}
        {step === 2 && <>
          <div className="field">
            <span className="field-label">{t("onboarding.change.title")}</span>
            <SelectOther key={formKey} label={t("onboarding.change.aria")} value={what} onChange={setWhat} options={plainOpts(HABIT_CHOICES)} placeholder={t("onboarding.change.field")} otherPlaceholder={t("onboarding.change.own")} />
          </div>
          <div className="field">
            <span className="field-label">{t("onboarding.count.field")}</span>
            <SelectOther key={formKey} label={t("onboarding.count.aria")} value={amountLabel} onChange={(v) => setAmountLabel(v === NO_AMOUNT ? "" : v)} maxLength={40}
              options={[...plainOpts(AMOUNT_CHOICES.map((a) => a.label)), { value: NO_AMOUNT, label: t("onboarding.count.none") }]}
              placeholder={t("onboarding.count.none")} otherPlaceholder={t("onboarding.count.own")} />
          </div>
          <div className="actions">
            <Button variant="secondary" onClick={() => { haptic.select(); setStep(1); }}>{t("ui.common.back")}</Button>
            <Button disabled={!what.trim() || whatConcern !== null || nameConcern !== null} onClick={save}>{t("pets.add.add", { name: pet.name.trim() || NAMES[pet.species][0] })}</Button>
          </div>
          <p className="muted small">{t("pets.add.note")}</p>
        </>}
      </div>
    </Sheet>
  );
}
