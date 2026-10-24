import { describe, expect, it } from "vitest";
import { actions, getData, moneyKept, recentPace, viewCompanion } from "../src/store";
import { blank } from "../src/persist";
import { addDays, today } from "../src/dates";
import type { Entry } from "../src/types";

const t0 = today();
const C = "c1", H = "h1";
const entry = (id: string, day: string, months: number): Entry => ({
  id, habitId: H, companionId: C, day, time: null, values: {}, amount: null, months, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 0,
});
function load(entries: Entry[]) {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: addDays(t0, -60), diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
    entries,
  });
}
const ai = (months: number, adjustPct: number) => ({ months, adjustPct, effects: [], explanation: "Biscuit felt that." });

describe("AI polish on a slip", () => {
  it("applies the AI's nudge in the ordinary case", () => {
    load([entry("e1", t0, 4)]);
    expect(actions.applyAi("e1", ai(5.2, 30))).toBe(5.2);
    expect(getData().entries[0]).toMatchObject({ months: 5.2, aiAdjustPct: 30, source: "ai" });
  });

  it("never lets the AI's nudge be what kills the companion (classic rules, where death exists)", () => {
    // 50 old slips of 23.8 months = 1190 net; today's 8-month slip leaves it alive at 1198 of 1200.
    load([...Array.from({ length: 50 }, (_, i) => entry(`old${i}`, addDays(t0, -50 + i), 23.8)), entry("e1", t0, 8)]);
    actions.setSettings({ petLife: "classic" });
    expect(viewCompanion(getData(), C).stage).not.toBe("dead");
    expect(actions.applyAi("e1", ai(10.4, 30))).toBe(8);
    expect(getData().companions[0].diedOn).toBeNull();
    expect(getData().entries.find((e) => e.id === "e1")).toMatchObject({ months: 8, aiAdjustPct: null, explanation: "Biscuit felt that." });
  });
});

describe("missing days", () => {
  const born = addDays(t0, -27);
  function world(cleanDays: string[], slips: { day: string; amount: number }[], baseline: "daily" | null = "daily") {
    const d = blank();
    actions.applyRemote({
      ...d,
      settings: { ...d.settings, onboarded: true, baseline, neglectFrom: born },
      companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null }],
      habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
      entries: slips.map((s, i) => ({ ...entry(`e${i}`, s.day, 2.8), amount: s.amount })),
      cleanDays: cleanDays.map((day) => ({ habitId: H, day })),
    });
    return getData();
  }

  it("a quiet stretch costs no life, even with the loneliness rule's start date set", () => {
    const d = world([], []);
    const v = viewCompanion(d, C);
    expect(v.states).toHaveLength(28);
    expect(v.age).toBe(0);
    expect(v.states.every((s) => s.neglectMonths === 0)).toBe(true);
  });

  it("money kept counts only days that were checked in, never quiet ones", () => {
    // 28 days, but only 1 slip day and 6 clean days logged; old pace was daily at ~200 a time.
    const d = world([1, 2, 3, 4, 5, 6].map((i) => addDays(born, i)), [{ day: born, amount: 200 }]);
    expect(moneyKept(d, H, born)).toEqual({ saved: 7 * 200 - 200, days: 7 });
    expect(moneyKept(world([], [{ day: born, amount: 200 }], null), H, born)).toBeNull();
  });

  it("recent pace is slips per checked-in week, and unknown with nothing logged", () => {
    expect(recentPace(world([], []), H, born)).toBeNull();
    const d = world([addDays(t0, -1), addDays(t0, -2), addDays(t0, -3)], [{ day: t0, amount: 100 }]);
    expect(recentPace(d, H, born)).toBeCloseTo(7 / 4);
  });
});

describe("correcting an old day", () => {
  it("a slip logged for a past clean day replaces the clean mark and ages the pet from that day", () => {
    load([]);
    const old = addDays(t0, -10);
    actions.markClean(H, old);
    const d = actions.logSlip(H, {}, old);
    expect(d.entry.day).toBe(old);
    expect(getData().cleanDays.some((c) => c.day === old)).toBe(false);
    const v = viewCompanion(getData(), C);
    expect(v.states.find((s) => s.day === old)!.damageMonths).toBeCloseTo(d.entry.months);
    expect(v.age).toBeGreaterThan(0);
  });
});
