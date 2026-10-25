import { describe, expect, it } from "vitest";
import { actions, activeCompanion, cleanStreak, getData, treatsLeft, viewCompanion } from "../src/store";
import { blank, migrateIds, normalize, PER_TRACK_KEYS } from "../src/persist";
import { addDays, today } from "../src/dates";
import { dayStatus } from "../src/recovery";
import { checkTracks, defaultTrackState, focusedTrackId, isPausedOn, listTracks, trackState } from "../src/tracks";
import { diff, legacyProfileCopy, merge, toRemote, tombstone, type Pulled } from "../src/syncmap";
import type { AppData, Entry } from "../src/types";

const t0 = today();
const born = addDays(t0, -40);
const entry = (id: string, habitId: string, companionId: string, day: string, months = 4): Entry => ({
  id, habitId, companionId, day, time: null, values: {}, amount: null, months, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 0,
});
const plan = { goal: "reduce" as const, reasons: ["Money"], situations: [], firstStep: "Delete the app", strategies: [], supportName: "", ifThen: [] };

/** What a phone saved before tracks: one habit, its settings on the person's settings, summaries by week. */
function v1(): unknown {
  return {
    v: 1,
    settings: {
      tone: "gentle", onboarded: true, goal: "Late-night orders", baseline: "daily", plan, restDays: [addDays(t0, -3)], weekFocus: [{ week: "2026-10-19", text: "Cook on Sunday" }],
      celebrated: [3, 7], wear: "bow", treatsGiven: 2, fedOn: addDays(t0, -1), savingsGoal: { label: "Bike", target: 9000 },
    },
    companions: [
      { id: "old", species: "cat", name: "Miso", bornOn: addDays(t0, -90), diedOn: addDays(t0, -41), finalAge: 100 },
      { id: "c1", species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null },
      { id: "c2", species: "fox", name: "Ember", bornOn: addDays(t0, -5), diedOn: null, finalAge: null },
    ],
    habits: [
      { id: "h1", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "c1", unit: "money", fields: [] },
      { id: "h2", name: "Scrolling", cls: "doomscrolling", classWeight: 0.8, companionId: "c2", unit: "minutes", fields: [] },
    ],
    entries: [entry("e0", "h1", "old", addDays(t0, -60)), entry("e1", "h1", "c1", addDays(t0, -2)), entry("e2", "h2", "c2", addDays(t0, -1))],
    cleanDays: [{ habitId: "h1", day: addDays(t0, -1) }, { habitId: "h2", day: addDays(t0, -7) }],
    urges: [{ id: "u1", habitId: "h1", day: t0, time: "21:00", strength: 3, outcome: "rode_it_out", createdAt: 1 }],
    journal: [{ day: t0, mood: 4, body: "ok" }],
    summaries: { "2026-10-19": "A calmer week." },
    updatedAt: 5,
  };
}

/** Two independent tracks, each with its own pet. */
function twoTracks(): AppData {
  const d = blank();
  return {
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [
      { id: "ca", species: "dog", name: "Biscuit", bornOn: born, diedOn: null, finalAge: null, trackId: "ha" },
      { id: "cb", species: "cat", name: "Miso", bornOn: born, diedOn: null, finalAge: null, trackId: "hb" },
    ],
    habits: [
      { id: "ha", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "ca", unit: "money", fields: [], track: defaultTrackState(born) },
      { id: "hb", name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: "cb", unit: "count", fields: [], track: defaultTrackState(born) },
    ],
  };
}
const load = (d: AppData) => actions.applyRemote(d);

