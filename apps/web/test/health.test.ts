import { describe, expect, it } from "vitest";
import { conditions, healthReport, history, stats } from "../src/health";
import { silentDays, viewCompanion } from "../src/store";
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
    expect(r.body).toMatch(/today/);
    expect(r.body).not.toMatch(/\b(eat|eating|food|hungry|appetite)\b/i); // a hard day never takes food away from the pet
  });
  it("conditions are species-specific and always say how many days fix them", () => {
    for (const [sp, chest] of [["dog", /Kennel cough/], ["cat", /asthma/]] as const) {
      const d = world(sp, 3, { clean: 0 });
      const c = conditions(d, viewCompanion(d, "c1"));
      expect(c.map((x) => x.name).join("|")).toMatch(/Run down/);
      expect(c.map((x) => x.name).join("|")).toMatch(chest);
      // No condition has the pet refusing food, and none says the days must come "in a row": gaps are neutral.
      expect(c.map((x) => `${x.name} ${x.what} ${x.why} ${x.fix}`).join(" ")).not.toMatch(/\b(eat|eating|food|hungry|appetite|meals?)\b|in a row/i);
      expect(c.every((x) => x.fix.length > 5)).toBe(true);
      expect(c.find((x) => x.id === "smoking")!.days).toBeGreaterThan(0);
    }
  });
  it("going quiet is missing data: the pet isn't lonely, it costs no life and doesn't lower the heart", () => {
    const d = world("cat", 0, { born: 20, neglect: true });
    const v = viewCompanion(d, "c1");
    expect(silentDays(d, "h1")).toBeGreaterThanOrEqual(2);
    expect(conditions(d, v).some((c) => c.id === "lonely" || /lonely|hasn't heard|misses/i.test(`${c.name} ${c.what} ${c.why}`))).toBe(false);
    expect(v.states.every((s) => s.neglectMonths === 0 && s.damageMonths === 0)).toBe(true);
    expect(v.age).toBe(0);
    // A raised puppy with nothing logged sits at its starting wellness (70); quiet days never lower it.
    expect(healthReport(d, v, "honest").heart).toBe(70);
  });
  it("the heart is the one primary number: a slip day lowers it, the same records always give the same value, and no separate life-expectancy figure is reported", () => {
    const good = world("dog", 0, { clean: 9 });
    const slip = world("dog", 1, { clean: 9 });
    const heart = (d: AppData) => healthReport(d, viewCompanion(d, "c1"), "honest").heart;
    expect(heart(slip)).toBeLessThan(heart(good));
    expect(heart(good)).toBe(heart(world("dog", 0, { clean: 9 })));
    expect(Object.keys(stats(good, viewCompanion(good, "c1")))).not.toContain("lifeExpectancy");
  });
  it("quiet days don't change the pet's stage, age or conditions compared with a checked-in day", () => {
    const quiet = world("dog", 0, { born: 20, clean: 0 });
    const checked = { ...quiet, cleanDays: [{ habitId: "h1", day: today() }] };
    const q = viewCompanion(quiet, "c1");
    const c = viewCompanion(checked, "c1");
    expect(q.stage).toBe(c.stage);
    expect(q.age).toBe(c.age);
    expect(conditions(quiet, q).map((x) => x.id)).toEqual(conditions(checked, c).map((x) => x.id));
  });
  it("history lists slips with what they cost, newest first, birth last", () => {
    const d = world("dog", 1, { clean: 3 });
    const h = history(d, viewCompanion(d, "c1"));
    expect(h[0].text).toMatch(/lost .* of lifespan/);
    expect(h[0].text).toMatch(/\d(\.\d)? months?\b/);
    expect(h.some((x) => x.kind === "clean" && /^3 goal-met days/.test(x.text))).toBe(true);
    expect(h.filter((x) => x.day).pop()!.kind).toBe("born");
    expect(stats(d, viewCompanion(d, "c1")).slips).toBe(1);
  });
});
