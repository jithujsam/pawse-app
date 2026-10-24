import { describe, expect, it } from "vitest";
import { hasCrisisLanguage } from "../src/crisis";
import { planHasCrisis } from "../src/screens/Plan";
import { emptyPlan } from "../src/store";

describe("crisis language", () => {
  it("catches common ways of saying it, including the new phrasings", () => {
    for (const t of ["I want to die", "thinking about suicide", "I can't go on like this", "I don't want to be here anymore", "I might take my own life", "self-harm again"]) expect(hasCrisisLanguage(t)).toBe(true);
  });
  it("leaves ordinary recovery notes alone", () => {
    for (const t of ["Long day, ordered on autopilot", "I'll go on a walk instead", "dying to try the new place", "killed it at work, then scrolled"]) expect(hasCrisisLanguage(t)).toBe(false);
  });
  it("checks every free-text part of the plan before it can be saved", () => {
    expect(planHasCrisis({ ...emptyPlan(), reasons: ["Money"], firstStep: "Log out" })).toBe(false);
    expect(planHasCrisis({ ...emptyPlan(), situations: ["when I want to die"] })).toBe(true);
    expect(planHasCrisis({ ...emptyPlan(), ifThen: ["If I can't go on, then..."] })).toBe(true);
  });
});
