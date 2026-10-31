import { describe, expect, it } from "vitest";
import { journey, missionHealthCap, MISSIONS, missionsFor, petTraits, recoveryDays, RELAPSE_SLIPS, setbackState, slipsInWindowOn, stepDays, type DayRecord } from "../src";

const D0 = Date.UTC(2026, 0, 1);
const day = (i: number) => new Date(D0 + i * 86_400_000).toISOString().slice(0, 10);
/** A pattern string: m = goal met, s = slip, . = nothing recorded. */
const days = (p: string): DayRecord[] => [...p].map((c, i) => ({ day: day(i), met: c === "m", slip: c === "s" }));
const m = (n: number) => "m".repeat(n);

describe("the schedule", () => {
  it("recovery is half the target and never under 21 days", () => {
    expect([30, 60, 120].map(recoveryDays)).toEqual([21, 30, 60]);
  });
  it("the six conditions take 1, 2, 3, 4, 5, 6 days in a row on a 30-day journey, and scale up for longer ones", () => {
    expect(stepDays(30)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const t of [30, 60, 120]) {
      const s = stepDays(t);
      expect(s.reduce((a, b) => a + b, 0)).toBe(recoveryDays(t));
      expect(s.every((x, i) => x >= 1 && (i === 0 || x >= s[i - 1]))).toBe(true);
    }
    expect(stepDays(60)).toEqual([1, 3, 5, 5, 7, 9]);
    expect(stepDays(120)).toEqual([3, 6, 8, 12, 14, 17]);
  });
  it("each mode has six conditions or skills, in treatment order", () => {
    expect(missionsFor("rescue").map((x) => x.id)).toEqual(["rescue_coat", "rescue_energy", "rescue_noise", "rescue_play", "rescue_alone", "rescue_trust"]);
    expect(missionsFor("raise")).toHaveLength(6);
    expect(new Set(MISSIONS.map((x) => x.id)).size).toBe(12);
  });
});

describe("recovering", () => {
  it("a new rescue starts at 0% with the first condition in treatment", () => {
    const j = journey("rescue", 30, []);
    expect(j).toMatchObject({ healed: 0, progress: 0, pct: 0, recovered: false });
    expect(j.missions.map((x) => x.status)).toEqual(["current", "waiting", "waiting", "waiting", "waiting", "waiting"]);
  });
  it("heals one condition at each step: 1, 3, 6, 10, 15 and 21 days with no slip", () => {
    const healedAt = [1, 3, 6, 10, 15, 21].map((n) => journey("rescue", 30, days(m(n))).healed);
    expect(healedAt).toEqual([1, 2, 3, 4, 5, 6]);
    expect(journey("rescue", 30, days(m(20))).healed).toBe(5);
  });
  it("shows recovery as a percentage, 100 at 21 days", () => {
    expect(journey("rescue", 30, days(m(2))).pct).toBe(9);
    expect(journey("rescue", 30, days(m(10))).pct).toBe(47);
    expect(journey("rescue", 30, days(m(21)))).toMatchObject({ pct: 100, recovered: true, recoveredOn: day(20) });
  });
  it("days with nothing recorded don't count and don't break the run", () => {
    expect(journey("rescue", 30, days("m.m..m")).healed).toBe(2);
  });
  it("a 60-day journey needs 30 days, a 120-day journey 60", () => {
    expect(journey("rescue", 60, days(m(29))).recovered).toBe(false);
    expect(journey("rescue", 60, days(m(30))).recovered).toBe(true);
    expect(journey("rescue", 120, days(m(60))).recovered).toBe(true);
  });
  it("is the same every time for the same records", () => {
    expect(journey("rescue", 30, days("mmsmm.m"))).toEqual(journey("rescue", 30, days("mmsmm.m")));
  });
});

describe("a slip during recovery", () => {
  it("resets the condition in treatment and brings back the last one healed", () => {
    const before = journey("rescue", 30, days(m(8))); // 3 healed, 2 days on the 4th
    expect(before).toMatchObject({ healed: 3, progress: 2 });
    const after = journey("rescue", 30, days(m(8) + "s"));
    expect(after).toMatchObject({ healed: 2, progress: 0 });
    expect(after.events.at(-1)).toMatchObject({ kind: "relapse", mission: "rescue_noise", lost: 2 });
    expect(after.pct).toBeLessThan(before.pct);
  });
  it("the returned condition must be healed again from scratch", () => {
    expect(journey("rescue", 30, days(m(8) + "s" + m(2))).healed).toBe(2);
    expect(journey("rescue", 30, days(m(8) + "s" + m(3))).healed).toBe(3);
  });
  it("one slip a week keeps a rescue from ever fully recovering", () => {
    expect(journey("rescue", 30, days(("mmmmmms").repeat(10))).recovered).toBe(false);
  });
  it("a raised puppy only loses the skill in progress, never one learned", () => {
    const j = journey("raise", 30, days(m(8) + "s"));
    expect(j).toMatchObject({ healed: 3, progress: 0 });
    expect(j.events.at(-1)).toMatchObject({ kind: "reset", lost: 2 });
  });
  it("a slip on the same day as a goal-met mark counts as a slip", () => {
    expect(journey("rescue", 30, [{ day: day(0), met: true, slip: true }]).healed).toBe(0);
  });
});