describe("migrating data saved before tracks (v1 -> v2)", () => {
  it("keeps every row with the same ids", () => {
    const d = normalize(v1())!;
    expect(d.v).toBe(2);
    expect(d.companions.map((c) => c.id)).toEqual(["old", "c1", "c2"]);
    expect(d.habits.map((h) => h.id)).toEqual(["h1", "h2"]);
    expect(d.entries.map((e) => e.id)).toEqual(["e0", "e1", "e2"]);
    expect(d.cleanDays).toHaveLength(2);
    expect(d.urges.map((u) => u.id)).toEqual(["u1"]);
    expect(d.journal).toEqual([{ day: t0, mood: 4, body: "ok" }]);
    expect(d.settings.tone).toBe("gentle");
  });

  it("gives every track what it showed before: shared settings copied, first-habit-only ones on the first", () => {
    const d = normalize(v1())!;
    expect(trackState(d, "h1")).toMatchObject({
      description: "Late-night orders", baseline: "daily", plan, restDays: [addDays(t0, -3)], weekFocus: [{ week: "2026-10-19", text: "Cook on Sunday" }],
      celebrated: [3, 7], wear: "bow", treatsGiven: 2, fedOn: addDays(t0, -1), savingsGoal: { label: "Bike", target: 9000 }, status: "active", pauses: [],
    });
    // The shared settings were shown on every track, so the second gets a copy; the goal text and the milestone
    // list belonged to the first habit only.
    expect(trackState(d, "h2")).toMatchObject({
      description: "", baseline: "daily", plan, restDays: [addDays(t0, -3)], weekFocus: [{ week: "2026-10-19", text: "Cook on Sunday" }],
      celebrated: [], wear: "bow", treatsGiven: 2, fedOn: addDays(t0, -1), savingsGoal: { label: "Bike", target: 9000 }, status: "active",
    });
    for (const k of PER_TRACK_KEYS) expect(k in d.settings).toBe(false);
  });

  it("dates each track from its own history and gives every companion its owner", () => {
    const d = normalize(v1())!;
    // RECOVERY_RULES: the current pet's birth or the first record, whichever is earlier.
    expect(trackState(d, "h1").startedOn).toBe(addDays(t0, -60)); // a slip from its earlier pet's life
    expect(trackState(d, "h2").startedOn).toBe(addDays(t0, -7)); // a goal-met day before its pet's birthday
    expect(Object.fromEntries(d.companions.map((c) => [c.id, c.trackId]))).toEqual({ old: "h1", c1: "h1", c2: "h2" });
  });

  it("moves weekly summaries under the habit they were written for", () => {
    expect(normalize(v1())!.summaries).toEqual({ h1: { "2026-10-19": "A calmer week." } });
  });

  it("is idempotent, and survives a damaged row", () => {
    const once = normalize(v1())!;
    expect(normalize(JSON.parse(JSON.stringify(once)))).toEqual(once);
    const raw = v1() as Record<string, unknown[]>;
    const d = normalize({ ...raw, entries: [...raw.entries, { id: "bad", months: "lots" }] })!;
    expect(d.entries.map((e) => e.id)).toEqual(["e0", "e1", "e2"]);
    expect(trackState(d, "h1").plan).toEqual(plan);
  });

  it("does not change any pet's age", () => {
    const d = normalize(v1())!;
    // Each pet still carries exactly its own slips: one 4-month slip each.
    expect(viewCompanion(d, "c1").states.reduce((a, s) => a + s.damageMonths, 0)).toBe(4);
    expect(viewCompanion(d, "c2").states.reduce((a, s) => a + s.damageMonths, 0)).toBe(4);
  });

  it("remaps track references along with short ids", () => {
    const d = migrateIds({ ...normalize(v1())!, settings: { ...normalize(v1())!.settings, activeHabit: "h2" } });
    const h1 = d.habits[0].id, h2 = d.habits[1].id;
    expect(h1).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.companions.find((c) => c.name === "Biscuit")!.trackId).toBe(h1);
    expect(Object.keys(d.summaries)).toEqual([h1]);
    expect(d.settings.activeHabit).toBe(h2);
    expect(checkTracks(d)).toEqual([]);
  });
});

describe("tracks never affect each other", () => {
  it("a slip on one track ages only that track's pet", () => {
    load(twoTracks());
    actions.logSlip("ha", {}, t0);
    expect(viewCompanion(getData(), "ca").current!.damageMonths).toBeGreaterThan(0);
    expect(viewCompanion(getData(), "cb").states.every((s) => s.damageMonths === 0)).toBe(true);
  });

  it("a slip filed under one track can't age another track's pet, and the check reports it", () => {
    const d = { ...twoTracks(), entries: [entry("x", "ha", "cb", t0, 6)] };
    expect(viewCompanion(d, "cb").states.every((s) => s.damageMonths === 0)).toBe(true);
    expect(checkTracks(d)).toEqual([{ kind: "entry_cross_track", entryId: "x", habitId: "ha", companionId: "cb" }]);
  });

  it("rest days, celebrations, treats, plans and streaks are per track", () => {
    load(twoTracks());
    expect(actions.setRest("ha", t0, true)).toBe(true);
    actions.markClean("hb", addDays(t0, -1));
    actions.savePlan(plan, "hb");
    actions.setTrackSettings("ha", { celebrated: [3], treatsGiven: 1, wear: "crown" });
    const d = getData();
    expect(dayStatus(d, "ha", t0)).toBe("rest");
    expect(dayStatus(d, "hb", t0)).toBe("unrecorded");
    expect(trackState(d, "ha").plan).toBeNull();
    expect(trackState(d, "hb")).toMatchObject({ plan, celebrated: [], treatsGiven: 0, wear: null });
    expect(cleanStreak(d, "ha")).toBe(0);
    expect(cleanStreak(d, "hb")).toBe(1);
    expect(treatsLeft(d, "hb")).toBe(1);
    expect(checkTracks(d)).toEqual([]);
  });

  it("the single-pet screens follow the focused track", () => {
    load(twoTracks());
    expect(activeCompanion(getData())!.id).toBe("ca");
    actions.selectTrack("hb");
    expect(activeCompanion(getData())!.id).toBe("cb");
    actions.savePlan(plan); // no track given: the focused one
    expect(trackState(getData(), "hb").plan).toEqual(plan);
    expect(trackState(getData(), "ha").plan).toBeNull();
  });
});

