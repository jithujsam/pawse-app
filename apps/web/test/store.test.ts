import { describe, expect, it } from "vitest";
import { actions, activeCompanion, getData, moneyKept, recentPace, slipRequest, viewCompanion } from "../src/store";
import { dayStatus } from "../src/recovery";
import { toRemote } from "../src/syncmap";
import { blank } from "../src/persist";
import { defaultTrackState } from "../src/tracks";
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
const ai = { effects: ["heavier"], explanation: "Biscuit felt that." };

describe("AI adds words, never numbers, to a slip", () => {
  it("adds the sentence and tags, and leaves the months lost exactly as the engine set them", () => {
    load([entry("e1", t0, 4)]);
    expect(actions.applyAi("e1", ai)).toBe(true);
    expect(getData().entries[0]).toMatchObject({ months: 4, aiAdjustPct: null, effects: ["heavier"], explanation: "Biscuit felt that.", source: "ai" });
  });

  it("does not move the pet's age, the healing or the death date, even under classic rules where death exists", () => {
    // Two old slips of 10 months = 20 net; today's 8-month slip leaves it alive at 28 of 30 (the health bar's budget).
    load([entry("old0", addDays(t0, -2), 10), entry("old1", addDays(t0, -1), 10), entry("e1", t0, 8)]);
    actions.setSettings({ petLife: "classic" });
    const before = viewCompanion(getData(), C);
    actions.applyAi("e1", ai);
    const after = viewCompanion(getData(), C);
    expect(after.stage).toBe(before.stage);
    expect(after.age).toBe(before.age);
    expect(after.states.map((s) => s.damageMonths)).toEqual(before.states.map((s) => s.damageMonths));
    expect(getData().companions[0].diedOn).toBeNull();
  });

  it("returns false for an entry that doesn't exist, and changes nothing", () => {
    load([entry("e1", t0, 4)]);
    expect(actions.applyAi("missing", ai)).toBe(false);
    expect(getData().entries[0]).toMatchObject({ months: 4, source: "baseline" });
  });

  it("keeps the AI adjustments already stored before this change exactly as they were", () => {
    // Saved while the old AI nudge existed: 5.2 months with aiAdjustPct 30. Reading must not recompute them.
    load([{ ...entry("old-ai", addDays(t0, -3), 5.2), aiAdjustPct: 30, source: "ai" as const, explanation: "Biscuit felt that." }]);
    const d = getData();
    expect(d.entries[0]).toMatchObject({ months: 5.2, aiAdjustPct: 30, source: "ai" });
    expect(viewCompanion(d, C).states.find((s) => s.day === addDays(t0, -3))!.damageMonths).toBeCloseTo(5.2);
  });
});

describe("missing days", () => {
  const born = addDays(t0, -27);
  function world(cleanDays: string[], slips: { day: string; amount: number }[], baseline: "daily" | null = "daily") {
    const d = blank();
    actions.applyRemote({
      ...d,
      settings: { ...d.settings, onboarded: true, neglectFrom: born },
      companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null }],
      habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [], track: { ...defaultTrackState(born), baseline } }],
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

  it("money kept after a rebirth ignores spending from the earlier life", () => {
    const d = world([addDays(born, 1)], [{ day: addDays(born, -5), amount: 900 }, { day: born, amount: 200 }]);
    expect(moneyKept(d, H, born)).toEqual({ saved: 2 * 200 - 200, days: 2 });
  });

  it("recent pace is slips per checked-in week, and unknown with nothing logged", () => {
    expect(recentPace(world([], []), H, born)).toBeNull();
    const d = world([addDays(t0, -1), addDays(t0, -2), addDays(t0, -3)], [{ day: t0, amount: 100 }]);
    expect(recentPace(d, H, born)).toBeCloseTo(7 / 4);
  });
});

