import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTINUITY, simulate } from "@detox/engine";
import {
  checkIns, dayControls, dayStatus, monthGrid, petDayInputs, shiftDays, statusOf, streaks, trackIndex, trackSummary, weekdayOf,
} from "../src/progress";
import { addDays, today } from "../src/dates";
import { actions, checkedInDays, getData, QUIET_DAYS_AGE, slipHour, viewCompanion } from "../src/store";
import { history } from "../src/health";
import { blank, normalize } from "../src/persist";
import { buildFields } from "../src/questions";
import { trackState, type LegacyTrackSettings } from "../src/tracks";
import type { AppData, CleanDay, Entry, Urge } from "../src/types";

/**
 * Regression tests for docs/RECOVERY_RULES.md, one block per rule. Fixed dates go straight to the pure layer;
 * the store tests use the real clock (or a faked one) because the store's actions work on "today".
 */

const fields = buildFields({ what: "Orders", measure: "money", cls: "food_spending", triggers: [] });
const A = "habit-a", B = "habit-b";
const T0 = "2026-03-20";
let n = 0;
const slip = (habitId: string, day: string, extra: Partial<Entry> = {}): Entry => ({
  id: `e${++n}`, habitId, companionId: `c-${habitId}`, day, time: null, values: {}, amount: null, months: 3, severity: 1, effects: [], explanation: "",
  source: "baseline", aiAdjustPct: null, createdAt: n, ...extra,
});
const met = (habitId: string, day: string): CleanDay => ({ habitId, day });
const urge = (habitId: string, day: string, outcome: Urge["outcome"] = "rode_it_out"): Urge => ({ id: `u${++n}`, habitId, day, time: "20:00", strength: 3, outcome, createdAt: n });

/**
 * Two tracks. Per-track state (rest days, pauses, celebrations) is given the way it was stored before tracks had
 * their own (keys on settings), and goes through the real v1 -> v2 migration onto each track, so every rule
 * below is also checked on migrated data.
 */
type Fixture = { entries?: Entry[]; cleanDays?: CleanDay[]; urges?: Urge[]; bornOn?: string; settings?: Partial<AppData["settings"]> & LegacyTrackSettings };
const data = (p: Fixture = {}): AppData => normalize(rawV1(p))!;
/** The same two tracks as saved before tracks had their own state (local data v1). */
function rawV1(p: Fixture = {}) {
  const d = blank();
  const bornOn = p.bornOn ?? "2026-03-01";
  return ({
    ...d, v: 1, summaries: {},
    settings: { ...d.settings, onboarded: true, ...p.settings },
    companions: [A, B].map((h) => ({ id: `c-${h}`, species: "dog" as const, name: h, bornOn, diedOn: null, finalAge: null })),
    habits: [A, B].map((h) => ({ id: h, name: h, cls: "food_spending" as const, classWeight: 0.7, companionId: `c-${h}`, unit: "money" as const, fields })),
    entries: p.entries ?? [], cleanDays: p.cleanDays ?? [], urges: p.urges ?? [],
  });
}
const days = (from: string, count: number) => Array.from({ length: count }, (_, i) => shiftDays(from, i));
const t = () => today();
const load = (p: Parameters<typeof data>[0] = {}) => actions.applyRemote(data({ bornOn: addDays(t(), -40), ...p }));

// ---------- 1. track isolation ----------

