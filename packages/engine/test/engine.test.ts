import { describe, expect, it } from "vitest";
import { baselineMonths, cleanDaysToAge, cleanDaysToUndo, computeSeverity, CONTINUITY, floorAge, NO_DEATH_CEILING_MONTHS, repeatMultiplier, simulate, stageForAge } from "../src";
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
  it("a slip's months come only from severity and repeats; the engine takes no AI input", () => {
    expect(baselineMonths(2, 1)).toBe(8);
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
    const days = [...pattern(10, () => 2, 1.5), ...pattern(400, () => 0, 1)];
    const s = simulate(days);
    const last = s[s.length - 1];
    expect(last.netMonths).toBeCloseTo(last.lifetimeDamage * 0.2, 5);
  });
  it("binge days (3+ slips) add a permanent scar of 25% of their damage", () => {
    const s = simulate([...pattern(10, () => 3, 1.5), ...pattern(400, () => 0, 1)]);
    const last = s[s.length - 1];
    expect(last.netMonths).toBeCloseTo(last.lifetimeDamage * 0.45, 5);
    expect(100 - floorAge(last)).toBeLessThan(100 - last.lifetimeDamage * 0.2 / 12);
  });
});

describe("hidden reserve", () => {
  const slipAfter = (clean: number, slips: number) => simulate([...pattern(1, () => 1, 1), ...pattern(clean, () => 0, 1), ...pattern(1, () => slips, 1)]);
  it("a brand-new companion has no reserve: the first slip ages it", () => {
    const s = simulate(pattern(1, () => 1, 1));
    expect(s[0].absorbedMonths).toBe(0);
    expect(s[0].netMonths).toBe(4);
  });
  it("after about two clean months, a one-off slip is absorbed and age does not move", () => {
    const s = slipAfter(65, 1);
    const before = s[s.length - 2], after = s[s.length - 1];
    expect(before.reserveMonths).toBeGreaterThanOrEqual(4);
    expect(after.absorbedMonths).toBe(4);
    expect(after.visibleAge).toBeCloseTo(before.visibleAge, 9);
  });
  it("the reserve caps at 12 months and soaks at most 6 a day, so a binge still lands", () => {
    const s = slipAfter(200, 3);
    expect(s[s.length - 2].reserveMonths).toBe(12);
    const last = s[s.length - 1];
    expect(last.absorbedMonths).toBe(6);
    expect(last.damageMonths).toBeCloseTo(4 + 5 + 6 - 6, 9);
  });
  it("a short clean break builds little reserve", () => {
    const s = slipAfter(7, 1);
    expect(s[s.length - 1].absorbedMonths).toBeLessThanOrEqual(1);
    expect(s[s.length - 1].damageMonths).toBeGreaterThanOrEqual(3);
  });
});

describe("recovery plan", () => {
  it("one base slip takes 3 clean days to undo", () => {
    expect(cleanDaysToUndo(4)).toBe(3);
    expect(cleanDaysToUndo(0)).toBe(0);
  });
  it("counts clean days to reach a target age, or null when the scar floor is above it", () => {
    const s = simulate(pattern(30, () => 1, 1.0));
    const last = s[s.length - 1]; // 120 months net, floor 24
    expect(cleanDaysToAge(last, 5)).toBe(40); // 120 -> 60 months at 1.5/day
    expect(cleanDaysToAge(last, last.visibleAge)).toBe(0);
    expect(cleanDaysToAge(last, 1)).toBeNull();
  });
});