describe("correcting an old day", () => {
  it("a slip logged for a past clean day wins over the clean mark, keeps it as history, and ages the pet from that day", () => {
    load([]);
    const old = addDays(t0, -10);
    actions.markClean(H, old);
    const d = actions.logSlip(H, {}, old);
    expect(d.entry.day).toBe(old);
    expect(getData().cleanDays.some((c) => c.day === old)).toBe(true);
    expect(dayStatus(getData(), H, old)).toBe("lapse");
    const v = viewCompanion(getData(), C);
    const st = v.states.find((s) => s.day === old)!;
    expect(st.damageMonths).toBeCloseTo(d.entry.months);
    expect(st.healedMonths).toBe(0);
    expect(v.age).toBeGreaterThan(0);
    // Deleting the slip brings the goal-met day back.
    actions.deleteEntry(d.entry.id);
    expect(dayStatus(getData(), H, old)).toBe("met");
  });
});

describe("slip, clean and nothing logged are three different days", () => {
  it("a slip ages, a clean day heals, a quiet day does neither", () => {
    load([entry("s", addDays(t0, -3), 4)]);
    actions.markClean(H, addDays(t0, -2));
    // addDays(t0, -1) is left quiet
    const v = viewCompanion(getData(), C);
    const at = (n: number) => v.states.find((s) => s.day === addDays(t0, -n))!;
    expect(at(3).damageMonths).toBe(4);
    expect(at(2).healedMonths).toBe(1.5);
    expect(at(1)).toMatchObject({ damageMonths: 0, healedMonths: 0, neglectMonths: 0 });
    expect(at(1).netMonths).toBe(at(2).netMonths);
  });

  it("a day with a slip can't also be clean, and a clean mark is idempotent", () => {
    load([entry("s", t0, 4)]);
    expect(actions.markClean(H, t0)).toBe(false);
    expect(actions.markClean(H, addDays(t0, -1))).toBe(true);
    expect(actions.markClean(H, addDays(t0, -1))).toBe(true);
    expect(getData().cleanDays.filter((c) => c.day === addDays(t0, -1))).toHaveLength(1);
  });
});

describe("pet rules: continuity by default, classic opt-in", () => {
  const heavy = () => Array.from({ length: 60 }, (_, i) => entry(`h${i}`, addDays(t0, -59 + i), 24));
  it("continuity is the default: the heaviest history leaves the companion frail at 99, alive, and healing", () => {
    expect(blank().settings.petLife).toBe("continuity");
    load(heavy());
    const d = actions.logSlip(H, {}, t0);
    expect(d.died).toBe(false);
    const v = viewCompanion(getData(), C);
    expect(v.stage).toBe("frail");
    expect(Math.round(v.age)).toBe(99);
    expect(getData().companions[0].diedOn).toBeNull();
  });

  it("classic rules (opt-in) keep the PRD behaviour: a companion can die", () => {
    load(heavy().slice(0, 50)); // far past the 30-month budget: the next slip records the death
    actions.setSettings({ petLife: "classic" });
    actions.logSlip(H, {}, t0);
    expect(getData().companions[0].diedOn).not.toBeNull();
  });

  it("classic can't be switched on while it would mean the companion had already died", async () => {
    const { canAllowPassingAway } = await import("../src/store");
    load(heavy());
    expect(canAllowPassingAway(getData())).toBe(false);
    load([entry("one", t0, 4)]);
    expect(canAllowPassingAway(getData())).toBe(true);
  });

  it("never rewrites history: a companion that already died stays in the Hall", () => {
    load(heavy());
    actions.applyRemote({ ...getData(), companions: [{ ...getData().companions[0], diedOn: addDays(t0, -10), finalAge: 100 }] });
    const v = viewCompanion(getData(), C);
    expect(v.dead).toBe(true);
    expect(v.age).toBe(100);
  });

  it("the setting survives storage and travels with the account", async () => {
    const { normalize } = await import("../src/persist");
    const { portableSettings } = await import("../src/syncmap");
    const s = { ...blank(), settings: { ...blank().settings, petLife: "classic" as const, onboarded: true } };
    expect(normalize(JSON.parse(JSON.stringify(s)))!.settings.petLife).toBe("classic");
    expect(portableSettings(s.settings)).toMatchObject({ petLife: "classic" });
  });
});