describe("1. every number uses only its own track", () => {
  it("slips, goal-met days, urges, rest days and pauses on one track never reach another", () => {
    const d = data({
      entries: [slip(A, "2026-03-18"), slip(A, "2026-03-19")], cleanDays: days("2026-03-10", 10).map((x) => met(B, x)),
      urges: [urge(A, "2026-03-17"), urge(B, "2026-03-16", "slipped")],
      settings: { trackRest: { [B]: ["2026-03-20"] }, pauses: { [A]: [{ from: "2026-03-05", to: "2026-03-08" }] } },
    });
    const [a, b] = [trackSummary(d, A, T0), trackSummary(d, B, T0)];
    expect([a.slips, a.metDays, a.managedUrges, a.today]).toEqual([2, 0, 1, "unrecorded"]);
    expect([b.slips, b.metDays, b.managedUrges, b.today, b.current]).toEqual([0, 10, 0, "rest", 10]);
    expect(statusOf(trackIndex(d, B, T0), "2026-03-06")).toBe("unrecorded");
    expect(statusOf(trackIndex(d, A, T0), "2026-03-06")).toBe("paused");
  });
  it("each track starts on its own companion's birth or its own first record", () => {
    const d = data({ bornOn: "2026-03-10", entries: [slip(A, "2026-02-01")] });
    expect([trackIndex(d, A, T0).start, trackIndex(d, B, T0).start]).toEqual(["2026-02-01", "2026-03-10"]);
  });
});

// ---------- 2. check-ins ----------

describe("2. only an explicitly logged slip is a slip", () => {
  it("an urge acted on is recorded as a check-in, never as a slip", () => {
    load();
    actions.recordUrge(A, 4, "slipped");
    const d = getData();
    expect(d.entries).toHaveLength(0);
    expect(dayStatus(d, A, t(), t())).toBe("unrecorded");
    expect(trackSummary(d, A, t())).toMatchObject({ slips: 0, current: 0, checkedIn: 1, lastRecorded: t() });
  });
  it("the slip exists only once the person confirms it in the slip sheet", () => {
    load({ cleanDays: [met(A, addDays(t(), -1))] });
    actions.recordUrge(A, 4, "slipped");
    expect(trackSummary(getData(), A, t()).current).toBe(1);
    actions.logSlip(A, {});
    expect(trackSummary(getData(), A, t())).toMatchObject({ slips: 1, current: 0, today: "lapse" });
  });
  it("an acted-on urge counts as a check-in for quiet days and missed check-ins", () => {
    const d = data({ bornOn: "2026-03-15", urges: [urge(A, "2026-03-18", "slipped")] });
    const s = trackSummary(d, A, T0);
    expect([s.quiet, s.missed, s.checkedIn]).toEqual([1, 4, 1]);
  });
});

// ---------- 3. goal-met days follow the slips ----------

describe("3. goal-met days are recalculated when slips change", () => {
  it("adding, then deleting, the only slip on a goal-met day restores the goal-met day and its healing", () => {
    load();
    const day = addDays(t(), -3);
    actions.markClean(A, day);
    const healed = () => viewCompanion(getData(), `c-${A}`).states.find((s) => s.day === day)!.healedMonths;
    const before = trackSummary(getData(), A, t());
    const e = actions.logSlip(A, {}, day).entry;
    expect(dayStatus(getData(), A, day, t())).toBe("lapse");
    expect(healed()).toBe(0);
    actions.deleteEntry(e.id);
    expect(dayStatus(getData(), A, day, t())).toBe("met");
    expect(trackSummary(getData(), A, t())).toMatchObject({ current: before.current, best: before.best, care: before.care, metDays: before.metDays });
  });
  it("with two slips on the day, deleting one keeps the slip; deleting the last restores goal met", () => {
    load();
    const day = addDays(t(), -2);
    actions.markClean(A, day);
    const [x, y] = [actions.logSlip(A, {}, day).entry, actions.logSlip(A, {}, day).entry];
    actions.deleteEntry(x.id);
    expect(dayStatus(getData(), A, day, t())).toBe("lapse");
    actions.deleteEntry(y.id);
    expect(dayStatus(getData(), A, day, t())).toBe("met");
  });
  it("editing a slip in place (AI adjustment, reflection) keeps the day a slip", () => {
    load();
    const day = addDays(t(), -1);
    actions.markClean(A, day);
    const e = actions.logSlip(A, {}, day).entry;
    actions.applyAi(e.id, { months: 2, adjustPct: -10, effects: [], explanation: "x" });
    actions.reflectOnLapse(e.id, { before: "tired", adjust: "eat earlier" });
    expect(dayStatus(getData(), A, day, t())).toBe("lapse");
  });
  it("a slip moved to another day (an edit synced from another phone) frees the old day and marks the new one", () => {
    load();
    const [d1, d2] = [addDays(t(), -5), addDays(t(), -4)];
    actions.markClean(A, d1); actions.markClean(A, d2);
    const e = actions.logSlip(A, {}, d1).entry;
    const cur = getData();
    actions.applyRemote({ ...cur, entries: cur.entries.map((x) => (x.id === e.id ? { ...x, day: d2 } : x)) });
    expect([dayStatus(getData(), A, d1, t()), dayStatus(getData(), A, d2, t())]).toEqual(["met", "lapse"]);
  });
  it("marking goal met is refused on a day that already has a slip", () => {
    load();
    actions.logSlip(A, {}, addDays(t(), -1));
    expect(actions.markClean(A, addDays(t(), -1))).toBe(false);
  });
});

