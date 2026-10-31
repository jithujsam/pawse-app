import type { AdoptionMode } from "@detox/engine";
import type { HabitClass } from "@detox/engine";
import { t, tt, type PlainId, type ToneId } from "./text";
import type { Tone } from "./types";

/**
 * The words for each condition (Rescue), skill (Raise) or issue, by id. Every id is written out in full so the
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
  issue_stomach: { title: "missions.content.issue_stomach_title", why: "missions.content.issue_stomach_why" },
  issue_restless: { title: "missions.content.issue_restless_title", why: "missions.content.issue_restless_why" },
  issue_itch: { title: "missions.content.issue_itch_title", why: "missions.content.issue_itch_why" },
  issue_fear: { title: "missions.content.issue_fear_title", why: "missions.content.issue_fear_why" },
  issue_withdrawn: { title: "missions.content.issue_withdrawn_title", why: "missions.content.issue_withdrawn_why" },
};

export function missionText(id: string): { title: string; why: string } {
  const c = CONTENT[id];
  if (!c) return { title: id, why: "" };
  return { title: t(c.title as never), why: t(c.why as never) };
}

/** Rescue heals conditions; Raise learns skills. */
export const healedWord = (mode: AdoptionMode) => (mode === "rescue" ? t("missions.sheet.healed") : t("missions.sheet.learned"));

const TIER: Record<1 | 2 | 3, PlainId> = { 1: "missions.sheet.issue_minor", 2: "missions.sheet.issue_moderate", 3: "missions.sheet.issue_serious" };
export const tierWord = (tier: 1 | 2 | 3) => t(TIER[tier] as never);

/** A reward's name: the three consistency rewards, then a month of thriving each. */
export const rewardName = (n: number) =>
  n === 1 ? t("missions.sheet.reward_1") : n === 2 ? t("missions.sheet.reward_2") : n === 3 ? t("missions.sheet.reward_3") : t("missions.sheet.reward_month", { n: n - 3 });

/** Mission ids that have words. The tests check every engine mission is here. */
export const MISSION_TEXT_IDS = Object.keys(CONTENT);

/** Which talking-pet pack a habit gets. Anything that isn't one of these five (custom, sensitive) gets the generic pack. */
const PACK: Partial<Record<HabitClass, string>> = { food_spending: "food", smoking: "smoking", alcohol: "alcohol", doomscrolling: "scroll", impulse_buying: "shop" };
const PACK_IDS: Record<string, Record<"story" | "thanks" | "slip", ToneId>> = {
  food: { story: "packs.lines.food_story", thanks: "packs.lines.food_thanks", slip: "packs.lines.food_slip" },
  smoking: { story: "packs.lines.smoking_story", thanks: "packs.lines.smoking_thanks", slip: "packs.lines.smoking_slip" },
  alcohol: { story: "packs.lines.alcohol_story", thanks: "packs.lines.alcohol_thanks", slip: "packs.lines.alcohol_slip" },
  scroll: { story: "packs.lines.scroll_story", thanks: "packs.lines.scroll_thanks", slip: "packs.lines.scroll_slip" },
  shop: { story: "packs.lines.shop_story", thanks: "packs.lines.shop_thanks", slip: "packs.lines.shop_slip" },
  any: { story: "packs.lines.any_story", thanks: "packs.lines.any_thanks", slip: "packs.lines.any_slip" },
};
export const packFor = (cls: HabitClass | undefined) => PACK[cls ?? "custom"] ?? "any";

/** A line from the habit's talking-pet pack, in the person's Voice. No typed text is ever put into it. */
export const packLine = (cls: HabitClass | undefined, kind: "story" | "thanks" | "slip", tone: Tone) => tt(PACK_IDS[packFor(cls)][kind] as never, tone);
