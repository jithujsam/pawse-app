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
