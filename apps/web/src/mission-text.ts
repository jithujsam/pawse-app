import type { AdoptionMode } from "@detox/engine";
import { t, type PlainId } from "./text";

/**
 * The words for each mission, by mission id. Every id is written out in full so the catalogue can see it is used
 * (test/copy-catalogue.test.ts) and a typo is a compile error. Mission content is tone-neutral: it describes the
 * fictional pet, not the person.
 */
type Content = { title: PlainId; why: PlainId };

const CONTENT: Record<string, Content> = {
  rescue_trust: { title: "missions.content.rescue_trust_title", why: "missions.content.rescue_trust_why" },
  rescue_physical: { title: "missions.content.rescue_physical_title", why: "missions.content.rescue_physical_why" },
  rescue_fear: { title: "missions.content.rescue_fear_title", why: "missions.content.rescue_fear_why" },
  rescue_confidence: { title: "missions.content.rescue_confidence_title", why: "missions.content.rescue_confidence_why" },
  rescue_play: { title: "missions.content.rescue_play_title", why: "missions.content.rescue_play_why" },
  rescue_safe: { title: "missions.content.rescue_safe_title", why: "missions.content.rescue_safe_why" },
  raise_bond: { title: "missions.content.raise_bond_title", why: "missions.content.raise_bond_why" },
  raise_play: { title: "missions.content.raise_play_title", why: "missions.content.raise_play_why" },
  raise_explore: { title: "missions.content.raise_explore_title", why: "missions.content.raise_explore_why" },
  raise_strong: { title: "missions.content.raise_strong_title", why: "missions.content.raise_strong_why" },
  raise_confidence: { title: "missions.content.raise_confidence_title", why: "missions.content.raise_confidence_why" },
  raise_routines: { title: "missions.content.raise_routines_title", why: "missions.content.raise_routines_why" },
};


export function missionText(id: string): { title: string; why: string } {
  const c = CONTENT[id];
  if (!c) return { title: id, why: "" };
  return { title: t(c.title as never), why: t(c.why as never) };
}

const SEVERITY: Record<number, PlainId> = {
  6: "missions.sheet.severity_6", 5: "missions.sheet.severity_5", 4: "missions.sheet.severity_4",
  3: "missions.sheet.severity_3", 2: "missions.sheet.severity_2", 1: "missions.sheet.severity_1",
};
/** How severe a rescue mission still is, in a word, from its level. */
export const severityWord = (level: number) => t(SEVERITY[level] as never);

/** The word for a finished mission: Recovered for a rescue, Mastered for a raised puppy. */
export const doneWord = (mode: AdoptionMode) => (mode === "rescue" ? t("missions.sheet.status_recovered") : t("missions.sheet.status_mastered"));

/** Mission ids that have words. The tests check every engine mission is here. */
export const MISSION_TEXT_IDS = Object.keys(CONTENT);
