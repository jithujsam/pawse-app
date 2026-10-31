import { beforeEach, describe, expect, it, vi } from "vitest";
import { lacksColumns, remoteWrite, table } from "./fake-supabase";

/** Pet missions (PRD §23) in the app: adoption, the recovery journey from goal-met days, slips, sync and backups. */
vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, getData, mergeAdditive, viewCompanion } = await import("../src/store");
const { startSync, stopSync, getSyncStatus } = await import("../src/sync");
const { blank, normalize } = await import("../src/persist");
const { defaultTrackState } = await import("../src/tracks");
const { companionMissions, mergeMemory, shownHealth } = await import("../src/missions");
const { healthReport } = await import("../src/health");
const { shiftDays } = await import("../src/progress");
const { today } = await import("../src/dates");
import type { AppData, Companion } from "../src/types";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = today();
/** n goal-met days in a row ending yesterday. */
const pastDays = (n: number) => Array.from({ length: n }, (_, i) => shiftDays(T, -(n - i)));

/** Two tracks: an existing pet from before missions (no mode) and a rescue. */
function phone(base: number, opts: { metA?: number; metB?: number } = {}) {
  const [CA, HA, CB, HB] = [1, 2, 3, 4].map((k) => u(base + k));
  const born = shiftDays(T, -150);
  const d = blank();
  const companions: Companion[] = [
    { id: CA, species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null, trackId: HA },
    { id: CB, species: "dog", name: "Scout", bornOn: born, diedOn: null, finalAge: null, trackId: HB, adoption: "rescue", missions: { v: 3, done: [], seen: [] } },
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
const j = (id: string) => m(id).journey;

describe("adoption", () => {
  it("a new Rescue is at day 0 of 21 with the itchy coat healing first, health bar at 10%", () => {
    const d = blank();
    actions.applyRemote({ ...d, settings: { ...d.settings, onboarded: false } });
    actions.createTrack({ name: "Vaping", cls: "smoking", unit: "count", species: "dog", companionName: "Scout", adoption: "rescue" });
    const c = getData().companions.at(-1)!;
    expect(c.adoption).toBe("rescue");
    expect(j(c.id)).toMatchObject({ phase: "recovery", run: 0 });
    expect(j(c.id).missions[0]).toMatchObject({ id: "rescue_coat", status: "current", at: 1 });
    expect(m(c.id).healthCap).toBe(10);
  });
  it("a new Raise pet learns skills and its health bar is never limited in training", () => {
    actions.createTrack({ name: "Scrolling", cls: "doomscrolling", unit: "minutes", species: "dog", companionName: "Mochi", adoption: "raise" });
    const c = getData().companions.at(-1)!;
    expect(j(c.id).missions[0].id).toBe("raise_name");
    expect(m(c.id).healthCap).toBe(100);
  });
  it("rescue is for dogs only: a cat asked to be a rescue is raised", () => {
    actions.createTrack({ name: "Cards", cls: "impulse_buying", unit: "money", species: "cat", companionName: "Miso", adoption: "rescue" });
    expect(getData().companions.at(-1)!.adoption).toBe("raise");
  });
});

describe("21 goal-met days in a row", () => {
  it("each track's pet moves on its own days", () => {
    const { CA, CB } = phone(1000, { metA: 10, metB: 3 });
    expect(j(CA).run).toBe(10);
    expect(j(CB).run).toBe(3);
  });
  it("marking today heals the next condition and shows it once", () => {
    const { HB, CB } = phone(1100, { metB: 2 });
    actions.markClean(HB);
    expect(j(CB).run).toBe(3);
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "healed", id: "rescue_energy" });
    expect(actions.recordMissions(CB)).toBeNull();
  });
  it("day 21 recovers a rescue; consistency starts and the bar is full", () => {
    const { HB, CB } = phone(1200, { metB: 20 });
    actions.markClean(HB);
    expect(j(CB)).toMatchObject({ phase: "consistency", run: 21 });
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "recovered" });
    expect(getData().companions.find((c) => c.id === CB)!.missions!.done).toContain("recovered");
    expect(m(CB).healthCap).toBe(100);
  });
  it("days before the pet arrived don't count, and a day can't count twice", () => {
    const { HA, CA } = phone(1300);
    const d = getData();
    const c = d.companions.find((x) => x.id === CA)!;
    actions.applyRemote({ ...d, cleanDays: [...d.cleanDays, { habitId: HA, day: shiftDays(c.bornOn, -1) }, { habitId: HA, day: shiftDays(T, -1) }, { habitId: HA, day: shiftDays(T, -1) }] });
    expect(j(CA).goalMetDays).toBe(1);
  });
});

