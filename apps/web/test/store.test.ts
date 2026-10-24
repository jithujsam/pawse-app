import { describe, expect, it } from "vitest";
import { actions, getData, viewCompanion } from "../src/store";
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

  it("never lets the AI's nudge be what kills the companion", () => {
    // 50 old slips of 23.8 months = 1190 net; today's 8-month slip leaves it alive at 1198 of 1200.
    load([...Array.from({ length: 50 }, (_, i) => entry(`old${i}`, addDays(t0, -50 + i), 23.8)), entry("e1", t0, 8)]);
    expect(viewCompanion(getData(), C).stage).not.toBe("dead");
    expect(actions.applyAi("e1", ai(10.4, 30))).toBe(8);
    expect(getData().companions[0].diedOn).toBeNull();
    expect(getData().entries.find((e) => e.id === "e1")).toMatchObject({ months: 8, aiAdjustPct: null, explanation: "Biscuit felt that." });
  });
});
