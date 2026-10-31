import { describe, expect, it } from "vitest";
import {
  levelForDays, MISSION_THRESHOLDS, missionMilestoneToCelebrate, missionState, missionStates, MISSIONS, missionsFor, newlyCompleted,
  overallProgress, petTraits, setbackState, thresholdsOf, visualStage, type MissionDef,
} from "../src";

const rescue = MISSIONS.find((m) => m.id === "rescue_trust")!;
const raise = MISSIONS.find((m) => m.id === "raise_bond")!;

describe("mission sets", () => {
  it("each mode has six missions with unique ids", () => {
    expect(missionsFor("rescue").map((m) => m.id)).toEqual(["rescue_trust", "rescue_physical", "rescue_fear", "rescue_confidence", "rescue_play", "rescue_safe"]);
    expect(missionsFor("raise").map((m) => m.id)).toEqual(["raise_bond", "raise_play", "raise_explore", "raise_strong", "raise_confidence", "raise_routines"]);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });
  it("new adoptions start every mission at Level 6", () => {
    for (const mode of ["rescue", "raise"] as const) {
      const s = missionStates(mode, { goalMetDays: 0 });
      expect(s).toHaveLength(6);
      expect(s.every((x) => x.level === 6 && !x.completed && x.status === "starting")).toBe(true);
      expect(s.every((x) => x.value === (mode === "rescue" ? -10 : 0))).toBe(true);
    }
  });
});

// PRD §23 schedule: cumulative goal-met days since adoption.
describe("level schedule", () => {
  const table: [number, number, number, number][] = [
    // days, level, rescue condition, raise score
    [0, 6, -10, 0], [2, 6, -10, 0], [3, 5, -8, 20], [6, 5, -8, 20], [7, 4, -6, 40], [11, 4, -6, 40],
    [12, 3, -4, 60], [17, 3, -4, 60], [18, 2, -2, 80], [23, 2, -2, 80], [24, 1, -1, 90], [29, 1, -1, 90], [30, 0, 0, 100], [400, 0, 0, 100],
  ];
  it.each(table)("%i goal-met days → Level %i, condition %i, score %i", (days, level, cond, score) => {
    const r = missionState(rescue, { goalMetDays: days });
    const g = missionState(raise, { goalMetDays: days });
    expect(r.level).toBe(level);
    expect(g.level).toBe(level);
    expect(r.value).toBe(cond);
    expect(g.value).toBe(score);
    expect(r.completed).toBe(level === 0);
  });
  it("the condition reaches exactly 0 and never goes positive; the score reaches exactly 100", () => {
    for (let d = 0; d <= 100; d++) {
      expect(missionState(rescue, { goalMetDays: d }).value).toBeLessThanOrEqual(0);
      expect(missionState(raise, { goalMetDays: d }).value).toBeLessThanOrEqual(100);
    }
    expect(missionState(rescue, { goalMetDays: 30 }).value).toBe(0);
    expect(missionState(raise, { goalMetDays: 30 }).value).toBe(100);
  });
  it("shows the next milestone and the step progress", () => {
    const s = missionState(rescue, { goalMetDays: 8 });
    expect(s).toMatchObject({ level: 4, value: -6, status: "stabilizing", nextAt: 12, nextLevel: 3, prevAt: 7, days: 8, reached: [5, 4] });
    const done = missionState(rescue, { goalMetDays: 31 });
    expect(done).toMatchObject({ level: 0, nextAt: null, nextLevel: null, status: "done", reached: [5, 4, 3, 2, 1, 0] });
  });
  it("is idempotent and ignores junk input", () => {
    expect(missionState(rescue, { goalMetDays: 12 })).toEqual(missionState(rescue, { goalMetDays: 12 }));
    expect(levelForDays(-5)).toBe(6);
    expect(levelForDays(Number.NaN)).toBe(6);
    expect(levelForDays(12.9)).toBe(3);
  });
  it("thresholds are configurable and validated", () => {
    const fast: MissionDef = { ...rescue, thresholds: [1, 2, 3, 4, 5, 6] };
    expect(missionState(fast, { goalMetDays: 6 }).completed).toBe(true);
    expect(thresholdsOf({ thresholds: [5, 4, 3, 2, 1, 0] })).toBe(MISSION_THRESHOLDS);
    expect(thresholdsOf({ thresholds: [1, 2, 3] })).toBe(MISSION_THRESHOLDS);
  });
});

