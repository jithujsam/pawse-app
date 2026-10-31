import { beforeEach, describe, expect, it, vi } from "vitest";
import { lacksColumns, remoteWrite, table } from "./fake-supabase";

/** Pet missions (PRD §23) in the app: adoption, progress from goal-met days, slips, setbacks, sync and backups. */
vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, getData, mergeAdditive } = await import("../src/store");
const { startSync, stopSync, getSyncStatus } = await import("../src/sync");
const { blank, normalize } = await import("../src/persist");
const { defaultTrackState } = await import("../src/tracks");
const { companionMissions, mergeMemory } = await import("../src/missions");
const { shiftDays } = await import("../src/progress");
const { today } = await import("../src/dates");
import type { AppData, Companion } from "../src/types";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = today();
/** n goal-met days ending yesterday, oldest first. */
const pastDays = (n: number) => Array.from({ length: n }, (_, i) => shiftDays(T, -(n - i)));

/** Two tracks on one phone: an existing pet from before missions (no mode) and a rescue. */
function phone(base: number, opts: { metA?: number; metB?: number } = {}) {
  const [CA, HA, CB, HB] = [1, 2, 3, 4].map((k) => u(base + k));
  const born = shiftDays(T, -60);
  const d = blank();
  const companions: Companion[] = [
    { id: CA, species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null, trackId: HA },
    { id: CB, species: "dog", name: "Scout", bornOn: born, diedOn: null, finalAge: null, trackId: HB, adoption: "rescue", missions: { v: 1, done: [], seen: [] } },
  ];
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true, activeHabit: HA },
    companions,
    habits: [
      { id: HA, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: CA, unit: "money", fields: [], track: defaultTrackState(born) },
      { id: HB, name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: CB, unit: "count", fields: [], track: defaultTrackState(born) },
    ],
    cleanDays: [...pastDays(opts.metA ?? 0).map((day) => ({ habitId: HA, day })), ...pastDays(opts.metB ?? 0).map((day) => ({ habitId: HB, day }))],
  });
  return { CA, HA, CB, HB };
}
const m = (id: string) => companionMissions(getData(), id, T)!;

describe("adoption", () => {
  it("a new Raise pet starts every development mission at Level 6, score 0", () => {
    const d = blank();
    actions.applyRemote({ ...d, settings: { ...d.settings, onboarded: false } });
    expect(actions.createTrack({ name: "Scrolling", cls: "doomscrolling", unit: "minutes", species: "dog", companionName: "Mochi", adoption: "raise" })).toBeTruthy();
    const c = getData().companions.at(-1)!;
    expect(c.adoption).toBe("raise");
    const s = m(c.id);
    expect(s.mode).toBe("raise");
    expect(s.states.map((x) => [x.level, x.value])).toEqual(Array(6).fill([6, 0]));
    expect(s.stage).toBe("initial");
  });
  it("a new Rescue pet starts every rehabilitation mission at Level 6, condition -10", () => {
    actions.createTrack({ name: "Vaping", cls: "smoking", unit: "count", species: "dog", companionName: "Scout", adoption: "rescue" });
    const c = getData().companions.at(-1)!;
    expect(c.adoption).toBe("rescue");
    const s = m(c.id);
    expect(s.states.map((x) => x.id)).toEqual(["rescue_trust", "rescue_physical", "rescue_fear", "rescue_confidence", "rescue_play", "rescue_safe"]);
    expect(s.states.every((x) => x.level === 6 && x.value === -10)).toBe(true);
    expect(Object.values(s.traits).every((v) => v === 0)).toBe(true);
  });
  it("rescue is for dogs only: a cat asked to be a rescue is raised", () => {
    actions.createTrack({ name: "Cards", cls: "impulse_buying", unit: "money", species: "cat", companionName: "Miso", adoption: "rescue" });
    expect(getData().companions.at(-1)!.adoption).toBe("raise");
  });
});

