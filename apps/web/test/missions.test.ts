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
function phone(base: number, opts: { metA?: number; metB?: number; target?: 30 | 60 | 120 } = {}) {
  const [CA, HA, CB, HB] = [1, 2, 3, 4].map((k) => u(base + k));
  const born = shiftDays(T, -150);
  const d = blank();
  const companions: Companion[] = [
    { id: CA, species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null, trackId: HA },
    { id: CB, species: "dog", name: "Scout", bornOn: born, diedOn: null, finalAge: null, trackId: HB, adoption: "rescue", missions: { v: 2, done: [], seen: [], target: opts.target ?? 30 } },
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
  it("a new Rescue starts at 0% with the itchy coat in treatment and a 30-day goal by default", () => {
    const d = blank();
    actions.applyRemote({ ...d, settings: { ...d.settings, onboarded: false } });
    actions.createTrack({ name: "Vaping", cls: "smoking", unit: "count", species: "dog", companionName: "Scout", adoption: "rescue" });
    const c = getData().companions.at(-1)!;
    expect(c).toMatchObject({ adoption: "rescue", missions: { target: 30 } });
    expect(j(c.id)).toMatchObject({ pct: 0, healed: 0, recoveryDays: 21 });
    expect(j(c.id).missions[0]).toMatchObject({ id: "rescue_coat", status: "current", need: 1 });
    expect(m(c.id).healthCap).toBe(10);
  });
  it("a chosen goal sets the recovery length: 120 days means 60 to recover", () => {
    actions.createTrack({ name: "Drinks", cls: "alcohol", unit: "count", species: "dog", companionName: "Rex", adoption: "rescue", target: 120 });
    expect(j(getData().companions.at(-1)!.id)).toMatchObject({ target: 120, recoveryDays: 60 });
  });
  it("a new Raise pet learns skills and its health bar is never limited", () => {
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

describe("the journey from goal-met days", () => {
  it("each track's pet moves on its own days", () => {
    const { CA, CB } = phone(1000, { metA: 10, metB: 3 });
    expect(j(CA).healed).toBe(4);
    expect(j(CB).healed).toBe(2);
  });
  it("marking today heals the next condition and shows it once", () => {
    const { HB, CB } = phone(1100, { metB: 2 });
    expect(j(CB).healed).toBe(1);
    actions.markClean(HB);
    expect(j(CB).healed).toBe(2);
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "healed", mission: "rescue_energy" });
    expect(actions.recordMissions(CB)).toBeNull();
  });
  it("21 goal-met days in a row recover a rescue on a 30-day goal; the bar is then full", () => {
    const { HB, CB } = phone(1200, { metB: 20 });
    actions.markClean(HB);
    expect(j(CB)).toMatchObject({ recovered: true, pct: 100 });
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
  it("the goal can be made longer, which needs more days; never shorter from the sheet", () => {
    const { CB } = phone(1400, { metB: 21 });
    expect(j(CB).recovered).toBe(true);
    actions.setJourneyTarget(CB, 60);
    expect(j(CB)).toMatchObject({ target: 60, recovered: false, recoveryDays: 30 });
  });
});

describe("slips", () => {
  it("during recovery a slip resets the condition in treatment and brings the last one back", () => {
    const { HB, CB } = phone(2000, { metB: 8 });
    expect(j(CB)).toMatchObject({ healed: 3, progress: 2 });
    actions.logSlip(HB, {});
    expect(j(CB)).toMatchObject({ healed: 2, progress: 0 });
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "relapse", mission: "rescue_noise" });
    expect(m(CB).setback).toBe(true);
    expect(j(CB).goalMetDays).toBe(8);
  });
  it("after recovery slips count up to 5 in 30 days, then the deepest condition comes back", () => {
    const { HB, CB } = phone(2100, { metB: 21 });
    for (let i = 4; i >= 1; i--) actions.logSlip(HB, {}, shiftDays(T, -i));
    // Logged in the past, these replace goal-met days: the run was 17 days then 4 slips.
    expect(j(CB).recovered).toBe(false);
  });
  it("a raised puppy keeps what it learned after a slip", () => {
    const { HA, CA } = phone(2200, { metA: 8 });
    actions.logSlip(HA, {});
    expect(j(CA)).toMatchObject({ healed: 3, progress: 0 });
    expect(actions.recordMissions(CA)).toMatchObject({ kind: "reset" });
  });
  it("a slip on another track leaves this pet alone", () => {
    const { HA, CB } = phone(2300, { metB: 4 });
    actions.logSlip(HA, {});
    expect(m(CB).setback).toBe(false);
    expect(j(CB).healed).toBe(2);
  });
});

describe("existing pets", () => {
  it("a pet from before missions reads as Raise on a 30-day goal and counts past days; nothing about it is rewritten", () => {
    const { CA } = phone(3000, { metA: 21 });
    const before = getData().companions.find((c) => c.id === CA)!;
    expect(before.adoption).toBeUndefined();
    expect(j(CA)).toMatchObject({ mode: "raise", target: 30, recovered: true });
    // Past events are history: only today's are shown, so an upgrade brings no backlog of pop-ups.
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
  it("damaged mission data is dropped on load and the pet is kept", () => {
    phone(3200);
    const raw = JSON.parse(JSON.stringify(getData())) as AppData;
    (raw.companions[1] as unknown as Record<string, unknown>).missions = { v: 1, done: ["<script>"], seen: [], target: 45 };
    const c = normalize(raw)!.companions.find((x) => x.id === raw.companions[1].id)!;
    expect(c).toMatchObject({ name: "Scout", adoption: "rescue" });
    expect(c.missions).toBeUndefined();
  });
});

describe("the health bar and heart", () => {
  it("a rescue's bar and heart start low and rise as it recovers; a raised puppy's are unchanged", () => {
    const heart = (id: string) => healthReport(getData(), viewCompanion(getData(), id), "honest");
    const { CA, CB } = phone(7000);
    expect(shownHealth(viewCompanion(getData(), CB).age, m(CB).healthCap)).toBe(10);
    expect(heart(CB)).toMatchObject({ heart: 10, title: "Scout is still recovering" });
    expect(heart(CA).heart).toBe(100);
    const { CB: CB2 } = phone(7100, { metB: 10 });
    expect(m(CB2).healthCap).toBe(50);
  });
});

describe("backup and restore", () => {
  it("a restore keeps both sides' celebrations and this phone's goal", () => {
    const { CB, HB } = phone(5000, { metB: 3 });
    const backup = normalize(JSON.parse(actions.exportJson()))!;
    const local: AppData = { ...backup, companions: backup.companions.map((c) => (c.id === CB ? { ...c, missions: { v: 2, done: [], seen: ["healed:rescue_coat:2026-01-01"], target: 60 } } : c)) };
    const withSeen: AppData = { ...backup, companions: backup.companions.map((c) => (c.id === CB ? { ...c, missions: { v: 2, done: ["recovered"], seen: ["recovered:all:2026-01-02"], target: 30 } } : c)) };
    const c = mergeAdditive(local, withSeen).companions.find((x) => x.id === CB)!;
    expect(c.missions).toMatchObject({ target: 60, done: ["recovered"], seen: ["healed:rescue_coat:2026-01-01", "recovered:all:2026-01-02"] });
    expect(mergeAdditive(local, withSeen).cleanDays.filter((k) => k.habitId === HB)).toHaveLength(3);
  });
  it("memories merge by union", () => {
    expect(mergeMemory({ v: 2, done: ["recovered"], seen: ["a:b"], target: 60 }, { v: 2, done: ["complete"], seen: ["c:d"], target: 30 }))
      .toEqual({ v: 2, done: ["complete", "recovered"], seen: ["a:b", "c:d"], target: 60 });
  });
});

describe("sync", () => {
  beforeEach(() => { lacksColumns("companions", []); lacksColumns("habits", []); });
  it("adoption mode and the goal reach the account; an existing pet's mode stays unset", async () => {
    const { CA, CB } = phone(6000);
    await startSync("user-m1");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CB)).toMatchObject({ adoption_mode: "rescue", missions: { target: 30 } });
    expect(table("companions").get(CA)!.adoption_mode).toBeNull();
    stopSync();
  });
  it("another phone's celebrations are added, never replace this phone's", async () => {
    const { CB, HB } = phone(6100, { metB: 2 });
    actions.markClean(HB);
    expect(actions.recordMissions(CB)).toMatchObject({ kind: "healed", mission: "rescue_energy" });
    await startSync("user-m2");
    const row = table("companions").get(CB)!;
    remoteWrite("companions", { ...row, missions: { v: 2, done: ["recovered"], seen: ["recovered:all:2026-01-02"], target: 30 }, client_updated_at: Date.now() + 10_000 });
    stopSync();
    await startSync("user-m2");
    const c = getData().companions.find((x) => x.id === CB)!;
    expect(c.missions!.done).toContain("recovered");
    expect(c.missions!.seen.length).toBeGreaterThanOrEqual(2);
    expect(c.adoption).toBe("rescue");
    stopSync();
  });
  it("a server without migration 0008 keeps syncing companions, and the phone keeps its goal", async () => {
    lacksColumns("companions", ["adoption_mode", "missions"]);
    const { CB } = phone(6200, { target: 60 });
    await startSync("user-m3");
    expect(getSyncStatus().state).toBe("idle");
    expect(table("companions").get(CB)!.missions).toBeUndefined();
    expect(getData().companions.find((c) => c.id === CB)).toMatchObject({ adoption: "rescue", missions: { target: 60 } });
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
