import { describe, expect, it } from "vitest";
import { ISSUE_IDS, MISSIONS } from "@detox/engine";
import { MISSION_TEXT_IDS, missionText, rewardName } from "../src/mission-text";

describe("mission words", () => {
  it("every condition, skill and issue has words", () => {
    expect([...MISSION_TEXT_IDS].sort()).toEqual([...MISSIONS.map((m) => m.id), ...ISSUE_IDS].sort());
    for (const id of MISSION_TEXT_IDS) expect(missionText(id).why.length).toBeGreaterThan(10);
  });
  it("rewards are named, then counted by month", () => {
    expect([1, 2, 3, 4, 5].map(rewardName)).toEqual(["One week strong", "Two weeks strong", "Fully consistent", "Month 1 thriving", "Month 2 thriving"]);
  });
});

import { packFor, packLine } from "../src/mission-text";

describe("talking-pet packs", () => {
  it("each named habit gets its own pack; custom or sensitive habits get the generic one", () => {
    expect(packFor("food_spending")).toBe("food");
    expect(packFor("smoking")).toBe("smoking");
    expect(packFor("custom")).toBe("any");
    expect(packFor(undefined)).toBe("any");
  });
  it("lines exist in every Voice and never use body or weight words", () => {
    for (const cls of ["food_spending", "smoking", "alcohol", "doomscrolling", "impulse_buying", "custom"] as const)
      for (const kind of ["story", "thanks", "slip"] as const)
        for (const tone of ["gentle", "honest", "brutal"] as const) {
          const line = packLine(cls, kind, tone);
          expect(line.length).toBeGreaterThan(10);
          expect(line).not.toMatch(/\b(weight|fat|calorie|diet|body)\b/i);
        }
  });
});
