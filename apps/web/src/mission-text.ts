import type { AdoptionMode } from "@detox/engine";
import { t, type PlainId } from "./text";

/**
 * The words for each condition (Rescue) or skill (Raise), by mission id. Every id is written out in full so the
 * catalogue can see it is used (test/copy-catalogue.test.ts) and a typo is a compile error. Mission content is
 * tone-neutral: it describes the fictional pet, not the person.
 */
type Content = { title: PlainId; why: PlainId };

const CONTENT: Record<string, Content> = {
  rescue_coat: { title: "missions.content.rescue_coat_title", why: "missions.content.rescue_coat_why" },
  rescue_energy: { title: "missions.content.rescue_energy_title", why: "missions.content.rescue_energy_why" },
  rescue_noise: { title: "missions.content.rescue_noise_title", why: "missions.content.rescue_noise_why" },
  rescue_play: { title: "missions.content.rescue_play_title", why: "missions.content.rescue_play_why" },
  rescue_alone: { title: "missions.content.rescue_alone_title", why: "missions.content.rescue_alone_why" },
  rescue_trust: { title: "missions.content.rescue_trust_title", why: "missions.content.rescue_trust_why" },
  raise_name: { title: "missions.content.raise_name_title", why: "missions.content.raise_name_why" },
  raise_routine: { title: "missions.content.raise_routine_title", why: "missions.content.raise_routine_why" },
  raise_fetch: { title: "missions.content.raise_fetch_title", why: "missions.content.raise_fetch_why" },
  raise_explore: { title: "missions.content.raise_explore_title", why: "missions.content.raise_explore_why" },
  raise_calm: { title: "missions.content.raise_calm_title", why: "missions.content.raise_calm_why" },
  raise_strong: { title: "missions.content.raise_strong_title", why: "missions.content.raise_strong_why" },
};

export function missionText(id: string): { title: string; why: string } {
  const c = CONTENT[id];
  if (!c) return { title: id, why: "" };
  return { title: t(c.title as never), why: t(c.why as never) };
}

/** Rescue heals conditions; Raise learns skills. */
export const healedWord = (mode: AdoptionMode) => (mode === "rescue" ? t("missions.sheet.healed") : t("missions.sheet.learned"));
export const currentWord = (mode: AdoptionMode) => (mode === "rescue" ? t("missions.sheet.in_treatment") : t("missions.sheet.learning"));

/** Mission ids that have words. The tests check every engine mission is here. */
export const MISSION_TEXT_IDS = Object.keys(CONTENT);