describe("track lifecycle", () => {
  it("creates a track with its own pet and nothing borrowed from another", () => {
    load(twoTracks());
    const id = actions.createTrack({ name: "  Betting  ", description: "Weekend bets", cls: "custom", unit: "money", species: "owl", companionName: "Hoot", focus: true })!;
    const d = getData();
    const t = listTracks(d).find((x) => x.id === id)!;
    expect(t).toMatchObject({ name: "Betting", description: "Weekend bets", status: "active", startedOn: t0 });
    expect(t.companion).toMatchObject({ species: "owl", name: "Hoot", trackId: id, bornOn: t0 });
    expect(focusedTrackId(d)).toBe(id);
    expect(actions.createTrack({ name: "   ", cls: "custom", unit: "none", species: "dog", companionName: "x" })).toBeNull();
    expect(checkTracks(d)).toEqual([]);
  });

  it("edits a track, but never moves its start after its first record", () => {
    load({ ...twoTracks(), entries: [entry("e1", "ha", "ca", addDays(t0, -10))] });
    expect(actions.updateTrack("ha", { name: "Food orders", description: "After work", startedOn: addDays(t0, -12) })).toBe(true);
    expect(trackState(getData(), "ha")).toMatchObject({ description: "After work", startedOn: addDays(t0, -12) });
    expect(getData().habits[0].name).toBe("Food orders");
    expect(actions.updateTrack("ha", { startedOn: addDays(t0, -9) })).toBe(false);
    expect(actions.updateTrack("ha", { startedOn: addDays(t0, 1) })).toBe(false);
    expect(actions.updateTrack("ha", { name: " " })).toBe(false);
  });

  it("pausing changes no progress, never refuses or hides a record, and leaves other tracks alone", () => {
    load({ ...twoTracks(), entries: [entry("e1", "ha", "ca", addDays(t0, -3))] });
    const before = viewCompanion(getData(), "ca").age;
    expect(actions.pauseTrack("ha")).toBe(true);
    expect(viewCompanion(getData(), "ca").age).toBe(before);
    expect(actions.pauseTrack("ha")).toBe(false); // already paused
    expect(trackState(getData(), "ha").status).toBe("paused");
    expect(dayStatus(getData(), "ha", t0)).toBe("paused");
    // Records still win over a pause (docs/RECOVERY_RULES.md): something that happened is never lost.
    expect(actions.recordUrge("ha", 3, "rode_it_out")).not.toBeNull();
    expect(dayStatus(getData(), "ha", t0)).toBe("urge");
    expect(actions.logSlip("ha", {}, t0)).not.toBeNull();
    expect(dayStatus(getData(), "ha", t0)).toBe("lapse");
    expect(dayStatus(getData(), "hb", t0)).toBe("unrecorded");
    expect(trackState(getData(), "hb")).toMatchObject({ status: "active", pauses: [] });
  });

  it("resuming the same day leaves no pause behind; a real pause stays in the history", () => {
    load(twoTracks());
    actions.pauseTrack("ha");
    expect(actions.resumeTrack("ha")).toBe(true);
    expect(trackState(getData(), "ha")).toMatchObject({ status: "active", pauses: [] });
    expect(actions.markClean("ha", t0)).toBe(true);
    const s = { ...defaultTrackState(born), pauses: [{ from: addDays(t0, -5), to: addDays(t0, -2) }] };
    expect([addDays(t0, -5), addDays(t0, -3), addDays(t0, -2)].map((day) => isPausedOn(s, day))).toEqual([true, true, false]);
  });

  it("archiving is read-only, refused for the last open track, and reversible", () => {
    load(twoTracks());
    actions.pauseTrack("ha");
    expect(actions.archiveTrack("ha")).toBe(true);
    expect(trackState(getData(), "ha")).toMatchObject({ status: "archived", archivedOn: t0, pauses: [] });
    expect(actions.archiveTrack("hb")).toBe(false); // the last one
    expect(actions.logSlip("ha", {}, addDays(t0, -5))).toBeNull();
    expect(actions.markClean("ha", addDays(t0, -5))).toBe(false);
    expect(actions.recordUrge("ha", 3, "rode_it_out")).toBeNull();
    expect(actions.pauseTrack("ha")).toBe(false);
    actions.selectTrack("ha"); // even when chosen, an archived track isn't the one the screens open
    expect(focusedTrackId(getData())).toBe("hb");
    expect(focusedTrackId(getData())).toBe("hb");
    expect(listTracks(getData(), ["active"]).map((t) => t.id)).toEqual(["hb"]);
    expect(actions.unarchiveTrack("ha")).toBe(true);
    expect(trackState(getData(), "ha")).toMatchObject({ status: "active", archivedOn: null });
  });

  it("deletes a track (archived or not) with its name confirmed, removes only what it owns, and can be undone", () => {
    const base = twoTracks();
    load({
      ...base,
      companions: [...base.companions, { id: "ca0", species: "dog", name: "Pepper", bornOn: addDays(born, -30), diedOn: addDays(born, -1), finalAge: 100, trackId: "ha" }],
      entries: [entry("a1", "ha", "ca", t0), entry("a0", "ha", "ca0", addDays(born, -5)), entry("b1", "hb", "cb", t0)],
      cleanDays: [{ habitId: "ha", day: addDays(t0, -1) }, { habitId: "hb", day: addDays(t0, -1) }],
      urges: [{ id: "ua", habitId: "ha", day: t0, time: null, strength: 2, outcome: "rode_it_out", createdAt: 1 }],
      summaries: { ha: { [t0]: "a" }, hb: { [t0]: "b" } },
    });
    expect(actions.deleteTrack("ha", "Order")).toBeNull(); // the name has to match
    expect(actions.deleteTrack("nope", "Orders")).toBeNull();
    const before = getData();
    const backup = actions.deleteTrack("ha", "  orders ")!;
    const d = getData();
    expect(d.habits.map((h) => h.id)).toEqual(["hb"]);
    expect(d.companions.map((c) => c.id)).toEqual(["cb"]);
    expect(d.entries.map((e) => e.id)).toEqual(["b1"]);
    expect(d.cleanDays).toEqual([{ habitId: "hb", day: addDays(t0, -1) }]);
    expect(d.urges).toEqual([]);
    expect(d.summaries).toEqual({ hb: { [t0]: "b" } });
    // Every removed row becomes a deletion for the account.
    const { removed } = diff(before, d);
    expect(removed.sort()).toEqual(["c:ca", "c:ca0", "e:a0", "e:a1", "h:ha", "k:ha:" + addDays(t0, -1), "u:ua", `w:ha:${t0}`].sort());
    expect(removed.filter((k) => k.startsWith("w:")).map(tombstone)).toEqual([null]); // a summary goes with its soft-deleted habit
    expect(actions.restoreTrack(backup)).toBe(true);
    const back = getData();
    expect(back.habits.map((h) => h.id)).toEqual(["ha", "hb"]);
    expect(back.entries.map((e) => e.id).sort()).toEqual(["a0", "a1", "b1"]);
    expect(back.summaries.ha).toEqual({ [t0]: "a" });
    expect(actions.restoreTrack(backup)).toBe(false);
  });
});