describe("slips", () => {
  it("in recovery a slip starts the 21 days over", () => {
    const { HB, CB } = phone(2000, { metB: 8 });
    actions.logSlip(HB, {});
    expect(j(CB)).toMatchObject({ phase: "recovery", run: 0 });
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "restart", n: 8 });
    expect(m(CB).setback).toBe(true);
    expect(j(CB).goalMetDays).toBe(8);
  });
  it("after recovery a slip gives an issue instead, cleared by days in a row", () => {
    const { HB, CB } = phone(2100, { metB: 25 });
    actions.logSlip(HB, {});
    expect(j(CB)).toMatchObject({ phase: "consistency", issue: { tier: 1, need: 3 } });
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "issue", tier: 1 });
    expect(m(CB).healthCap).toBe(85);
  });
  it("a severe slip counts as heavy", () => {
    const { HB, CB } = phone(2150, { metB: 25 });
    actions.logSlip(HB, {});
    const d = getData();
    actions.applyRemote({ ...d, entries: d.entries.map((e) => (e.habitId === HB ? { ...e, severity: 2.5 } : e)) });
    expect(j(CB).issue).toMatchObject({ tier: 2, need: 7 });
  });
  it("a slip on another track leaves this pet alone", () => {
    const { HA, CB } = phone(2300, { metB: 4 });
    actions.logSlip(HA, {});
    expect(m(CB).setback).toBe(false);
    expect(j(CB).run).toBe(4);
  });
});

describe("existing pets", () => {
  it("a pet from before missions reads as Raise and counts past days; no backlog of pop-ups and nothing rewritten", () => {
    const { CA } = phone(3000, { metA: 21 });
    const before = getData().companions.find((c) => c.id === CA)!;
    expect(before.adoption).toBeUndefined();
    expect(j(CA)).toMatchObject({ mode: "raise", phase: "consistency" });
    expect(actions.recordMissions(CA)).toBeNull();
    expect(getData().companions.find((c) => c.id === CA)).toEqual(before);
  });
  it("older saved data without missions loads unchanged", () => {
    phone(3100, { metA: 2 });
    const raw = JSON.parse(JSON.stringify(getData())) as AppData;
    for (const c of raw.companions) { delete c.adoption; delete c.missions; }
    const back = normalize(raw)!;
    expect(back.companions.every((c) => c.adoption === undefined && c.missions === undefined)).toBe(true);
  });
  it("4.1.0 data with a goal still loads; the goal is ignored", () => {
    const { CB } = phone(3150, { metB: 3 });
    const raw = JSON.parse(JSON.stringify(getData())) as AppData;
    raw.companions = raw.companions.map((c) => (c.id === CB ? { ...c, missions: { v: 2, done: [], seen: [], target: 120 } } : c));
    actions.applyRemote(normalize(raw)!);
    expect(j(CB)).toMatchObject({ phase: "recovery", run: 3 });
  });
  it("damaged mission data is dropped on load and the pet is kept", () => {
    phone(3200);
    const raw = JSON.parse(JSON.stringify(getData())) as AppData;
    (raw.companions[1] as unknown as Record<string, unknown>).missions = { v: 1, done: ["<script>"], seen: [] };
    const c = normalize(raw)!.companions.find((x) => x.id === raw.companions[1].id)!;
    expect(c).toMatchObject({ name: "Scout", adoption: "rescue" });
    expect(c.missions).toBeUndefined();
  });
});