describe("progress from goal-met days", () => {
  it("each track's pet moves on its own goal-met days only", () => {
    const { CA, CB } = phone(1000, { metA: 12, metB: 3 });
    expect(m(CA).states[0]).toMatchObject({ level: 3, value: 60 });
    expect(m(CB).states[0]).toMatchObject({ level: 5, value: -8 });
  });
  it("marking today moves the next level on, once; marking it again changes nothing", () => {
    const { HB, CB } = phone(1100, { metB: 6 });
    expect(m(CB).states[0].level).toBe(5);
    actions.markClean(HB);
    expect(m(CB).states[0]).toMatchObject({ level: 4, value: -6, days: 7 });
    actions.markClean(HB);
    expect(m(CB).goalMetDays).toBe(7);
    const c = actions.recordMissions(CB);
    expect(c).toMatchObject({ level: 4 });
    expect(actions.recordMissions(CB)).toBeNull();
  });
  it("30 goal-met days recover every rescue mission at 0, and the completion is remembered", () => {
    const { HB, CB } = phone(1200, { metB: 29 });
    actions.markClean(HB);
    actions.recordMissions(CB);
    const s = m(CB);
    expect(s.states.every((x) => x.completed && x.value === 0)).toBe(true);
    expect(s.stage).toBe("recovered");
    expect(getData().companions.find((c) => c.id === CB)!.missions!.done).toHaveLength(6);
    // A correction that removes today's mark doesn't take a completion back.
    actions.unmarkClean(HB, T);
    expect(m(CB).goalMetDays).toBe(29);
    expect(m(CB).states.every((x) => x.completed)).toBe(true);
  });
  it("days before the pet arrived don't count, and a day can't be counted twice", () => {
    const { HA, CA } = phone(1300);
    const d = getData();
    const c = d.companions.find((x) => x.id === CA)!;
    actions.applyRemote({ ...d, cleanDays: [...d.cleanDays, { habitId: HA, day: shiftDays(c.bornOn, -1) }, { habitId: HA, day: shiftDays(T, -1) }, { habitId: HA, day: shiftDays(T, -1) }] });
    expect(m(CA).goalMetDays).toBe(1);
  });
});

describe("slips and setbacks", () => {
  it("a slip doesn't reset goal-met days or remove levels; the pet needs reassurance for a while", () => {
    const { HB, CB } = phone(2000, { metB: 12 });
    expect(m(CB).setback).toBe(false);
    actions.logSlip(HB, {});
    const s = m(CB);
    expect(s.goalMetDays).toBe(12);
    expect(s.states[0].level).toBe(3);
    expect(s.setback).toBe(true);
    expect(s.traits.energy).toBeLessThan(companionMissions(getData(), CB, shiftDays(T, 2))!.traits.energy);
  });
  it("the setback ends after the next day, or with the next goal-met day", () => {
    const { HB, CB } = phone(2100, { metB: 4 });
    actions.logSlip(HB, {}, shiftDays(T, -1));
    expect(m(CB).setback).toBe(true);
    actions.markClean(HB);
    expect(m(CB).setback).toBe(false);
    expect(companionMissions(getData(), CB, shiftDays(T, 2))!.setback).toBe(false);
  });
  it("a slip on another track leaves this pet alone", () => {
    const { HA, CB } = phone(2200, { metB: 4 });
    actions.logSlip(HA, {});
    expect(m(CB).setback).toBe(false);
  });
});

describe("existing pets", () => {
  it("a pet from before missions reads as Raise, counts its past goal-met days, and celebrates once", () => {
    const { CA } = phone(3000, { metA: 20 });
    const before = getData().companions.find((c) => c.id === CA)!;
    expect(before.adoption).toBeUndefined();
    expect(m(CA)).toMatchObject({ mode: "raise", goalMetDays: 20 });
    expect(m(CA).states[0]).toMatchObject({ level: 2, value: 80 });
    expect(actions.recordMissions(CA)).toMatchObject({ level: 2 });
    expect(actions.recordMissions(CA)).toBeNull();
    const after = getData().companions.find((c) => c.id === CA)!;
    // Nothing about the pet itself changes: same name, birth, coat, and no mode written for it.
    expect({ ...after, missions: undefined }).toEqual({ ...before, missions: undefined });
  });
  it("older saved data without missions loads unchanged", () => {
    phone(3100, { metA: 2 });
    const raw = JSON.parse(JSON.stringify(getData())) as AppData;
    for (const c of raw.companions) { delete c.adoption; delete c.missions; }
    const back = normalize(raw)!;
    expect(back.companions.every((c) => c.adoption === undefined && c.missions === undefined)).toBe(true);
    expect(back.cleanDays).toEqual(raw.cleanDays);
  });
  it("malformed mission data is dropped on load, never trusted, and the pet is kept", () => {
    phone(3200);
    const raw = JSON.parse(JSON.stringify(getData())) as Record<string, unknown> & AppData;
    (raw.companions[1] as unknown as Record<string, unknown>).missions = { v: 1, done: ["<script>"], seen: [] };
    const back = normalize(raw)!;
    const c = back.companions.find((x) => x.id === raw.companions[1].id)!;
    expect(c).toMatchObject({ name: "Scout", adoption: "rescue" });
    expect(c.missions).toBeUndefined();
  });
});

