import { describe, expect, it } from "vitest";
import { actions, getData, viewCompanion } from "../src/store";
import { blank } from "../src/persist";
import { addDays, today, weekStart } from "../src/dates";
import { careDays, dayStatus, milestoneToCelebrate, observations, strategyOrder, strategyResults, weekReview, MIN_EVENTS } from "../src/recovery";
import { buildFields } from "../src/questions";
import type { AppData, Entry, Urge } from "../src/types";

const t0 = today();
const C = "c1", H = "h1";
const fields = buildFields({ what: "Orders", measure: "money", cls: "food_spending", triggers: ["stress", "bored"] });
const entry = (id: string, day: string, values: Entry["values"] = {}, months = 4): Entry => ({
  id, habitId: H, companionId: C, day, time: null, values, amount: null, months, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 0,
});
const urge = (id: string, day: string, outcome: Urge["outcome"], extra: Partial<Urge> = {}): Urge => ({ id, habitId: H, day, time: "20:00", strength: 3, outcome, createdAt: 0, ...extra });

function load(p: Partial<AppData> = {}, settings: Partial<AppData["settings"]> = {}) {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true, ...settings },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: addDays(t0, -90), diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields }],
    ...p,
  });
}

describe("day status: five distinct states, never inferred from silence", () => {
  it("tells a slip, goal met, urge managed, rest day and an unrecorded day apart", () => {
    const [a, b, c, d, e] = [1, 2, 3, 4, 5].map((n) => addDays(t0, -n));
    load({ entries: [entry("e1", a)], cleanDays: [{ habitId: H, day: b }], urges: [urge("u1", c, "rode_it_out"), urge("u2", e, "slipped")] }, { restDays: [d] });
    const s = (day: string) => dayStatus(getData(), H, day);
    expect([s(a), s(b), s(c), s(d), s(e), s(addDays(t0, 1))]).toEqual(["lapse", "met", "urge", "rest", "unrecorded", "future"]);
  });
  it("a slip wins over a managed urge the same day, and an urge acted on is not 'managed'", () => {
    load({ entries: [entry("e1", t0)], urges: [urge("u1", t0, "rode_it_out")] });
    expect(dayStatus(getData(), H, t0)).toBe("lapse");
  });
  it("an unrecorded day changes nothing about the companion", () => {
    load({ entries: [entry("e1", addDays(t0, -30))] });
    const before = viewCompanion(getData(), C).age;
    expect(viewCompanion(getData(), C).states.slice(-29).every((s) => s.damageMonths === 0 && s.healedMonths === 0)).toBe(true);
    expect(before).toBeGreaterThan(0);
  });
});

describe("rest days (intentionally untracked)", () => {
  it("can be set and cleared, but never over a recorded slip or goal-met day", () => {
    const y = addDays(t0, -1);
    load({ entries: [entry("e1", y)], cleanDays: [{ habitId: H, day: addDays(t0, -2) }] });
    expect(actions.setRest(H, y, true)).toBe(false);
    expect(actions.setRest(H, addDays(t0, -2), true)).toBe(false);
    expect(actions.setRest(H, t0, true)).toBe(true);
    expect(dayStatus(getData(), H, t0)).toBe("rest");
    actions.setRest(H, t0, false);
    expect(dayStatus(getData(), H, t0)).toBe("unrecorded");
  });
  it("logging a slip or marking goal met replaces the rest day: what was recorded wins", () => {
    load({}, { restDays: [t0, addDays(t0, -1)] });
    actions.markClean(H, t0);
    expect(getData().settings.restDays).toEqual([addDays(t0, -1)]);
    actions.logSlip(H, {}, addDays(t0, -1));
    expect(getData().settings.restDays).toEqual([]);
  });
});