describe("the health bar and heart", () => {
  it("a rescue's bar and heart start low and rise day by day; a raised puppy's are unchanged", () => {
    const heart = (id: string) => healthReport(getData(), viewCompanion(getData(), id), "honest");
    const { CA, CB } = phone(7000);
    expect(shownHealth(viewCompanion(getData(), CB).age, m(CB).healthCap)).toBe(10);
    expect(heart(CB)).toMatchObject({ heart: 10, title: "Scout is still recovering" });
    expect(heart(CA).heart).toBe(100);
    const { CB: CB2 } = phone(7100, { metB: 14 });
    expect(m(CB2).healthCap).toBe(70);
  });
});

describe("backup and restore", () => {
  it("a restore keeps both sides' pop-ups seen", () => {
    const { CB, HB } = phone(5000, { metB: 3 });
    const backup = normalize(JSON.parse(actions.exportJson()))!;
    const local: AppData = { ...backup, companions: backup.companions.map((c) => (c.id === CB ? { ...c, missions: { v: 3, done: [], seen: ["healed:rescue_coat:2026-01-01"] } } : c)) };
    const other: AppData = { ...backup, companions: backup.companions.map((c) => (c.id === CB ? { ...c, missions: { v: 3, done: ["recovered"], seen: ["recovered:all:2026-01-02"] } } : c)) };
    const merged = mergeAdditive(local, other);
    expect(merged.companions.find((x) => x.id === CB)!.missions).toMatchObject({ done: ["recovered"], seen: ["healed:rescue_coat:2026-01-01", "recovered:all:2026-01-02"] });
    expect(merged.cleanDays.filter((k) => k.habitId === HB)).toHaveLength(3);
  });
  it("memories merge by union", () => {
    expect(mergeMemory({ v: 3, done: ["recovered"], seen: ["a:b"] }, { v: 3, done: [], seen: ["c:d"] })).toEqual({ v: 3, done: ["recovered"], seen: ["a:b", "c:d"] });
  });
});

describe("sync", () => {
  beforeEach(() => { lacksColumns("companions", []); lacksColumns("habits", []); });
  it("adoption mode and mission memory reach the account; an existing pet's mode stays unset", async () => {
    const { CA, CB } = phone(6000);
    await startSync("user-m1");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CB)).toMatchObject({ adoption_mode: "rescue", missions: { v: 3 } });
    expect(table("companions").get(CA)!.adoption_mode).toBeNull();
    stopSync();
  });
  it("another phone's celebrations are added, never replace this phone's", async () => {
    const { CB, HB } = phone(6100, { metB: 2 });
    actions.markClean(HB);
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "healed", id: "rescue_energy" });
    await startSync("user-m2");
    const row = table("companions").get(CB)!;
    remoteWrite("companions", { ...row, missions: { v: 3, done: ["recovered"], seen: ["recovered:all:2026-01-02"] }, client_updated_at: Date.now() + 10_000 });
    stopSync();
    await startSync("user-m2");
    const c = getData().companions.find((x) => x.id === CB)!;
    expect(c.missions!.done).toContain("recovered");
    expect(c.missions!.seen.length).toBeGreaterThanOrEqual(2);
    expect(c.adoption).toBe("rescue");
    stopSync();
  });
  it("a server without migration 0008 keeps syncing companions, and the phone keeps its mode", async () => {
    lacksColumns("companions", ["adoption_mode", "missions"]);
    const { CB } = phone(6200);
    await startSync("user-m3");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CB)!.missions).toBeUndefined();
    expect(getData().companions.find((c) => c.id === CB)).toMatchObject({ adoption: "rescue", missions: { v: 3 } });
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