describe("tracks through sync", () => {
  const pulled = (habits: Record<string, unknown>[], profiles: Record<string, unknown>[] = []): Pulled =>
    ({ profiles, companions: [], habits, entries: [], deductions: [], clean_days: [], weekly_reports: [] });

  it("sends a track's state with its habit and its owner with each companion", () => {
    const d = twoTracks();
    d.habits[0] = { ...d.habits[0], track: { ...d.habits[0].track!, description: "x", status: "paused", pauses: [{ from: t0, to: null }], plan } };
    const [h] = toRemote("h:ha", d, "u", 1);
    expect(h.row).toMatchObject({ description: "x", started_on: born, status: "paused", archived_at: null, track: { pauses: [{ from: t0, to: null }], plan } });
    expect(toRemote("c:cb", d, "u", 1)[0].row).toMatchObject({ habit_id: "hb" });
  });

  it("round-trips a track's state, and a bad state from the server never replaces a good one", () => {
    const d = twoTracks();
    d.habits[1] = { ...d.habits[1], track: { ...d.habits[1].track!, plan, restDays: [t0], status: "archived", archivedOn: t0 } };
    const row = { ...toRemote("h:hb", d, "u", 9)[0].row, client_updated_at: 9 };
    const back = merge(twoTracks(), pulled([row]), {}).data;
    expect(trackState(back, "hb")).toEqual(trackState(d, "hb"));
    const bad = merge(d, pulled([{ ...row, status: "deleted?", track: { restDays: "nope" } }]), {}).data;
    expect(trackState(bad, "hb")).toEqual(trackState(d, "hb"));
  });

  it("writes the first track's settings under the old keys for older app versions, and never reads them back", () => {
    const d = twoTracks();
    d.habits[0] = { ...d.habits[0], track: { ...d.habits[0].track!, plan, wear: "bow" } };
    expect(toRemote("s", d, "u", 1)[0].row.settings).toMatchObject({ plan, wear: "bow", goal: "Orders", tone: "honest" });
    expect(legacyProfileCopy(blank())).toEqual({});
    const back = merge(d, pulled([], [{ id: "u", settings: { tone: "brutal", plan: null, wear: null, restDays: [t0] }, client_updated_at: 9 }]), {}).data;
    expect(back.settings.tone).toBe("brutal");
    expect(trackState(back, "ha")).toMatchObject({ plan, wear: "bow", restDays: [] });
    expect("plan" in back.settings).toBe(false);
  });

  it("a change to the first track's state re-sends the profile copy", () => {
    const d = twoTracks();
    const next = { ...d, habits: [{ ...d.habits[0], track: { ...d.habits[0].track!, wear: "bow" as const } }, d.habits[1]] };
    expect(diff(d, next).changed.sort()).toEqual(["h:ha", "s"]);
  });

  it("files weekly summaries under their own track", () => {
    const d = { ...twoTracks(), summaries: { hb: { [t0]: "Smoking week" } } };
    expect(toRemote(`w:hb:${t0}`, d, "u", 1)[0].row).toMatchObject({ habit_id: "hb", week_start: t0, summary: "Smoking week" });
    const back = merge(twoTracks(), { ...pulled([]), weekly_reports: [{ habit_id: "hb", week_start: t0, summary: "Smoking week", client_updated_at: 1 }, { habit_id: "gone", week_start: t0, summary: "?", client_updated_at: 1 }] }, {}).data;
    expect(back.summaries).toEqual({ hb: { [t0]: "Smoking week" } });
  });
});