describe("continuity rules (default)", () => {
  const heavy = () => Array.from({ length: 80 }, (_, i) => [0, 1, 2].map((k) => entry(`e${i}-${k}`, addDays(t0, -85 + i), {}, 9))).flat();
  it("a long heavy stretch leaves the companion frail but alive, and nothing is recorded as a death", () => {
    load({ entries: heavy() });
    const v = viewCompanion(getData(), C);
    expect(v.stage).toBe("frail");
    expect(v.dead).toBe(false);
    actions.logSlip(H, {});
    expect(getData().companions[0].diedOn).toBeNull();
  });
  it("classic rules keep the PRD behaviour: the same history ends in death", () => {
    load({ entries: heavy() }, { petLife: "classic" });
    expect(viewCompanion(getData(), C).states.some((s) => s.stage === "dead")).toBe(true);
  });
  it("a binge day is not a permanent scar under continuity", () => {
    load({ entries: [entry("a", addDays(t0, -60)), entry("b", addDays(t0, -60)), entry("c", addDays(t0, -60))],
      cleanDays: Array.from({ length: 59 }, (_, i) => ({ habitId: H, day: addDays(t0, -59 + i) })) });
    expect(viewCompanion(getData(), C).age).toBe(0);
  });
});

describe("plan, lapse reflection and weekly focus", () => {
  it("saves a trimmed, capped plan and adds if-then plans without duplicates", () => {
    load();
    actions.savePlan({ goal: "reduce", reasons: [" Money ", "", "Money", "Sleep"], situations: ["Late at night"], firstStep: "  Log out of the app  ", strategies: ["breathe", "breathe", "move"], supportName: " Asha ", ifThen: [] });
    actions.addIfThen("If I'm home alone after 10, then I'll make tea");
    actions.addIfThen("if i'm home alone after 10, then i'll make tea");
    expect(getData().settings.plan).toEqual({ goal: "reduce", reasons: ["Money", "Sleep"], situations: ["Late at night"], firstStep: "Log out of the app", strategies: ["breathe", "move"], supportName: "Asha", ifThen: ["If I'm home alone after 10, then I'll make tea"] });
  });
  it("a lapse reflection is stored on the slip and never changes the companion's age", () => {
    load({ entries: [entry("e1", t0)] });
    const age = viewCompanion(getData(), C).age;
    actions.reflectOnLapse("e1", { before: "Long day, ordered on autopilot", adjust: "Eat before 9" });
    expect(getData().entries[0].values).toMatchObject({ lapse_before: "Long day, ordered on autopilot", lapse_adjust: "Eat before 9" });
    expect(viewCompanion(getData(), C).age).toBe(age);
  });
  it("records the strategy and trigger with an urge", () => {
    load();
    actions.recordUrge(H, 4, "rode_it_out", { strategy: "move", trigger: "  Stressed  " });
    expect(getData().urges[0]).toMatchObject({ strategy: "move", trigger: "Stressed", outcome: "rode_it_out" });
  });
  it("puts preferred strategies first and keeps every strategy available", () => {
    const order = strategyOrder(["reach", "breathe"]).map((s) => s.id);
    expect(order.slice(0, 2)).toEqual(["reach", "breathe"]);
    expect(new Set(order).size).toBe(7);
  });
});

describe("observations only from real records, with uncertainty", () => {
  it("shows an insufficient-data state below the minimum instead of a guess", () => {
    load({ entries: [entry("e1", t0, { mood: "stress" }), entry("e2", addDays(t0, -1), { mood: "stress" })] });
    const o = observations(getData(), getData().habits[0]);
    expect(o.items).toEqual([]);
    expect(o.needed).toBe(MIN_EVENTS - 2);
  });
  it("calls something a pattern only when it is in at least half of 6+ records, and a hint from 3", () => {
    const es = Array.from({ length: 6 }, (_, i) => entry(`e${i}`, addDays(t0, -i), { mood: i < 4 ? "stress" : "bored" }));
    load({ entries: es });
    const feeling = observations(getData(), getData().habits[0]).items.find((x) => x.id === "feeling")!;
    expect(feeling).toMatchObject({ title: "Stressed", count: 4, of: 6, strength: "pattern" });
    load({ entries: es.map((e, i) => ({ ...e, values: { mood: i < 3 ? "stress" : "" } })), urges: [urge("u1", t0, "slipped"), urge("u2", t0, "slipped"), urge("u3", t0, "slipped")] });
    const f2 = observations(getData(), getData().habits[0]).items.find((x) => x.id === "feeling");
    expect(f2).toMatchObject({ count: 3, of: 3 });
  });
  it("counts strategy results from the person's own outcomes", () => {
    load({ urges: [urge("u1", t0, "rode_it_out", { strategy: "move" }), urge("u2", t0, "slipped", { strategy: "move" }), urge("u3", t0, "rode_it_out", { strategy: "breathe" })] });
    expect(strategyResults(getData(), H)).toEqual([{ id: "move", managed: 1, total: 2 }, { id: "breathe", managed: 1, total: 1 }]);
  });
});

