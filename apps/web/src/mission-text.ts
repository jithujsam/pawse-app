import type { AdoptionMode, MissionStatus } from "@detox/engine";
import { t, type PlainId } from "./text";

/**
 * The words for each mission, by mission id. Every id is written out in full so the catalogue can see it is used
 * (test/copy-catalogue.test.ts) and a typo is a compile error. Mission content is tone-neutral: it describes the
 * fictional pet, not the person.
 */
type Content = { title: PlainId; why: PlainId; effect: PlainId; unlock: PlainId };

const CONTENT: Record<string, Content> = {
  rescue_trust: { title: "missions.content.rescue_trust_title", why: "missions.content.rescue_trust_why", effect: "missions.content.rescue_trust_effect", unlock: "missions.content.rescue_trust_unlock" },
  rescue_physical: { title: "missions.content.rescue_physical_title", why: "missions.content.rescue_physical_why", effect: "missions.content.rescue_physical_effect", unlock: "missions.content.rescue_physical_unlock" },
  rescue_fear: { title: "missions.content.rescue_fear_title", why: "missions.content.rescue_fear_why", effect: "missions.content.rescue_fear_effect", unlock: "missions.content.rescue_fear_unlock" },
  rescue_confidence: { title: "missions.content.rescue_confidence_title", why: "missions.content.rescue_confidence_why", effect: "missions.content.rescue_confidence_effect", unlock: "missions.content.rescue_confidence_unlock" },
  rescue_play: { title: "missions.content.rescue_play_title", why: "missions.content.rescue_play_why", effect: "missions.content.rescue_play_effect", unlock: "missions.content.rescue_play_unlock" },
  rescue_safe: { title: "missions.content.rescue_safe_title", why: "missions.content.rescue_safe_why", effect: "missions.content.rescue_safe_effect", unlock: "missions.content.rescue_safe_unlock" },
  raise_bond: { title: "missions.content.raise_bond_title", why: "missions.content.raise_bond_why", effect: "missions.content.raise_bond_effect", unlock: "missions.content.raise_bond_unlock" },
  raise_play: { title: "missions.content.raise_play_title", why: "missions.content.raise_play_why", effect: "missions.content.raise_play_effect", unlock: "missions.content.raise_play_unlock" },
  raise_explore: { title: "missions.content.raise_explore_title", why: "missions.content.raise_explore_why", effect: "missions.content.raise_explore_effect", unlock: "missions.content.raise_explore_unlock" },
  raise_strong: { title: "missions.content.raise_strong_title", why: "missions.content.raise_strong_why", effect: "missions.content.raise_strong_effect", unlock: "missions.content.raise_strong_unlock" },
  raise_confidence: { title: "missions.content.raise_confidence_title", why: "missions.content.raise_confidence_why", effect: "missions.content.raise_confidence_effect", unlock: "missions.content.raise_confidence_unlock" },
  raise_routines: { title: "missions.content.raise_routines_title", why: "missions.content.raise_routines_why", effect: "missions.content.raise_routines_effect", unlock: "missions.content.raise_routines_unlock" },
};

const STATUS: Record<AdoptionMode, Record<MissionStatus, PlainId>> = {
  rescue: {
    starting: "missions.status.rescue_starting", first_steps: "missions.status.rescue_first_steps", stabilizing: "missions.status.rescue_stabilizing",
    recovering: "missions.status.rescue_recovering", strong: "missions.status.rescue_strong", final: "missions.status.rescue_final", done: "missions.status.rescue_done",
  },
  raise: {
    starting: "missions.status.raise_starting", first_steps: "missions.status.raise_first_steps", stabilizing: "missions.status.raise_stabilizing",
    recovering: "missions.status.raise_recovering", strong: "missions.status.raise_strong", final: "missions.status.raise_final", done: "missions.status.raise_done",
  },
};

export function missionText(id: string): { title: string; why: string; effect: string; unlock: string } {
  const c = CONTENT[id];
  if (!c) return { title: id, why: "", effect: "", unlock: "" };
  return { title: t(c.title as never), why: t(c.why as never), effect: t(c.effect as never), unlock: t(c.unlock as never) };
}

export const statusText = (mode: AdoptionMode, status: MissionStatus) => t(STATUS[mode][status] as never);

/** The word for a finished mission: Recovered for a rescue, Mastered for a raised puppy. */
export const doneWord = (mode: AdoptionMode) => (mode === "rescue" ? t("missions.sheet.status_recovered") : t("missions.sheet.status_mastered"));

/** Mission ids that have words. The tests check every engine mission is here. */
export const MISSION_TEXT_IDS = Object.keys(CONTENT);
