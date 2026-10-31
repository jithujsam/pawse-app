import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MISSIONS, missionState, missionStates } from "@detox/engine";
import { MissionCard } from "../src/screens/MissionsSheet";
import { MISSION_TEXT_IDS, missionText } from "../src/mission-text";

/** The mission card, rendered as the sheet shows it, in both modes. */
const card = (id: string, days: number, initialOpen = false, completed: string[] = []) => {
  const def = MISSIONS.find((m) => m.id === id)!;
  const s = missionState(def, { goalMetDays: days, completed });
  const html = renderToString(createElement(MissionCard, { s, mode: def.mode, name: "Scout", goalMetDays: days, initialOpen }));
  return html.replace(/<!-- -->/g, "").replace(/&#x27;/g, "'");
};

describe("mission cards", () => {
  it("every mission has words", () => {
    expect(MISSION_TEXT_IDS.sort()).toEqual(MISSIONS.map((m) => m.id).sort());
    for (const m of MISSIONS) expect(missionText(m.id).title).not.toMatch(/^missions\./);
  });
  it("a rescue card shows title, level, condition, progress, next milestone and status", () => {
    const h = card("rescue_trust", 8);
    for (const s of ["Rebuilding Trust", "Level 4 / 6", "Condition", "-6 / 0", "Progress", "8 / 12 goal-met days", "Next milestone", "Level 3", "Stabilising"]) expect(h).toContain(s);
    expect(h).toContain('aria-expanded="false"');
    expect(h).not.toContain("Why this matters");
  });
  it("a raise card shows development out of 100 and never a negative value", () => {
    const h = card("raise_bond", 8);
    for (const s of ["Building Our Bond", "Level 4 / 6", "Development", "40 / 100", "8 / 12 goal-met days", "Level 3"]) expect(h).toContain(s);
    expect(h).not.toMatch(/-\d+ \/ 0|Condition/);
  });
  it("an expanded card explains why, how it shows, what's next, what it takes and the milestones reached", () => {
    const h = card("rescue_fear", 13, true);
    expect(h).toContain('aria-expanded="true"');
    for (const s of ["Why this matters", "How it shows", "What the next step unlocks", "What it takes", "Reach 18 goal-met days since Scout arrived", "Optional extra", "0 of 5 urges managed", "Milestones reached", "Level 5", "Level 4", "Level 3"]) expect(h).toContain(s);
  });
  it("a new mission says no milestones yet", () => {
    expect(card("rescue_safe", 0, true)).toContain("None yet");
  });
  it("a finished rescue mission is Recovered at 0 with a check; a raised one is Mastered at 100", () => {
    const r = card("rescue_trust", 30);
    expect(r).toContain("Rebuilding Trust — Recovered");
    expect(r).toContain("0 / 0");
    expect(r).toContain("mission-pill done");
    expect(r).not.toContain("Next milestone");
    const g = card("raise_bond", 30);
    expect(g).toContain("Building Our Bond — Mastered");
    expect(g).toContain("100 / 100");
  });
  it("a remembered completion shows as finished even below 30 days", () => {
    expect(card("rescue_play", 5, false, ["rescue_play"])).toContain("Learning to Play — Recovered");
  });
  it("both modes share the same card structure", () => {
    const strip = (h: string) => h.replace(/>[^<]*</g, "><").replace(/(aria-[a-z]+|id|data-mode|aria-controls)="[^"]*"/g, "");
    const a = missionStates("rescue", { goalMetDays: 8 })[0], b = missionStates("raise", { goalMetDays: 8 })[0];
    const ha = renderToString(createElement(MissionCard, { s: a, mode: "rescue", name: "Scout", goalMetDays: 8 }));
    const hb = renderToString(createElement(MissionCard, { s: b, mode: "raise", name: "Scout", goalMetDays: 8 }));
    expect(strip(ha)).toEqual(strip(hb));
  });
});