describe("person-level pet rules across tracks", () => {
  it("classic rules can't be switched on while they'd end any track's companion, not only the focused one", async () => {
    const { canAllowPassingAway } = await import("../src/store");
    const heavy = Array.from({ length: 30 }, (_, i) => [0, 1, 2].map((k) => entry(`b${i}-${k}`, "hb", "cb", addDays(born, i), 18))).flat();
    const d = { ...twoTracks(), entries: heavy };
    expect(focusedTrackId(d)).toBe("ha");
    expect(canAllowPassingAway(d)).toBe(false);
    expect(canAllowPassingAway(twoTracks())).toBe(true);
  });
});

describe("track selection is this phone's alone", () => {
  it("is never sent to the account and never taken from it", () => {
    load(twoTracks());
    actions.selectTrack("hb");
    expect(getData().settings.activeHabit).toBe("hb");
    expect(toRemote("s", getData(), "u", 1)[0].row.settings).not.toHaveProperty("activeHabit");
    const back = merge(getData(), { profiles: [{ id: "u", settings: { tone: "gentle", activeHabit: "ha" }, client_updated_at: 9 }], companions: [], habits: [], entries: [], deductions: [], clean_days: [], weekly_reports: [] }, {}).data;
    expect([back.settings.activeHabit, back.settings.tone]).toEqual(["hb", "gentle"]);
  });
  it("survives a restart, and falls back safely when its track is archived, deleted or never existed", () => {
    load(twoTracks());
    actions.selectTrack("hb");
    expect(normalize(JSON.parse(JSON.stringify(getData())))!.settings.activeHabit).toBe("hb");
    expect(focusedTrackId({ ...getData(), settings: { ...getData().settings, activeHabit: "gone" } })).toBe("ha");
    const noB = { ...getData(), habits: getData().habits.filter((h) => h.id !== "hb") };
    expect(focusedTrackId(noB)).toBe("ha");
    expect(activeCompanion(noB)!.id).toBe("ca");
  });
});

