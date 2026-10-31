import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MISSIONS, missionState } from "@detox/engine";
import { MissionCard } from "../src/screens/MissionsSheet";
import { MISSION_TEXT_IDS, missionText } from "../src/mission-text";
import { shownHealth } from "../src/missions";

/** The mission card, rendered as the sheet shows it: headline, why, how severe, days left. */
const card = (id: string, days: number, completed: string[] = []) => {
  const def = MISSIONS.find((m) => m.id === id)!;
  const s = missionState(def, { goalMetDays: days, completed });
  return renderToString(createElement(MissionCard, { s, mode: def.mode })).replace(/<!-- -->/g, "").replace(/&#x27;/g, "'");
};
const redBoxes = (h: string) => (h.match(/data-on="true"/g) ?? []).length;

describe("mission cards", () => {
  it("every mission has words", () => {
    expect([...MISSION_TEXT_IDS].sort()).toEqual(MISSIONS.map((m) => m.id).sort());
    for (const m of MISSIONS) expect(missionText(m.id).why.length).toBeGreaterThan(10);
  });
  it("a rescue card is a headline, why it matters, how severe and the goal-met days left", () => {
    const h = card("rescue_trust", 8);
    for (const s of ["Rebuilding Trust", "The puppy is hesitant around people", "How severe", "Moderate · -6", "22 more goal-met days to recover"]) expect(h).toContain(s);
    expect(redBoxes(h)).toBe(3);
    // Nothing else: no levels, statuses or expandable details.
    expect(h).not.toMatch(/Level|Status|Details|aria-expanded/);
  });
  it("severity starts at five red boxes and falls to one", () => {
    expect(card("rescue_fear", 0)).toContain("Severe · -10");
    expect(redBoxes(card("rescue_fear", 0))).toBe(5);
    expect(redBoxes(card("rescue_fear", 24))).toBe(1);
    expect(card("rescue_fear", 29)).toContain("1 more goal-met day to recover");
  });
  it("a raise card shows development, never a negative value", () => {
    const h = card("raise_bond", 8);
    for (const s of ["Building Our Bond", "Development", "40 / 100", "22 more goal-met days to master"]) expect(h).toContain(s);
    expect(h).not.toMatch(/-\d|How severe/);
  });
  it("a finished mission shows a check and Recovered or Mastered, and nothing to do", () => {
    const r = card("rescue_trust", 30);
    expect(r).toContain("Recovered");
    expect(r).toContain('data-done="true"');
    expect(r).not.toMatch(/How severe|more goal-met/);
    expect(card("raise_bond", 30)).toContain("Mastered");
    expect(card("rescue_play", 5, ["rescue_play"])).toContain("Recovered");
  });
});

describe("the health bar", () => {
  it("is the pet's health limited by its missions", () => {
    expect(shownHealth(0, 10)).toBe(10);
    expect(shownHealth(0, 100)).toBe(100);
    expect(shownHealth(20, 55)).toBe(44);
  });
});