describe("after recovery", () => {
  it("each slip counts toward a relapse; 5 within 30 days bring the deepest condition back", () => {
    const base = m(21);
    expect(journey("rescue", 30, days(base + "s")).slipsInWindow).toBe(1);
    expect(journey("rescue", 30, days(base + "s".repeat(RELAPSE_SLIPS - 1))).recovered).toBe(true);
    const j = journey("rescue", 30, days(base + "s".repeat(RELAPSE_SLIPS)));
    expect(j).toMatchObject({ recovered: false, healed: 5, progress: 0 });
    expect(j.events.at(-1)).toMatchObject({ kind: "relapse", mission: "rescue_trust" });
    expect(journey("rescue", 30, days(base + "s".repeat(5) + m(6))).recovered).toBe(true);
  });
  it("slips more than 30 days apart don't add up", () => {
    const spaced = m(21) + ("s" + m(30)).repeat(6);
    expect(journey("rescue", 30, days(spaced)).recovered).toBe(true);
    const j = journey("rescue", 30, days(m(21) + "s" + m(3)));
    expect(slipsInWindowOn(j, day(24), [day(21)])).toBe(1);
    expect(slipsInWindowOn(j, day(52), [day(21)])).toBe(0);
  });
  it("the journey is complete at the target with the pet recovered", () => {
    expect(journey("rescue", 30, days(m(29))).complete).toBe(false);
    const j = journey("rescue", 30, days(m(30)));
    expect(j.complete).toBe(true);
    expect(j.events.map((e) => e.kind)).toContain("complete");
  });
});

describe("the health bar", () => {
  it("a rescue starts at 10% and turns green with recovery, 100% once recovered", () => {
    expect([0, 3, 10, 20, 21].map((n) => missionHealthCap(journey("rescue", 30, days(m(n)))))).toEqual([10, 25, 50, 95, 100]);
  });
  it("a raised puppy's bar is never limited", () => {
    expect(missionHealthCap(journey("raise", 30, []))).toBe(100);
  });
});

describe("setbacks", () => {
  const base = { lastGoalMet: null, today: "2026-11-10" };
  it("active on the slip day and the next; ends early with a goal-met day", () => {
    expect(setbackState({ ...base, lastSlip: "2026-11-10", daysSinceSlip: 0 }).active).toBe(true);
    expect(setbackState({ ...base, lastSlip: "2026-11-09", daysSinceSlip: 1 }).active).toBe(true);
    expect(setbackState({ ...base, lastSlip: "2026-11-08", daysSinceSlip: 2 }).active).toBe(false);
    expect(setbackState({ ...base, lastSlip: "2026-11-09", lastGoalMet: "2026-11-10", daysSinceSlip: 1 }).active).toBe(false);
  });
});

describe("the pet's look", () => {
  it("each condition drives its own traits: healing the coat changes only the coat", () => {
    const t0 = petTraits(journey("rescue", 30, []));
    expect(Object.values(t0).every((v) => v === 0)).toBe(true);
    const t1 = petTraits(journey("rescue", 30, days(m(1))));
    expect(t1.coat).toBe(1);
    expect(t1.trust).toBe(0);
    expect(t1.energy).toBe(0);
  });
  it("a recovered rescue looks fully well; a raised puppy starts healthy", () => {
    expect(Object.values(petTraits(journey("rescue", 30, days(m(21))))).every((v) => v === 1)).toBe(true);
    expect(Object.values(petTraits(journey("raise", 30, []))).every((v) => v === 0.7)).toBe(true);
  });
  it("a setback makes the pet quieter, not sick", () => {
    const t = petTraits(journey("rescue", 30, days(m(21))), { setback: true });
    expect(t.coat).toBe(1);
    expect(t.energy).toBeCloseTo(0.8);
  });
});