describe("missing and deleted tracks", () => {
  it("a track deleted on another phone disappears here without touching the others or crashing the screens' selectors", async () => {
    const { trackSummary } = await import("../src/progress");
    load({ ...twoTracks(), entries: [entry("a1", "ha", "ca", t0), entry("b1", "hb", "cb", t0)] });
    actions.selectTrack("hb");
    const pulled: Pulled = { profiles: [], companions: [{ id: "cb", deleted_at: "x", client_updated_at: 9 }], habits: [{ id: "hb", deleted_at: "x", client_updated_at: 9 }],
      entries: [{ id: "b1", deleted_at: "x", client_updated_at: 9 }], deductions: [], clean_days: [], weekly_reports: [] };
    const d = merge(getData(), pulled, {}).data;
    expect(d.habits.map((h) => h.id)).toEqual(["ha"]);
    expect(d.entries.map((e) => e.id)).toEqual(["a1"]);
    expect(focusedTrackId(d)).toBe("ha");
    expect(listTracks(d).map((t) => t.id)).toEqual(["ha"]);
    expect(trackSummary(d, "ha", t0).slips).toBe(1);
  });
  it("a track whose pet is missing is reported, kept out of the grid's list, and never crashes the focus", () => {
    const d = { ...twoTracks(), companions: twoTracks().companions.filter((c) => c.id !== "cb") };
    expect(checkTracks(d)).toContainEqual({ kind: "missing_companion", habitId: "hb" });
    expect(listTracks(d).find((t) => t.id === "hb")!.companion).toBeUndefined();
    expect(activeCompanion({ ...d, settings: { ...d.settings, activeHabit: "hb" } })).toBeUndefined();
  });
});

describe("backups, imports and data this version can't fully read", () => {
  it("restores a backup from before tracks, and its own exports round-trip", () => {
    expect(actions.importJson(JSON.stringify(v1()))).toBe(true);
    expect(trackState(getData(), getData().habits[0].id).plan).toEqual(plan);
    const exported = actions.exportJson();
    expect(JSON.parse(exported).v).toBe(2);
    expect(actions.importJson(exported)).toBe(true);
    expect(JSON.parse(actions.exportJson())).toEqual({ ...JSON.parse(exported), updatedAt: expect.any(Number) });
  });
  it("refuses a backup from a newer version instead of half-reading it", () => {
    const before = getData();
    expect(actions.importJson(JSON.stringify({ ...JSON.parse(actions.exportJson()), v: 3 }))).toBe(false);
    expect(getData()).toBe(before);
  });
  it("counts every row it had to leave out, so nothing is dropped silently", async () => {
    const { normalizeWithReport } = await import("../src/persist");
    const raw = v1() as Record<string, unknown[]>;
    expect(normalizeWithReport(raw)!.report).toEqual({ invalid: 0, orphaned: 0 });
    const damaged = { ...raw, entries: [...raw.entries, { id: "bad" }], urges: [...raw.urges, { id: "u9", habitId: "nope", day: t0, time: null, strength: 3, outcome: "slipped", createdAt: 1 }] };
    expect(normalizeWithReport(damaged)!.report).toEqual({ invalid: 1, orphaned: 1 });
    expect(normalizeWithReport({ v: 3 })).toBeNull();
  });
  it("keeps fields from a newer version in settings and track state when it loads and saves", () => {
    const d = twoTracks();
    const future = { ...d, settings: { ...d.settings, futurePref: 1 }, habits: [{ ...d.habits[0], track: { ...d.habits[0].track!, futureTrackField: "x" } }, d.habits[1]] };
    const back = normalize(JSON.parse(JSON.stringify(future)))!;
    expect((back.settings as unknown as Record<string, unknown>).futurePref).toBe(1);
    expect((back.habits[0].track as unknown as Record<string, unknown>).futureTrackField).toBe("x");
    expect(toRemote("h:ha", back, "u", 1)[0].row.track).toMatchObject({ futureTrackField: "x" });
    expect(toRemote("s", back, "u", 1)[0].row.settings).toMatchObject({ futurePref: 1 });
  });
});
