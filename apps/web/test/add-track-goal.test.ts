import { describe, expect, it } from "vitest";
import { actions, emptyPlan, getData } from "../src/store";
import { blank } from "../src/persist";
import { goalTarget } from "../src/goal";
import { trackState } from "../src/tracks";

const add = (extra: Parameters<typeof actions.addTrack>[0] extends infer O ? Partial<O> : never) =>
  actions.addTrack({ what: "Late-night scrolling", cls: "doomscrolling", measure: "minutes", species: "cat", name: "Miso", ...extra });

describe("adding another pet with a goal", () => {
  it("starts with the goal, the starting point and who they want to be, and leaves other tracks alone", () => {
    actions.applyRemote({ ...blank(), settings: { ...blank().settings, onboarded: true } });
    const first = add({})!;
    expect(trackState(getData(), first).plan).toBeNull();

    const second = add({ what: "Smoking", cls: "smoking", plan: { ...emptyPlan(), goal: "reduce", limitPerWeek: 4, identity: "Someone who reads every night" }, baseline: "daily" })!;
    const s = trackState(getData(), second);
    expect(goalTarget(s.plan)).toEqual({ kind: "limit", perWeek: 4 });
    expect(s.plan?.identity).toBe("Someone who reads every night");
    expect(s.baseline).toBe("daily");
    expect(trackState(getData(), first).plan).toBeNull();
  });

  it("works without a goal, as before", () => {
    const id = add({ what: "Snacking" })!;
    expect(trackState(getData(), id)).toMatchObject({ plan: null, baseline: null });
  });

  it("refuses text the safety check blocks, the same as every other typed text", () => {
    const before = getData().habits.length;
    expect(add({ plan: { ...emptyPlan(), goal: "stop", identity: "I want to end my life" } })).toBeNull();
    expect(getData().habits.length).toBe(before);
  });
});