describe("missed check-ins", () => {
  const silent = (n: number, from = 0) => pattern(n, () => 0, 1).map((d, i) => ({ ...d, day: `2027-01-${String(from + i + 1).padStart(2, "0")}`, clean: false, missed: true }));
  it("two silent days are free; each one after that costs 1.5 months", () => {
    const s = simulate(silent(5));
    expect(s.map((x) => x.neglectMonths)).toEqual([0, 0, 1.5, 1.5, 1.5]);
    expect(s[4].netMonths).toBeCloseTo(4.5, 9);
  });
  it("any check-in resets the count, and unflagged days (today, history before the rule) cost nothing", () => {
    const days = [...silent(3), { day: "2027-01-04", damage: [], clean: true }, ...silent(2, 4)];
    expect(simulate(days).reduce((a, x) => a + x.neglectMonths, 0)).toBe(1.5);
    expect(simulate(pattern(10, () => 0, 1).map((d) => ({ ...d, clean: false }))).every((x) => x.neglectMonths === 0)).toBe(true);
  });
  it("the reserve absorbs loneliness first, like any other damage", () => {
    const s = simulate([...pattern(1, () => 1, 1), ...pattern(80, () => 0, 1), ...silent(4)]);
    expect(s[s.length - 1].absorbedMonths).toBe(1.5);
    expect(s[s.length - 1].damageMonths).toBe(0);
  });
});

// Continuity rules (PAWSE 3.0): an option on the fold. The PRD 5.3 pacing table above is pinned with
// the default options; these tests pin what continuity changes and that it leaves ordinary pacing alone.
describe("continuity rules", () => {
  it("default options reproduce the PRD fold exactly", () => {
    const days = pattern(120, (i) => (i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 0), 1.5);
    expect(simulate(days, {})).toEqual(simulate(days));
  });
  it("pacing below the ceiling is unchanged: light and medium patterns age the same until scars matter", () => {
    const medium = pattern(200, () => 1, 1.0);
    const a = simulate(medium), b = simulate(medium, CONTINUITY);
    expect(firstDay(b, 70)).toBe(firstDay(a, 70));
    expect(b[199].visibleAge).toBeCloseTo(a[199].visibleAge, 9);
  });
  it("the heavy pattern reaches frail on the same day but never dies", () => {
    const heavy = pattern(120, () => 3, 1.5);
    const a = simulate(heavy), b = simulate(heavy, CONTINUITY);
    expect(firstDay(b, 80)).toBe(firstDay(a, 80));
    expect(b.some((s) => s.stage === "dead")).toBe(false);
    expect(Math.max(...b.map((s) => s.visibleAge))).toBeCloseTo(99, 9);
  });
  it("recovery starts on the first clean day even after a long heavy stretch", () => {
    const s = simulate([...pattern(120, () => 3, 1.5), ...pattern(1, () => 0, 1)], CONTINUITY);
    expect(s[120].healedMonths).toBe(1.5);
    expect(s[120].visibleAge).toBeLessThan(s[119].visibleAge);
  });
  it("without scars, enough clean days bring the companion all the way back", () => {
    const s = simulate([...pattern(10, () => 3, 1.5), ...pattern(400, () => 0, 1)], CONTINUITY);
    const last = s[s.length - 1];
    expect(last.netMonths).toBe(0);
    expect(floorAge(last)).toBe(0);
    expect(cleanDaysToAge(s[9], 0)).not.toBeNull();
  });
});

describe("optional no-death ceiling", () => {
  it("leaves the standard rules (and the PRD 5.3 pacing) untouched when not asked for", () => {
    const days = pattern(120, () => 3, 1.5);
    expect(simulate(days, {})).toEqual(simulate(days));
    expect(firstDay(simulate(days), 100)).toBeGreaterThanOrEqual(50);
  });
  it("with the ceiling, the heaviest pattern stays frail at age 99 and never dies", () => {
    const s = simulate(pattern(400, () => 5, 3), { ceilingMonths: NO_DEATH_CEILING_MONTHS });
    expect(s.some((x) => x.stage === "dead")).toBe(false);
    expect(Math.max(...s.map((x) => x.visibleAge))).toBeCloseTo(99, 9);
    expect(s[s.length - 1].stage).toBe("frail");
  });
  it("a clean day heals straight away from the ceiling", () => {
    const s = simulate([...pattern(200, () => 5, 3), ...pattern(10, () => 0, 1)], { ceilingMonths: NO_DEATH_CEILING_MONTHS });
    expect(s[200].healedMonths).toBe(1.5);
    expect(s[209].visibleAge).toBeLessThan(99);
  });
});
