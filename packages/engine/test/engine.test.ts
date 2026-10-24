import { describe, expect, it } from "vitest";
import { applyAiAdjustment, baselineMonths, computeSeverity, repeatMultiplier, simulate, stageForAge } from "../src";
import { pattern } from "../src/simulate";

const firstDay = (states: ReturnType<typeof simulate>, age: number) => states.findIndex((s) => s.visibleAge >= age) + 1;

describe("deduction", () => {
  it("repeat multiplier ramps then caps at 2.0", () => {
    expect([1, 2, 3, 4, 5, 9].map(repeatMultiplier)).toEqual([1, 1.25, 1.5, 1.75, 2, 2]);
  });
  it("baseline = 4 x severity x repeat", () => {
    expect(baselineMonths(1, 1)).toBe(4);
    expect(baselineMonths(1.5, 3)).toBe(9);
  });
  it("severity is clamped and trigger bonus capped at +0.5", () => {
    expect(computeSeverity({ classWeight: 0.7, triggers: 0 })).toBeCloseTo(0.7);
    expect(computeSeverity({ classWeight: 0.7, triggers: 4 })).toBeCloseTo(1.2);
    expect(computeSeverity({ classWeight: 1.4, amount: 1000, median: 100, triggers: 2 })).toBe(3);
    expect(computeSeverity({ classWeight: 0.5, amount: 1, median: 100, triggers: 0 })).toBe(0.5);
  });
  it("AI adjustment is clamped to +/-30% and 0.5..12 months", () => {
    expect(applyAiAdjustment(10, 90)).toBeCloseTo(12);
    expect(applyAiAdjustment(4, 90)).toBeCloseTo(5.2);
    expect(applyAiAdjustment(4, -90)).toBeCloseTo(2.8);
    expect(applyAiAdjustment(0.6, -30)).toBe(0.6 * 0.7 < 0.5 ? 0.5 : 0.6 * 0.7);
  });
});

describe("stages", () => {
  it("maps the ladder", () => {
    expect([0, 9.9, 10, 29, 30, 49, 50, 69, 70, 79, 80, 99, 100].map(stageForAge)).toEqual(
      ["baby", "baby", "young", "young", "adult", "adult", "middle", "middle", "old", "old", "frail", "frail", "dead"]);
  });
});

// PRD 5.3 pacing table
describe("pacing", () => {
  it("1 slip/day, severity 1.0: old in ~7 months, dead in ~10", () => {
    const s = simulate(pattern(400, () => 1, 1.0));
    expect(firstDay(s, 70)).toBeGreaterThanOrEqual(190);
    expect(firstDay(s, 70)).toBeLessThanOrEqual(230);
    expect(firstDay(s, 100)).toBeGreaterThanOrEqual(285);
    expect(firstDay(s, 100)).toBeLessThanOrEqual(315);
  });
  it("3 slips/day, severity 1.5: old in 5-6 weeks, dead in ~8", () => {
    const s = simulate(pattern(120, () => 3, 1.5));
    expect(firstDay(s, 70)).toBeGreaterThanOrEqual(35);
    expect(firstDay(s, 70)).toBeLessThanOrEqual(42);
    expect(firstDay(s, 80)).toBeLessThanOrEqual(46);
    expect(firstDay(s, 100)).toBeGreaterThanOrEqual(50);
    expect(firstDay(s, 100)).toBeLessThanOrEqual(60);
  });
  it("2 slips/week otherwise clean: stays baby to young; scar floor holds a floor", () => {
    const s = simulate(pattern(365, (i) => (i % 7 === 2 || i % 7 === 5 ? 1 : 0), 1.0));
    expect(s[181].visibleAge).toBeLessThan(10);
    expect(s[364].visibleAge).toBeLessThan(30);
    expect(s[364].visibleAge).toBeGreaterThan(s[181].visibleAge * 0.9);
  });
  it("heavy user reaches frail in 6-8 weeks (phase 0 acceptance); light user stays under 50", () => {
    const heavy = simulate(pattern(90, () => 3, 1.5));
    const frailDay = firstDay(heavy, 80);
    expect(frailDay).toBeGreaterThanOrEqual(35);
    expect(frailDay).toBeLessThanOrEqual(56);
    const light = simulate(pattern(90, (i) => (i % 7 === 2 || i % 7 === 5 ? 1 : 0), 1.0));
    expect(Math.max(...light.map((x) => x.visibleAge))).toBeLessThan(50);
  });
  it("healing never cuts below the scar floor", () => {
    const days = [...pattern(10, () => 3, 1.5), ...pattern(400, () => 0, 1).map((d) => ({ ...d }))];
    const s = simulate(days);
    const last = s[s.length - 1];
    expect(last.netMonths).toBeCloseTo(last.lifetimeDamage * 0.2, 5);
  });
});