// ---------- 4. streaks, and existing users ----------

/** The streak, best streak and days of care exactly as they were computed before this change (commit 2f762cb). */
const legacy = {
  current(d: AppData, habitId: string, t0: string) {
    let k = 0;
    const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
    const cleans = new Set(d.cleanDays.filter((c) => c.habitId === habitId).map((c) => c.day));
    for (let day = t0; ; day = shiftDays(day, -1)) {
      if (slips.has(day)) break;
      if (cleans.has(day)) k++; else if (day !== t0) break;
      if (k > 3650) break;
    }
    return k;
  },
  best(d: AppData, habitId: string) {
    const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
    const ds = [...new Set(d.cleanDays.filter((c) => c.habitId === habitId && !slips.has(c.day)).map((c) => c.day))].sort();
    let best = 0, run = 0, prev = "";
    for (const day of ds) { run = prev && shiftDays(prev, 1) === day ? run + 1 : 1; best = Math.max(best, run); prev = day; }
    return best;
  },
  care(d: AppData, habitId: string) {
    const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
    const out = new Set<string>();
    for (const c of d.cleanDays) if (c.habitId === habitId && !slips.has(c.day)) out.add(c.day);
    for (const u of d.urges) if (u.habitId === habitId && u.outcome === "rode_it_out") out.add(u.day);
    return out.size;
  },
};