describe("completion is kept", () => {
  it("a latched completion stays Recovered even if a correction lowers the count", () => {
    const s = missionState(rescue, { goalMetDays: 4, completed: ["rescue_trust"] });
    expect(s).toMatchObject({ level: 0, completed: true, value: 0 });
    expect(missionState(MISSIONS[1], { goalMetDays: 4, completed: ["rescue_trust"] }).level).toBe(5);
  });
  it("lists newly completed missions once", () => {
    const states = missionStates("rescue", { goalMetDays: 30 });
    expect(newlyCompleted(states, [])).toHaveLength(6);
    expect(newlyCompleted(states, states.map((s) => s.id))).toEqual([]);
  });
  it("overall progress", () => {
    expect(overallProgress(missionStates("raise", { goalMetDays: 7 }))).toMatchObject({ passed: 12, total: 36, completed: 0, active: 6 });
    expect(overallProgress(missionStates("raise", { goalMetDays: 30 })).pct).toBe(1);
  });
});

describe("optional extras never gate a level", () => {
  it("tracks the extra separately", () => {
    const fear = MISSIONS.find((m) => m.id === "rescue_fear")!;
    const s = missionState(fear, { goalMetDays: 12, extras: { urgesManaged: 2 } });
    expect(s.level).toBe(3);
    expect(s.extra).toEqual({ kind: "urgesManaged", have: 2, target: 5, done: false });
    expect(missionState(fear, { goalMetDays: 0, extras: { urgesManaged: 9 } })).toMatchObject({ level: 6, extra: { have: 5, done: true } });
  });
});

describe("celebrations", () => {
  it("one celebration for the furthest new milestone, then none again", () => {
    const states = missionStates("rescue", { goalMetDays: 12 });
    const c = missionMilestoneToCelebrate(states, [])!;
    expect(c.level).toBe(3);
    expect(c.seen).toHaveLength(18);
    expect(missionMilestoneToCelebrate(states, c.seen)).toBeNull();
    const next = missionMilestoneToCelebrate(missionStates("rescue", { goalMetDays: 18 }), c.seen)!;
    expect(next.level).toBe(2);
  });
});

describe("setbacks", () => {
  const base = { lastGoalMet: null, today: "2026-11-10" };
  it("active on the slip day and the next, never longer", () => {
    expect(setbackState({ ...base, lastSlip: "2026-11-10", daysSinceSlip: 0 }).active).toBe(true);
    expect(setbackState({ ...base, lastSlip: "2026-11-09", daysSinceSlip: 1 }).active).toBe(true);
    expect(setbackState({ ...base, lastSlip: "2026-11-08", daysSinceSlip: 2 }).active).toBe(false);
    expect(setbackState({ ...base, lastSlip: null, daysSinceSlip: null }).active).toBe(false);
  });
  it("ends early with a goal-met day after the slip", () => {
    expect(setbackState({ ...base, lastSlip: "2026-11-09", lastGoalMet: "2026-11-10", daysSinceSlip: 1 }).active).toBe(false);
  });
  it("never changes levels or completions", () => {
    const before = missionStates("rescue", { goalMetDays: 30, completed: ["rescue_trust"] });
    expect(before.every((s) => s.completed)).toBe(true);
  });
});

describe("the pet's look", () => {
  it("a rescued pet starts low on every trait and recovers per mission", () => {
    const start = petTraits("rescue", missionStates("rescue", { goalMetDays: 0 }));
    expect(Object.values(start).every((v) => v === 0)).toBe(true);
    // Only Physical Recovery done: coat, posture and energy move; trust does not.
    const states = missionStates("rescue", { goalMetDays: 0, completed: ["rescue_physical"] });
    const t = petTraits("rescue", states);
    expect(t.coat).toBe(1);
    expect(t.energy).toBe(1);
    expect(t.trust).toBe(0);
    expect(t.posture).toBe(0.5); // shared with Building Confidence
  });
  it("a raised puppy starts healthy and grows", () => {
    expect(Object.values(petTraits("raise", missionStates("raise", { goalMetDays: 0 }))).every((v) => v === 0.7)).toBe(true);
    expect(Object.values(petTraits("raise", missionStates("raise", { goalMetDays: 30 }))).every((v) => v === 1)).toBe(true);
  });
  it("a setback makes the pet quieter, not sick", () => {
    const states = missionStates("rescue", { goalMetDays: 30 });
    const t = petTraits("rescue", states, { setback: true });
    expect(t.coat).toBe(1);
    expect(t.energy).toBeCloseTo(0.8);
    expect(t.play).toBeCloseTo(0.75);
  });
  it("visual stages", () => {
    expect(visualStage(missionStates("rescue", { goalMetDays: 0 }))).toBe("initial");
    expect(visualStage(missionStates("rescue", { goalMetDays: 3 }))).toBe("early");
    expect(visualStage(missionStates("rescue", { goalMetDays: 12 }))).toBe("mid");
    expect(visualStage(missionStates("rescue", { goalMetDays: 18 }))).toBe("late");
    expect(visualStage(missionStates("rescue", { goalMetDays: 30 }))).toBe("recovered");
  });
});
