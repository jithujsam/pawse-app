import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { journey, MISSIONS, type DayRecord } from "@detox/engine";
import { MissionCard } from "../src/screens/MissionsSheet";
import { MISSION_TEXT_IDS, missionText } from "../src/mission-text";

const days = (n: number): DayRecord[] => Array.from({ length: n }, (_, i) => ({ day: `2026-01-${String(i + 1).padStart(2, "0")}`, met: true, slip: false }));
const cards = (mode: "rescue" | "raise", n: number) =>
  journey(mode, 30, days(n)).missions.map((s) => renderToString(createElement(MissionCard, { s, mode })).replace(/<!-- -->/g, "").replace(/&#x27;/g, "'"));
const on = (h: string) => (h.match(/data-on="true"/g) ?? []).length;

describe("condition cards", () => {
  it("every condition and skill has words", () => {
    expect([...MISSION_TEXT_IDS].sort()).toEqual(MISSIONS.map((m) => m.id).sort());
    for (const m of MISSIONS) expect(missionText(m.id).why.length).toBeGreaterThan(10);
  });
  it("healed, in treatment and next, with days in a row; no negative numbers anywhere", () => {
    const c = cards("rescue", 8); // coat, energy, noise healed; 2 of 4 on play
    expect(c[0]).toContain("Itchy, patchy coat");
    expect(c[0]).toContain("Healed");
    expect(c[3]).toContain("In treatment");
    expect(c[3]).toContain("2 of 4 days in a row");
    expect(on(c[3])).toBe(2);
    expect(c[4]).toContain("Needs 5 goal-met days in a row");
    expect(c[5]).toContain("Afraid of people");
    for (const h of c) expect(h).not.toMatch(/-\d/);
  });
  it("a raised puppy's cards say learned and learning", () => {
    const c = cards("raise", 1);
    expect(c[0]).toContain("Learned");
    expect(c[1]).toContain("Learning");
  });
});