/** A small seeded generator, so a failure reproduces. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 2 ** 32; return seed / 2 ** 32; };

describe("4. streaks", () => {
  it("count successful days only; neutral days inside a run neither add nor break it", () => {
    const d = data({
      cleanDays: [met(A, "2026-03-12"), met(A, "2026-03-16"), met(A, "2026-03-19")],
      settings: { trackRest: { [A]: ["2026-03-13"] }, pauses: { [A]: [{ from: "2026-03-14", to: "2026-03-16" }] } },
    });
    expect(streaks(trackIndex(d, A, T0))).toEqual({ current: 3, best: 3, lastSlip: null, runStart: "2026-03-12" });
  });
  it("an existing user's current streak, best streak and days of care never go down (500 random histories)", () => {
    const r = rng(42);
    for (let i = 0; i < 500; i++) {
      const span = 20 + Math.floor(r() * 120);
      const start = shiftDays(T0, -span);
      const entries: Entry[] = [], cleanDays: CleanDay[] = [], urges: Urge[] = [], restDays: string[] = [];
      for (const day of days(start, span + 1)) {
        const x = r();
        if (x < 0.12) entries.push(slip(A, day));
        else if (x < 0.6) cleanDays.push(met(A, day));
        else if (x < 0.7) restDays.push(day);
        if (r() < 0.05) cleanDays.push(met(A, day)); // a goal-met mark under a slip, or a duplicate from sync
        if (r() < 0.15) urges.push(urge(A, day, r() < 0.7 ? "rode_it_out" : "slipped"));
      }
      const d = data({ bornOn: start, entries, cleanDays, urges, settings: { restDays } });
      const s = streaks(trackIndex(d, A, T0));
      const context = `history ${i}`;
      expect(s.current, context).toBeGreaterThanOrEqual(legacy.current(d, A, T0));
      expect(s.best, context).toBeGreaterThanOrEqual(legacy.best(d, A));
      expect(trackSummary(d, A, T0).care, context).toBe(legacy.care(d, A));
    }
  });
  it("stays exactly the same for someone who checked in every day", () => {
    const d = data({ bornOn: "2026-02-01", cleanDays: days("2026-02-01", 48).map((x) => met(A, x)), entries: [slip(A, "2026-02-20")] });
    expect([streaks(trackIndex(d, A, T0)).current, streaks(trackIndex(d, A, T0)).best]).toEqual([legacy.current(d, A, T0), legacy.best(d, A)]);
  });
});

// ---------- 5. paused days ----------

describe("5. paused days are 'Not tracking'", () => {
  it("are neither success nor failure, and show as Not tracking", () => {
    const d = data({ cleanDays: [met(A, "2026-03-10")], settings: { pauses: { [A]: [{ from: "2026-03-11", to: null }] } } });
    const s = trackSummary(d, A, T0);
    expect([s.today, s.paused, s.current, s.missed, s.quiet, s.slips]).toEqual(["paused", true, 1, 9, 0, 0]);
    expect(dayControls(d, A, "2026-03-15", T0)).toMatchObject({ notTracking: true, paused: true, canRest: false });
  });
  it("pausing and resuming never creates, removes or changes a record", () => {
    load({ entries: [slip(A, addDays(t(), -10))], cleanDays: [met(A, addDays(t(), -9))], urges: [urge(A, addDays(t(), -8))] });
    const before = getData();
    actions.pauseTrack(A, addDays(t(), -9));
    actions.resumeTrack(A, addDays(t(), -2));
    const after = getData();
    expect([after.entries, after.cleanDays, after.urges]).toEqual([before.entries, before.cleanDays, before.urges]);
    expect(dayStatus(after, A, addDays(t(), -9), t())).toBe("met");
  });
  it("don't age, heal or count as missed for the pet, even with the missed-day rule switched on", () => {
    const d = data({ bornOn: "2026-02-01", settings: { pauses: { [A]: [{ from: "2026-02-05", to: "2026-03-15" }] } } });
    const inputs = petDayInputs(d, `c-${A}`, T0, T0, "2026-02-01");
    const paused = inputs.filter((x) => x.day >= "2026-02-05" && x.day < "2026-03-15");
    expect(paused.every((x) => !x.missed && !x.clean && x.damage.length === 0)).toBe(true);
    const states = simulate(inputs, CONTINUITY);
    expect(states.filter((s) => s.day >= "2026-02-05" && s.day < "2026-03-15").every((s) => s.damageMonths === 0 && s.neglectMonths === 0)).toBe(true);
  });
});

// ---------- 6. dates, midnight and time zones ----------

describe("6. one local-day framework", () => {
  const tz = process.env.TZ;
  afterEach(() => { vi.useRealTimers(); process.env.TZ = tz; });

  it("a record made at 23:59:59 belongs to that day; one at 00:00:01 to the next", () => {
    process.env.TZ = "America/New_York";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 20, 23, 59, 59));
    actions.applyRemote(data({ bornOn: "2026-03-01" }));
    actions.recordUrge(A, 3, "rode_it_out");
    expect(today()).toBe("2026-03-20");
    vi.setSystemTime(new Date(2026, 2, 21, 0, 0, 1));
    actions.recordUrge(A, 3, "rode_it_out");
    expect(today()).toBe("2026-03-21");
    expect(getData().urges.map((u) => u.day)).toEqual(["2026-03-20", "2026-03-21"]);
    expect(trackSummary(getData(), A, today()).current).toBe(2);
  });
  it("the day rolls over at local midnight on a daylight-saving night", () => {
    process.env.TZ = "America/New_York";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 1, 23, 59, 59)); // Nov 1, a 25-hour day
    expect(today()).toBe("2026-11-01");
    vi.setSystemTime(new Date(2026, 10, 2, 0, 0, 0));
    expect(today()).toBe("2026-11-02");
  });
  it("records keep the day they were made on when the phone's time zone changes", () => {
    process.env.TZ = "Asia/Kolkata";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 20, 6, 0, 0)); // 06:00 in India is still Mar 19 in Los Angeles
    actions.applyRemote(data({ bornOn: "2026-03-01" }));
    actions.logSlip(A, {});
    actions.recordUrge(B, 3, "rode_it_out");
    process.env.TZ = "America/Los_Angeles";
    expect(today()).toBe("2026-03-19");
    const d = getData();
    expect([d.entries[0].day, d.urges[0].day]).toEqual(["2026-03-20", "2026-03-20"]);
    // Seen from the new zone, the slip is simply dated tomorrow, so it isn't counted until that day arrives.
    expect(trackSummary(d, A, "2026-03-19").slips).toBe(0);
    expect(trackSummary(d, A, "2026-03-20").slips).toBe(1);
  });
  it("calendar cells, weekdays and month grids come from the day key alone", () => {
    process.env.TZ = "Pacific/Kiritimati";
    expect(weekdayOf("2026-03-20")).toBe(5); // Friday everywhere
    expect(monthGrid("2026-02")).toMatchObject({ lead: 6 });
    expect(monthGrid("2026-02").days).toHaveLength(28);
    expect(monthGrid("2024-02").days).toHaveLength(29);
    expect(monthGrid("2026-06").lead).toBe(0);
  });
  it("a slip's hour comes from its own time, or from when it was logged on that same local day", () => {
    process.env.TZ = "Asia/Kolkata";
    const at = new Date(2026, 2, 20, 21, 15).getTime();
    expect(slipHour(slip(A, "2026-03-20", { createdAt: at }))).toBe(21);
    expect(slipHour(slip(A, "2026-03-19", { createdAt: at }))).toBeNull();
    expect(slipHour(slip(A, "2026-03-19", { time: "07:30", createdAt: at }))).toBe(7);
  });
});

// ---------- 7. the pet ----------

describe("7. only a track's own events affect its pet", () => {
  it("one track's slips and goal-met days don't touch the other pet's age, stage or history", () => {
    load({ entries: days(addDays(t(), -20), 10).map((x) => slip(A, x, { months: 6 })), cleanDays: days(addDays(t(), -20), 10).map((x) => met(B, x)) });
    const [a, b] = [viewCompanion(getData(), `c-${A}`), viewCompanion(getData(), `c-${B}`)];
    expect(a.age).toBeGreaterThan(0);
    expect(b.age).toBe(0);
    expect(b.states.every((s) => s.damageMonths === 0)).toBe(true);
    expect(history(getData(), b).some((h) => h.kind === "slip")).toBe(false);
  });
  it("after a same-day adoption, the new pet's history doesn't show the earlier pet's slips", () => {
    load();
    actions.logSlip(A, {});
    const old = getData().companions.find((c) => c.id === `c-${A}`)!;
    actions.applyRemote({ ...getData(), companions: getData().companions.map((c) => (c.id === old.id ? { ...c, diedOn: t(), finalAge: 100 } : c)) });
    actions.adopt(A, "Pip", "cat");
    const fresh = viewCompanion(getData(), getData().habits.find((h) => h.id === A)!.companionId);
    expect(fresh.companion.id).not.toBe(old.id);
    expect(history(getData(), fresh).filter((h) => h.kind === "slip")).toEqual([]);
  });
  it("a pet that has passed away keeps the healing from its own track's goal-met days", () => {
    const d = data({ bornOn: "2026-03-01", entries: [slip(A, "2026-03-02", { months: 6 })], cleanDays: days("2026-03-03", 5).map((x) => met(A, x)) });
    const passed = { ...d, companions: [...d.companions.map((c) => (c.id === `c-${A}` ? { ...c, diedOn: "2026-03-10", finalAge: 40 } : c)), { id: "c-new", species: "cat" as const, name: "Pip", bornOn: "2026-03-10", diedOn: null, finalAge: null }],
      habits: d.habits.map((h) => (h.id === A ? { ...h, companionId: "c-new" } : h)) };
    const inputs = petDayInputs(passed, `c-${A}`, T0, T0);
    expect(inputs.at(-1)!.day).toBe("2026-03-10");
    expect(inputs.filter((x) => x.clean)).toHaveLength(5);
  });
});

// ---------- 8. one shared calculation layer ----------

describe("8. shared rules for screens", () => {
  it("days checked in count any record (slip, goal met, any urge) and never a future one", () => {
    const d = data({ entries: [slip(A, "2026-03-16")], cleanDays: [met(A, "2026-03-17")], urges: [urge(A, "2026-03-18", "slipped"), urge(A, "2026-03-18"), urge(A, "2026-03-25")] });
    expect(checkIns(trackIndex(d, A, T0), "2026-03-16", "2026-03-22")).toEqual({ checkedIn: 3, possible: 5, missed: 1 });
  });
  it("'Not tracking' can only be chosen on a day with nothing recorded and no pause, and can be undone", () => {
    const d = data({
      entries: [slip(A, "2026-03-15")], cleanDays: [met(A, "2026-03-16")], urges: [urge(A, "2026-03-17"), urge(A, "2026-03-18", "slipped")],
      settings: { trackRest: { [A]: ["2026-03-19"] }, pauses: { [A]: [{ from: "2026-03-12", to: "2026-03-14" }] } },
    });
    const can = (day: string) => dayControls(d, A, day, T0).canRest;
    expect(["2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-12", "2026-03-20", "2026-03-21", "2026-02-27"].map(can))
      .toEqual([false, false, false, true, true, false, true, false, false]);
    expect(dayControls(d, A, "2026-03-19", T0)).toMatchObject({ resting: true, notTracking: true, status: "rest" });
  });
  it("the store refuses a rest day over a managed urge, just as the calendar does", () => {
    load({ urges: [urge(A, addDays(t(), -1))] });
    expect(actions.setRest(A, addDays(t(), -1), true)).toBe(false);
  });
  it("money and pace count only days with a known outcome", () => {
    load({ entries: [slip(A, addDays(t(), -3))], cleanDays: [met(A, addDays(t(), -2))], urges: [urge(A, addDays(t(), -1))] });
    expect(checkedInDays(getData(), A, addDays(t(), -10)).sort()).toEqual([addDays(t(), -3), addDays(t(), -2)]);
  });
});

// ---------- 9. missed-day damage ----------

describe("9. missed-day damage stays off", () => {
  it("is switched off, so a long silence costs the pet nothing", () => {
    expect(QUIET_DAYS_AGE).toBe(false);
    load({ entries: [slip(A, addDays(t(), -40), { months: 0 })] });
    expect(viewCompanion(getData(), `c-${A}`).states.every((s) => s.neglectMonths === 0)).toBe(true);
  });
  it("if switched back on, only a missed check-in counts: never rest, paused, recorded days or today", () => {
    const d = data({ bornOn: "2026-03-10", urges: [urge(A, "2026-03-12", "slipped")], settings: { trackRest: { [A]: ["2026-03-13"] }, pauses: { [A]: [{ from: "2026-03-14", to: "2026-03-16" }] } } });
    const missed = petDayInputs(d, `c-${A}`, T0, T0, "2026-03-10").filter((x) => x.missed).map((x) => x.day);
    expect(missed).toEqual(["2026-03-10", "2026-03-11", "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19"]);
    expect(petDayInputs(d, `c-${A}`, T0, T0, "2026-03-17").filter((x) => x.missed)).toHaveLength(3);
  });
});

// ---------- 10. edge cases ----------

describe("10. edge cases", () => {
  it("same-day repeats: several slips, urges or duplicate goal-met marks count once as a day", () => {
    const d = data({ entries: [slip(A, "2026-03-19"), slip(A, "2026-03-19"), slip(A, "2026-03-19")], cleanDays: [met(A, "2026-03-18"), met(A, "2026-03-18")], urges: [urge(A, "2026-03-17"), urge(A, "2026-03-17")] });
    expect(trackSummary(d, A, T0)).toMatchObject({ slips: 3, slipDays: 1, metDays: 1, managedUrges: 2, care: 2, best: 2, current: 0 });
  });
  it("empty history: a track with nothing recorded, and a track id that doesn't exist", () => {
    const d = data({ bornOn: T0 });
    expect(trackSummary(d, A, T0)).toMatchObject({ current: 0, best: 0, care: 0, slips: 0, missed: 0, quiet: 0, checkInRate: 0, daysTracked: 1, lastRecorded: null });
    expect(trackSummary(blank(), "nope", T0)).toMatchObject({ start: T0, current: 0, care: 0, today: "unrecorded" });
    expect(dayControls(blank(), "nope", T0, T0)).toMatchObject({ inLife: false, canLogSlip: false, canMarkMet: false, canRest: false });
  });
  it("missing dates: a gap of weeks is unknown, not a failure", () => {
    const d = data({ bornOn: "2026-01-01", cleanDays: [met(A, "2026-01-02"), met(A, "2026-03-19")] });
    expect(trackSummary(d, A, T0)).toMatchObject({ current: 2, slips: 0, quiet: 0 });
    expect(trackSummary(d, A, "2026-03-25")).toMatchObject({ current: 2, quiet: 5 });
  });
  it("a track whose pet has passed away keeps every number, but takes no new slips", () => {
    const d = data({ entries: [slip(A, "2026-03-05")], cleanDays: days("2026-03-06", 5).map((x) => met(A, x)) });
    const passed = { ...d, companions: d.companions.map((c) => (c.id === `c-${A}` ? { ...c, diedOn: "2026-03-12", finalAge: 30 } : c)) };
    expect(trackSummary(passed, A, T0)).toMatchObject(trackSummary(d, A, T0));
    expect(dayControls(passed, A, "2026-03-15", T0).canLogSlip).toBe(false);
  });
  it("a removed track takes its rows with it and leaves the other track exactly as it was", () => {
    const d = data({ entries: [slip(A, "2026-03-10")], cleanDays: days("2026-03-10", 5).map((x) => met(B, x)) });
    const before = trackSummary(d, B, T0);
    const removed = normalize(JSON.parse(JSON.stringify({ ...d, habits: d.habits.filter((h) => h.id !== A), companions: d.companions.filter((c) => c.id !== `c-${A}`) })))!;
    expect(removed.entries).toHaveLength(0);
    expect(trackSummary(removed, B, T0)).toEqual(before);
  });
  it("migration: data saved before per-track settings loads with the old shared rest days and celebrations intact", () => {
    const old = rawV1({ cleanDays: [met(A, "2026-03-18")], settings: { restDays: ["2026-03-19"], celebrated: [3] } });
    const loaded = normalize(JSON.parse(JSON.stringify(old)))!;
    // The shared rest day becomes each track's own; the one milestone list belonged to the first track.
    expect([trackState(loaded, A).restDays, trackState(loaded, B).restDays]).toEqual([["2026-03-19"], ["2026-03-19"]]);
    expect([dayStatus(loaded, A, "2026-03-19", T0), dayStatus(loaded, B, "2026-03-19", T0)]).toEqual(["rest", "rest"]);
    expect([trackState(loaded, A).celebrated, trackState(loaded, B).celebrated]).toEqual([[3], []]);
    expect(["restDays", "celebrated", "trackRest", "pauses", "celebratedBy"].filter((k) => k in loaded.settings)).toEqual([]);
  });
});