describe("recovery tracks", () => {
  it("adding a track gives it its own habit and companion and leaves the first track untouched", () => {
    load([entry("e1", t0, 4)]);
    const before = viewCompanion(getData(), C).age;
    const id = actions.addTrack({ what: "Doomscrolling", cls: "doomscrolling", measure: "minutes", species: "cat", name: "Miso" });
    const d = getData();
    expect(d.habits).toHaveLength(2);
    expect(d.companions).toHaveLength(2);
    const habit = d.habits.find((h) => h.id === id)!;
    const pet = d.companions.find((c) => c.id === habit.companionId)!;
    expect(pet).toMatchObject({ name: "Miso", species: "cat", bornOn: t0, diedOn: null });
    expect(habit).toMatchObject({ name: "Doomscrolling", cls: "doomscrolling", unit: "minutes" });
    expect(habit.fields.length).toBeGreaterThan(0);
    // The new pet starts with no history; the first pet keeps its own.
    expect(viewCompanion(d, pet.id).age).toBe(0);
    expect(viewCompanion(d, C).age).toBe(before);
    expect(d.entries.every((e) => e.habitId === H)).toBe(true);
  });

  it("a track added in two steps keeps the pet's coat and personality", () => {
    load([]);
    const id = actions.addTrack({ what: "Gaming", cls: "custom", measure: "none", species: "fox", name: "Ember", coat: "arctic", personality: "wise" });
    const d = getData();
    const pet = d.companions.find((c) => c.id === d.habits.find((h) => h.id === id)!.companionId)!;
    expect(pet).toMatchObject({ name: "Ember", species: "fox", coat: "arctic", personality: "wise" });
  });

  it("the open track follows the choice on this phone and falls back to the first", () => {
    load([]);
    const id = actions.addTrack({ what: "Vaping", cls: "smoking", measure: "count", species: "fox", name: "" });
    const second = getData().habits.find((h) => h.id === id)!.companionId;
    expect(activeCompanion(getData())?.id).toBe(second);
    actions.selectTrack(H);
    expect(activeCompanion(getData())?.id).toBe(C);
    actions.selectTrack("nope");
    expect(getData().settings.activeHabit).toBe(H);
    actions.setSettings({ activeHabit: "deleted-elsewhere" });
    expect(activeCompanion(getData())?.id).toBe(C);
  });

  it("a slip on one track only ages that track's pet", () => {
    load([]);
    const id = actions.addTrack({ what: "Online shopping", cls: "impulse_buying", measure: "money", species: "fox", name: "Pip" });
    const pet = getData().habits.find((h) => h.id === id)!.companionId;
    actions.logSlip(id, { amount: 500 });
    expect(viewCompanion(getData(), pet).age).toBeGreaterThan(0);
    expect(viewCompanion(getData(), C).age).toBe(0);
  });

  it("which track is open stays on this phone and is never synced", () => {
    load([]);
    actions.selectTrack(H);
    const [row] = toRemote("s", getData(), "u", 1);
    expect((row.row.settings as Record<string, unknown>).activeHabit).toBeUndefined();
  });
});

describe("what a slip sends to the AI", () => {
  it("never includes photos, reflections, or the phone's other records", () => {
    const PHOTO = "data:image/jpeg;base64,PHOTODATA";
    load([{ ...entry("e1", t0, 4), amount: 420, values: { photo: PHOTO, what: "Pizza", urge: 3 } }]);
    actions.applyRemote({ ...getData(), journal: [{ day: t0, mood: 1, body: "PRIVATE REFLECTION" }] });
    const req = slipRequest("e1")!;
    const sent = JSON.stringify(req);
    expect(sent).not.toContain("PHOTODATA");
    expect(sent).not.toContain("PRIVATE REFLECTION");
    expect(sent).not.toMatch(/@/); // no email address
    expect(Object.keys(req).sort()).toEqual(["amount", "baselineMonths", "companionName", "habitClass", "kind", "last7Slips", "median", "nthToday", "texts", "tone", "triggers", "unit"].sort());
  });
});
