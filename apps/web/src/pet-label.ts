import { STAGE_LABEL, type Stage } from "@detox/engine";
import { SPECIES } from "./pets";
import { t } from "./text";
import type { Species } from "./types";

const MOODS: Record<string, string> = {
  idle: t("pet.look.mood_idle"), waiting: t("pet.look.mood_waiting"), happy: t("pet.look.mood_happy"), hurt: t("pet.look.mood_hurt"),
  sick: t("pet.look.mood_sick"), dying: t("pet.look.mood_dying"), sad: t("pet.look.mood_sad"),
};

/** A pet in words for a screen reader: "Dog, adult, happy". Never the internal ids. */
export const describePet = (species: Species, stage: Stage, mood: string): string =>
  t("pet.look.label", { species: SPECIES.find((s) => s.id === species)?.label ?? species, stage: STAGE_LABEL[stage].toLowerCase(), mood: MOODS[mood] ?? MOODS.idle });
