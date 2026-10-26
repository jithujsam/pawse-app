import { describe, expect, it } from "vitest";
import { conditions, healthReport, history, stats } from "../src/health";
import { viewCompanion } from "../src/store";
import { blank } from "../src/persist";
import { addDays, today } from "../src/dates";
import type { AppData, Species } from "../src/types";

const t0 = today();
function world(species: Species, slipsToday: number, opts: { born?: number; clean?: number; neglect?: boolean } = {}): AppData {
  const d = blank();
  const born = addDays(t0, -(opts.born ?? 10));
  return {
    ...d,
    settings: { ...d.settings, onboarded: true, neglectFrom: opts.neglect ? born : null },
    companions: [{ id: "c1", species, name: "Miso", bornOn: born, diedOn: null, finalAge: null }],
    habits: [{ id: "h1", name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: "c1", unit: "count", fields: [] }],
    entries: Array.from({ length: slipsToday }, (_, i) => ({ id: `e${i}`, habitId: "h1", companionId: "c1", day: t0, time: null, values: {}, amount: null, months: 4, severity: 1, effects: [], explanation: "", source: "baseline" as const, aiAdjustPct: null, createdAt: i })),
    cleanDays: Array.from({ length: opts.clean ?? 0 }, (_, i) => ({ habitId: "h1", day: addDays(t0, -1 - i) })),
  };
}

describe("health", () => {
  it("a clean, young pet is thriving; a slip day caps the heart and says so", () => {
    const good = world("dog", 0, { clean: 9 });
    expect(healthReport(good, viewCompanion(good, "c1"), "honest").level).toBe("thriving");
    const slip = world("dog", 1, { clean: 9 });
    const r = healthReport(slip, viewCompanion(slip, "c1"), "honest");
    expect(r.heart).toBeLessThanOrEqual(80);
    expect(r.body).toMatch(/eat/);
  });
  it("conditions are species-specific and always say how many days fix them", () => {
    for (const [sp, appetite, chest] of [["rabbit", /GI stasis/, /Snuffles/], ["dog", /Off their food/, /Kennel cough/], ["cat", /Skipping meals/, /asthma/]] as const) {
      const d = world(sp, 3, { clean: 0 });
      const c = conditions(d, viewCompanion(d, "c1"));
      expect(c.map((x) => x.name).join("|")).toMatch(appetite);
      expect(c.map((x) => x.name).join("|")).toMatch(chest);
      expect(c.every((x) => x.fix.length > 5)).toBe(true);
      expect(c.find((x) => x.id === "smoking")!.days).toBeGreaterThan(0);
    }
  });
  it("going quiet is missing data: noticed, but it costs no life and doesn't lower the heart", () => {
    const d = world("cat", 0, { born: 20, neglect: true });
    const v = viewCompanion(d, "c1");
    const lonely = conditions(d, v).find((c) => c.id === "lonely");
    expect(lonely?.tone).toBe("mild");
    expect(lonely?.fix).not.toMatch(/age|life|cost/i);
    expect(v.states.every((s) => s.neglectMonths === 0 && s.damageMonths === 0)).toBe(true);
    expect(v.age).toBe(0);
    expect(healthReport(d, v, "honest").heart).toBe(100);
  });
  it("history lists slips with what they cost, newest first, birth last", () => {
    const d = world("dog", 1, { clean: 3 });
    const h = history(d, viewCompanion(d, "c1"));
    expect(h[0].text).toMatch(/lost .* months of lifespan/);
    expect(h.some((x) => x.kind === "clean" && /3 goal-met days/.test(x.text))).toBe(true);
    expect(h.filter((x) => x.day).pop()!.kind).toBe("born");
    expect(stats(d, viewCompanion(d, "c1")).slips).toBe(1);
  });
});