describe("weekly review", () => {
  const ws = weekStart(t0);
  it("counts recorded days, keeps unrecorded and rest days separate, and never calls silence progress", () => {
    load({}, { plan: { goal: "stop", reasons: [], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] } });
    const r = weekReview(getData(), getData().habits[0], addDays(t0, -90), ws);
    expect(r.counts.met + r.counts.urge + r.counts.lapse).toBe(0);
    expect(r.goalLine).toMatch(/Nothing recorded yet this week/);
  });
  it("summarises a recorded week against the person's goal", () => {
    const last = addDays(ws, -7);
    load({
      entries: [entry("e1", last), entry("e2", addDays(last, 1)), entry("e3", addDays(last, 2), { mood: "stress" })],
      cleanDays: [{ habitId: H, day: addDays(last, 3) }, { habitId: H, day: addDays(last, 4) }],
      urges: [urge("u1", addDays(last, 5), "rode_it_out", { strategy: "breathe", trigger: "Stressed" })],
    }, { restDays: [addDays(last, 6)], weekFocus: [{ week: ws, text: "Plan dinner" }], plan: { goal: "stop", reasons: [], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] } });
    const r = weekReview(getData(), getData().habits[0], addDays(t0, -90), last);
    expect(r.counts).toEqual({ lapse: 3, met: 2, urge: 1, rest: 1, unrecorded: 0 });
    expect(r.goalLine).toBe("3 of 6 recorded days without a slip.");
    expect(r.urges).toEqual({ managed: 1, total: 1 });
    expect(r.difficult[0]).toEqual(["Stressed", 2]);
    expect(r.focus).toBe("Plan dinner");
  });
  it("saves one focus per week and clears it when emptied", () => {
    load();
    actions.setWeekFocus(ws, "Charge the phone outside the bedroom");
    actions.setWeekFocus(ws, "Log out of one app");
    expect(getData().settings.weekFocus).toEqual([{ week: ws, text: "Log out of one app" }]);
    actions.setWeekFocus(ws, "  ");
    expect(getData().settings.weekFocus).toEqual([]);
  });
});

describe("days of care and milestones", () => {
  it("count goal-met days and days with a managed urge, and a slip never takes them away", () => {
    load({ cleanDays: [{ habitId: H, day: addDays(t0, -3) }, { habitId: H, day: addDays(t0, -2) }], urges: [urge("u1", addDays(t0, -1), "rode_it_out"), urge("u2", addDays(t0, -1), "rode_it_out"), urge("u3", t0, "slipped")] });
    expect(careDays(getData(), H)).toBe(3);
    const celebrated = [...getData().settings.celebrated];
    actions.logSlip(H, {}, t0);
    expect(careDays(getData(), H)).toBe(3);
    expect(getData().settings.celebrated).toEqual(celebrated);
  });
  it("celebrates only the highest new milestone, once", () => {
    const M = [3, 7, 14, 30] as const;
    expect(milestoneToCelebrate(2, [], M)).toBeNull();
    expect(milestoneToCelebrate(3, [], M)).toEqual({ hit: 3, seen: [3] });
    expect(milestoneToCelebrate(20, [], M)).toEqual({ hit: 14, seen: [3, 7, 14] });
    expect(milestoneToCelebrate(20, [3, 7, 14], M)).toBeNull();
    expect(milestoneToCelebrate(30, [3, 7, 14], M)).toEqual({ hit: 30, seen: [3, 7, 14, 30] });
  });
});