describe("the health bar and heart", () => {
  it("a rescue's heart and bar start low and rise with missions; a raised puppy's are unchanged", async () => {
    const { viewCompanion } = await import("../src/store");
    const { healthReport } = await import("../src/health");
    const { shownHealth } = await import("../src/missions");
    const { CA, CB } = phone(7000, { metA: 0, metB: 0 });
    const heart = (id: string) => healthReport(getData(), viewCompanion(getData(), id), "honest");
    expect(m(CB).healthCap).toBe(10);
    expect(shownHealth(viewCompanion(getData(), CB).age, m(CB).healthCap)).toBe(10);
    expect(heart(CB)).toMatchObject({ heart: 10, title: "Scout is still recovering" });
    expect(heart(CA).heart).toBe(100);
    const { CB: CB2 } = phone(7100, { metB: 12 });
    expect(m(CB2).healthCap).toBe(55);
    expect(heart(CB2).heart).toBeLessThanOrEqual(55);
    const { CB: CB3 } = phone(7200, { metB: 30 });
    expect(m(CB3).healthCap).toBe(100);
  });
});

describe("pet days (an optional extra)", () => {
  it("counts at most once a day", () => {
    const { CB } = phone(4000);
    actions.notePetDay(CB); actions.notePetDay(CB); actions.notePetDay(CB);
    expect(getData().companions.find((c) => c.id === CB)!.missions).toMatchObject({ petDays: 1, petOn: T });
    expect(m(CB).states[0].extra).toMatchObject({ kind: "petDays", have: 1, target: 20 });
    expect(m(CB).states[0].level).toBe(6);
  });
});

describe("backup and restore", () => {
  it("restoring a backup keeps both phones' completions and celebrations", () => {
    const { CB, HB } = phone(5000, { metB: 3 });
    actions.recordMissions(CB);
    const backup = normalize(JSON.parse(actions.exportJson()))!;
    expect(backup.companions.find((c) => c.id === CB)).toMatchObject({ adoption: "rescue", missions: { seen: expect.arrayContaining(["rescue_trust:5"]) } });
    const local: AppData = { ...backup, companions: backup.companions.map((c) => (c.id === CB ? { ...c, missions: { v: 1, done: ["rescue_safe"], seen: [] } } : c)) };
    const merged = mergeAdditive(local, backup);
    const c = merged.companions.find((x) => x.id === CB)!;
    expect(c.missions!.done).toEqual(["rescue_safe"]);
    expect(c.missions!.seen).toContain("rescue_trust:5");
    expect(merged.cleanDays.filter((k) => k.habitId === HB)).toHaveLength(3);
  });
  it("memories merge by union", () => {
    expect(mergeMemory({ v: 1, done: ["a"], seen: ["a:5"], petDays: 2 }, { v: 1, done: ["b"], seen: ["a:5", "b:5"], petDays: 5, petOn: "2026-10-01" }))
      .toEqual({ v: 1, done: ["a", "b"], seen: ["a:5", "b:5"], petDays: 5, petOn: "2026-10-01" });
  });
});

describe("sync", () => {
  beforeEach(() => { lacksColumns("companions", []); lacksColumns("habits", []); });
  it("adoption mode and mission memory reach the account; an existing pet's mode stays unset", async () => {
    const { CA, CB } = phone(6000, { metB: 3 });
    actions.recordMissions(CB);
    await startSync("user-m1");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CB)).toMatchObject({ adoption_mode: "rescue", missions: { done: [], seen: expect.arrayContaining(["rescue_trust:5"]) } });
    expect(table("companions").get(CA)!.adoption_mode).toBeNull();
    stopSync();
  });
  it("another phone's completions are added, never replace this phone's", async () => {
    const { CB } = phone(6100, { metB: 3 });
    actions.recordMissions(CB);
    await startSync("user-m2");
    const row = table("companions").get(CB)!;
    remoteWrite("companions", { ...row, missions: { v: 1, done: ["rescue_safe"], seen: ["rescue_safe:0"] }, client_updated_at: Date.now() + 10_000 });
    stopSync();
    await startSync("user-m2");
    const c = getData().companions.find((x) => x.id === CB)!;
    expect(c.missions!.done).toContain("rescue_safe");
    expect(c.missions!.seen).toEqual(expect.arrayContaining(["rescue_safe:0", "rescue_trust:5"]));
    expect(c.adoption).toBe("rescue");
    stopSync();
  });
  it("a server without migration 0008 keeps syncing companions, and the phone keeps its missions", async () => {
    lacksColumns("companions", ["adoption_mode", "missions"]);
    const { CB } = phone(6200, { metB: 3 });
    actions.recordMissions(CB);
    await startSync("user-m3");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CB)).toMatchObject({ name: "Scout" });
    expect(table("companions").get(CB)!.missions).toBeUndefined();
    expect(getData().companions.find((c) => c.id === CB)).toMatchObject({ adoption: "rescue", missions: { seen: expect.arrayContaining(["rescue_trust:5"]) } });
    stopSync();
  });
  it("a server without 0006 or 0008 still takes companions", async () => {
    lacksColumns("companions", ["habit_id", "adoption_mode", "missions"]);
    const { CA } = phone(6300);
    await startSync("user-m4");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CA)).toMatchObject({ name: "Biscuit" });
    stopSync();
  });
});
