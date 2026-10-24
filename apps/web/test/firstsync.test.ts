import { describe, expect, it, vi } from "vitest";
import { remoteWrite, table } from "./fake-supabase";

/**
 * First sync on a new phone (audit B17). The phone onboarded and logged things before it ever reached the account,
 * which already has a companion. Rule: the account's companion stays; everything logged here moves onto it.
 */
vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, getData } = await import("../src/store");
const { startSync, stopSync } = await import("../src/sync");
const { blank } = await import("../src/persist");

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CA = u(1), HA = u(2), EA = u(3); // the account's
const CP = u(11), HP = u(12), EP = u(13), UP = u(14); // this phone's, never synced
const D1 = "2026-10-10", D2 = "2026-10-11", D3 = "2026-10-12", TODAY = "2026-10-13";
const entry = (id: string, habitId: string, companionId: string, day: string) => ({
  id, habitId, companionId, day, time: null, values: {}, amount: 100, months: 2.8, severity: 0.7, effects: [], explanation: "", source: "baseline" as const, aiAdjustPct: null, createdAt: 1,
});

describe("a new phone joining an account that already has a companion", () => {
  it("keeps the account's companion, moves this phone's logs onto it, and creates no duplicate", async () => {
    const uid = "user-1";
    remoteWrite("profiles", { id: uid, settings: { onboarded: true, tone: "gentle", goal: "Account goal" }, client_updated_at: 10 });
    remoteWrite("companions", { id: CA, user_id: uid, species: "fox", name: "Ember", born_on: "2026-10-01", died_on: null, final_age: null, client_updated_at: 10 });
    remoteWrite("habits", { id: HA, user_id: uid, companion_id: CA, name: "Orders", class: "food_spending", class_weight: 0.7, unit: "money", fields: [], position: 0, client_updated_at: 10 });
    remoteWrite("entries", { id: EA, user_id: uid, habit_id: HA, companion_id: CA, occurred_on: D1, occurred_at: null, values: {}, amount: 300, client_created_at: 1, client_updated_at: 10 });
    remoteWrite("deductions", { entry_id: EA, user_id: uid, months_lost: 3, severity: 1, ai_adjust_pct: null, body_effects: [], explanation: "", source: "baseline", client_updated_at: 10 });
    remoteWrite("clean_days", { habit_id: HA, day: D3, user_id: uid, client_updated_at: 10 }); // the account marked D3 clean

    const d = blank();
    actions.applyRemote({
      ...d,
      settings: { ...d.settings, onboarded: true, tone: "brutal", goal: "Phone goal" },
      companions: [{ id: CP, species: "dog", name: "Biscuit", bornOn: "2026-10-12", diedOn: null, finalAge: null }],
      habits: [{ id: HP, name: "Takeaway", cls: "food_spending", classWeight: 0.7, companionId: CP, unit: "money", fields: [] }],
      entries: [entry(EP, HP, CP, TODAY), entry(u(15), HP, CP, D3)], // a slip today, and a slip on the day the account calls clean
      cleanDays: [{ habitId: HP, day: D1 }, { habitId: HP, day: D2 }], // D1 clashes with the account's slip
      urges: [{ id: UP, habitId: HP, day: TODAY, time: "21:00", strength: 4, outcome: "rode_it_out", createdAt: 2 }],
      journal: [{ day: TODAY, mood: 3, body: "first day here" }],
    });

    await startSync(uid);
    const local = getData();

    // One companion and one habit: the account's.
    expect(local.companions.map((c) => c.id)).toEqual([CA]);
    expect(local.habits.map((h) => h.id)).toEqual([HA]);
    // Nothing logged on the phone is lost; it all hangs off the account's habit now.
    expect(local.entries.map((e) => e.id).sort()).toEqual([EA, EP, u(15)].sort());
    expect(local.entries.every((e) => e.habitId === HA && e.companionId === CA)).toBe(true);
    expect(local.urges[0]).toMatchObject({ id: UP, habitId: HA });
    expect(local.journal[0].body).toBe("first day here");
    // A slip beats a clean mark on the same day, whichever phone made which.
    expect(local.cleanDays.map((c) => c.day).sort()).toEqual([D2]);
    // The account's settings win.
    expect(local.settings.tone).toBe("gentle");
    expect(local.settings.goal).toBe("Account goal");

    // And the server agrees: the phone's rows arrived under the account's ids; the phone's companion never did.
    expect(table("companions").has(CP)).toBe(false);
    expect(table("habits").has(HP)).toBe(false);
    expect(table("entries").get(EP)).toMatchObject({ habit_id: HA, companion_id: CA });
    expect(table("urges").get(UP)).toMatchObject({ habit_id: HA });
    expect(table("clean_days").get(`${HA}|${D2}`)?.deleted_at ?? null).toBeNull();
    expect(table("clean_days").get(`${HA}|${D3}`)?.deleted_at).toBeTruthy(); // overruled by the phone's slip
    expect(table("clean_days").has(`${HA}|${D1}`)).toBe(false);
    expect((table("profiles").get(uid)!.settings as { tone: string }).tone).toBe("gentle");
    stopSync();
  });

  it("a phone joining an empty account just sends its companion up", async () => {
    const uid = "user-2";
    const C2 = u(21), H2 = u(22), E2 = u(23);
    const d = blank();
    actions.applyRemote({
      ...d,
      settings: { ...d.settings, onboarded: true },
      companions: [{ id: C2, species: "cat", name: "Miso", bornOn: "2026-10-12", diedOn: null, finalAge: null }],
      habits: [{ id: H2, name: "Scrolling", cls: "doomscrolling", classWeight: 0.8, companionId: C2, unit: "minutes", fields: [] }],
      entries: [entry(E2, H2, C2, TODAY)],
    });
    await startSync(uid);
    expect(getData().companions.map((c) => c.id)).toEqual([C2]);
    expect(table("companions").get(C2)).toMatchObject({ user_id: uid, name: "Miso" });
    expect(table("entries").get(E2)).toMatchObject({ user_id: uid, habit_id: H2 });
    stopSync();
  });
});

describe("a phone that lost its sync position but still holds the account's rows", () => {
  it("doesn't overwrite a newer edit from another phone with its older copy", async () => {
    const uid = "user-3";
    const C3 = u(31), H3 = u(32), E3 = u(33);
    remoteWrite("profiles", { id: uid, settings: { onboarded: true }, client_updated_at: 10 });
    remoteWrite("companions", { id: C3, user_id: uid, species: "dog", name: "Bean", born_on: "2026-10-01", died_on: null, final_age: null, client_updated_at: 10 });
    remoteWrite("habits", { id: H3, user_id: uid, companion_id: C3, name: "Orders", class: "food_spending", class_weight: 0.7, unit: "money", fields: [], position: 0, client_updated_at: 10 });
    // Another phone corrected the amount to 250 after this phone last saw it (100).
    remoteWrite("entries", { id: E3, user_id: uid, habit_id: H3, companion_id: C3, occurred_on: D1, occurred_at: null, values: {}, amount: 250, client_created_at: 1, client_updated_at: 20 });
    const d = blank();
    actions.applyRemote({
      ...d, settings: { ...d.settings, onboarded: true },
      companions: [{ id: C3, species: "dog", name: "Bean", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
      habits: [{ id: H3, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C3, unit: "money", fields: [] }],
      entries: [entry(E3, H3, C3, D1)], // amount 100: the old copy
    });
    await startSync(uid);
    expect(getData().entries.find((e) => e.id === E3)!.amount).toBe(250);
    expect(table("entries").get(E3)!.amount).toBe(250);
    stopSync();
  });
});
