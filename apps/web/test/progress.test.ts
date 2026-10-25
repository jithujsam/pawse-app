import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anniversaryOn, celebratedFor, countDays, daysFrom, daysInMonth, daysOfMonth, elapsed, isDay, isLeapYear, localDay, milestoneProgress,
  milestoneToCelebrate, mondayOf, monthAnniversary, monthsBetween, nextAnniversary, shiftDays, shiftMonth, statusOf, streaks, trackIndex,
  trackSummary, withPause, withResume,
} from "../src/progress";
import { addDays, daysBetween, range, weekStart } from "../src/dates";
import { actions, getData, viewCompanion } from "../src/store";
import { blank, normalize } from "../src/persist";
import { buildFields } from "../src/questions";
import type { AppData, CleanDay, Entry, Pause, Urge } from "../src/types";

const fields = buildFields({ what: "Orders", measure: "money", cls: "food_spending", triggers: [] });
const A = "habit-a", B = "habit-b";
const T0 = "2026-03-20";

const slip = (habitId: string, day: string, id = `${habitId}-${day}-${Math.random()}`): Entry => ({
  id, habitId, companionId: `c-${habitId}`, day, time: null, values: {}, amount: null, months: 2, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 0,
});
const met = (habitId: string, day: string): CleanDay => ({ habitId, day });
const urge = (habitId: string, day: string, outcome: Urge["outcome"] = "rode_it_out"): Urge => ({ id: `u-${habitId}-${day}-${outcome}-${Math.random()}`, habitId, day, time: "20:00", strength: 3, outcome, createdAt: 0 });

function data(p: { entries?: Entry[]; cleanDays?: CleanDay[]; urges?: Urge[]; bornOn?: string; settings?: Partial<AppData["settings"]> } = {}): AppData {
  const d = blank();
  const bornOn = p.bornOn ?? "2026-03-01";
  return {
    ...d,
    settings: { ...d.settings, onboarded: true, ...p.settings },
    companions: [A, B].map((h) => ({ id: `c-${h}`, species: "dog" as const, name: "Biscuit", bornOn, diedOn: null, finalAge: null })),
    habits: [A, B].map((h) => ({ id: h, name: h, cls: "food_spending" as const, classWeight: 0.7, companionId: `c-${h}`, unit: "money" as const, fields })),
    entries: p.entries ?? [], cleanDays: p.cleanDays ?? [], urges: p.urges ?? [],
  };
}
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => shiftDays(from, i));

// ---------- calendar ----------

describe("calendar arithmetic", () => {
  it("knows leap years, including the century rules", () => {
    expect([1900, 2000, 2024, 2025, 2100].map(isLeapYear)).toEqual([false, true, true, false, false]);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => daysInMonth(2026, m))).toEqual([31, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });
  it("only accepts real calendar days", () => {
    expect(["2024-02-29", "2026-12-31", "2026-04-30"].map(isDay)).toEqual([true, true, true]);
    expect(["2025-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-01", ""].map(isDay)).toEqual([false, false, false, false, false, false]);
  });
  it("moves across month ends, leap days and year boundaries", () => {
    expect(shiftDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(daysFrom("2024-01-01", "2025-01-01")).toBe(366);
    expect(daysFrom("2025-01-01", "2026-01-01")).toBe(365);
    expect(daysFrom("2026-03-20", "2026-03-20")).toBe(0);
  });
  it("lists every day of a calendar month, never assuming 30", () => {
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2024-02")).toHaveLength(29);
    expect(daysOfMonth("2026-04")).toHaveLength(30);
    expect(daysOfMonth("2026-01")).toHaveLength(31);
    expect(daysOfMonth("2026-02").at(-1)).toBe("2026-02-28");
  });
  it("shifts calendar months across years both ways", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-03", -15)).toBe("2024-12");
  });
  it("starts weeks on Monday, across a year boundary", () => {
    expect(mondayOf("2026-03-22")).toBe("2026-03-16"); // Sunday
    expect(mondayOf("2026-03-16")).toBe("2026-03-16"); // Monday
    expect(mondayOf("2026-01-01")).toBe("2025-12-29"); // Thursday
    expect(mondayOf("1970-01-01")).toBe("1969-12-29");
  });
});

describe("recovery months and anniversaries", () => {
  it("keeps the day of the month, moved to the month end when the month is shorter", () => {
    expect([1, 2, 3, 4].map((n) => monthAnniversary("2026-01-31", n))).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
    expect(monthAnniversary("2024-01-31", 1)).toBe("2024-02-29");
    expect(monthAnniversary("2026-03-17", 10)).toBe("2027-01-17");
  });
  it("puts a Feb 29 start's yearly anniversary on Feb 28, and back on Feb 29 in leap years", () => {
    expect(monthAnniversary("2024-02-29", 12)).toBe("2025-02-28");
    expect(monthAnniversary("2024-02-29", 48)).toBe("2028-02-29");
    expect(anniversaryOn("2024-02-29", "2025-02-28")).toBe(12);
    expect(anniversaryOn("2024-02-29", "2025-03-01")).toBeNull();
  });
  it("counts whole recovery months only once the anniversary arrives", () => {
    expect(monthsBetween("2026-01-31", "2026-02-27")).toBe(0);
    expect(monthsBetween("2026-01-31", "2026-02-28")).toBe(1);
    expect(monthsBetween("2026-01-31", "2026-03-30")).toBe(1);
    expect(monthsBetween("2026-01-31", "2026-03-31")).toBe(2);
    expect(monthsBetween("2026-03-20", "2026-03-01")).toBe(0);
  });
  it("keeps calendar months, recovery months and elapsed days distinct", () => {
    // One recovery month in February is 28 days; in March it is 31. Neither is "30 days".
    expect(elapsed("2026-02-15", "2026-03-15")).toEqual({ years: 0, months: 1, days: 0, totalDays: 28 });
    expect(elapsed("2026-03-15", "2026-04-15")).toEqual({ years: 0, months: 1, days: 0, totalDays: 31 });
    expect(elapsed("2026-03-15", "2026-04-14")).toEqual({ years: 0, months: 0, days: 30, totalDays: 30 });
    // Mid-month start: March holds 15 of its days, and the first recovery month ends in April.
    expect(daysOfMonth("2026-03").filter((d) => d >= "2026-03-17")).toHaveLength(15);
    expect(elapsed("2024-02-29", "2025-02-28")).toEqual({ years: 1, months: 0, days: 0, totalDays: 365 });
    expect(elapsed("2024-02-29", "2025-03-01")).toEqual({ years: 1, months: 0, days: 1, totalDays: 366 });
    expect(elapsed("2025-12-31", "2027-01-01")).toEqual({ years: 1, months: 0, days: 1, totalDays: 366 });
    expect(elapsed("2026-03-20", "2026-03-19")).toEqual({ years: 0, months: 0, days: 0, totalDays: 0 });
  });
  it("finds the next anniversary, counting today and never the start", () => {
    expect(nextAnniversary("2026-03-20", "2026-03-20")).toEqual({ months: 1, day: "2026-04-20", inDays: 31 });
    expect(nextAnniversary("2026-01-31", "2026-02-28")).toEqual({ months: 1, day: "2026-02-28", inDays: 0 });
    expect(nextAnniversary("2026-01-31", "2026-03-01")).toEqual({ months: 2, day: "2026-03-31", inDays: 30 });
    expect(anniversaryOn("2026-03-20", "2026-03-20")).toBeNull();
  });
});

describe("time zones and daylight saving", () => {
  const tz = process.env.TZ;
  beforeAll(() => { process.env.TZ = "America/New_York"; });
  afterAll(() => { process.env.TZ = tz; });
  it("a DST change never adds or loses a day in the app's own date helpers", () => {
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09"); // spring forward
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // fall back
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(daysBetween("2026-10-25", "2026-11-08")).toBe(14);
    expect(range("2026-03-07", "2026-03-10")).toEqual(["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
  });
  it("a streak runs straight through both DST changes", () => {
    const d = data({ bornOn: "2026-03-01", cleanDays: [...days("2026-03-06", 5), ...days("2026-10-30", 5)].map((x) => met(A, x)) });
    expect(streaks(trackIndex(d, A, "2026-03-10")).current).toBe(5);
    expect(streaks(trackIndex(d, A, "2026-11-03")).current).toBe(10);
  });
  it("gives the local calendar day of an instant in any zone", () => {
    const at = Date.UTC(2026, 2, 20, 3, 30); // 03:30 UTC on Mar 20
    expect(localDay(at, "UTC")).toBe("2026-03-20");
    expect(localDay(at, "America/Los_Angeles")).toBe("2026-03-19");
    expect(localDay(at, "Asia/Kolkata")).toBe("2026-03-20");
    expect(localDay(Date.UTC(2026, 2, 20, 11, 0), "Pacific/Kiritimati")).toBe("2026-03-21");
    // 1:30 AM happens twice when the clocks go back; both are Nov 1.
    expect(localDay(Date.UTC(2026, 10, 1, 5, 30), "America/New_York")).toBe("2026-11-01");
    expect(localDay(Date.UTC(2026, 10, 1, 6, 30), "America/New_York")).toBe("2026-11-01");
  });
});

// ---------- day states ----------

describe("day states", () => {
  it("follow one precedence: slip, goal met, urge managed, paused, rest, unrecorded", () => {
    const d = data({
      entries: [slip(A, "2026-03-10")], cleanDays: [met(A, "2026-03-10"), met(A, "2026-03-11")],
      urges: [urge(A, "2026-03-11"), urge(A, "2026-03-12"), urge(A, "2026-03-13", "slipped")],
      settings: { trackRest: { [A]: ["2026-03-14", "2026-03-15"] }, pauses: { [A]: [{ from: "2026-03-15", to: "2026-03-17" }] } },
    });
    const idx = trackIndex(d, A, T0);
    const s = (day: string) => statusOf(idx, day);
    expect(["2026-02-28", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15", "2026-03-16", "2026-03-17", "2026-03-21"].map(s))
      .toEqual(["before", "lapse", "met", "urge", "unrecorded", "rest", "paused", "paused", "unrecorded", "future"]);
  });
  it("show what was recorded during a pause or on a rest day: records are never hidden", () => {
    const d = data({ entries: [slip(A, "2026-03-15")], cleanDays: [met(A, "2026-03-16")], settings: { pauses: { [A]: [{ from: "2026-03-14", to: null }] }, restDays: ["2026-03-16"] } });
    const idx = trackIndex(d, A, T0);
    expect([statusOf(idx, "2026-03-15"), statusOf(idx, "2026-03-16"), statusOf(idx, "2026-03-17")]).toEqual(["lapse", "met", "paused"]);
  });
  it("start on the earlier of the companion's birth and the first record", () => {
    const d = data({ bornOn: "2026-03-10", entries: [slip(A, "2026-02-20")] });
    expect(trackIndex(d, A, T0).start).toBe("2026-02-20");
    expect(trackIndex(d, B, T0).start).toBe("2026-03-10");
  });
  it("count days only between the start and today", () => {
    const d = data({ bornOn: "2026-03-17", cleanDays: [met(A, "2026-03-18")] });
    expect(countDays(trackIndex(d, A, T0), "2026-03-01", "2026-03-31")).toEqual({ lapse: 0, met: 1, urge: 0, paused: 0, rest: 0, unrecorded: 3 });
  });
});

// ---------- streaks and progress ----------

describe("streaks", () => {
  const st = (d: AppData, t0 = T0) => streaks(trackIndex(d, A, t0));
  it("only a slip ends a streak: unrecorded, rest and paused days are skipped, not failures", () => {
    const d = data({
      cleanDays: ["2026-03-10", "2026-03-12", "2026-03-15", "2026-03-18"].map((x) => met(A, x)),
      settings: { trackRest: { [A]: ["2026-03-13"] }, pauses: { [A]: [{ from: "2026-03-16", to: "2026-03-18" }] } },
    });
    expect(st(d).current).toBe(4);
  });
  it("counts urge-managed days, but not an urge on a day that had a slip", () => {
    const d = data({ cleanDays: [met(A, "2026-03-17")], urges: [urge(A, "2026-03-18"), urge(A, "2026-03-19"), urge(A, "2026-03-19")] });
    expect(st(d).current).toBe(3);
    const withSlip = data({ entries: [slip(A, "2026-03-19")], urges: [urge(A, "2026-03-19")] });
    expect(st(withSlip)).toEqual({ current: 0, best: 0, lastSlip: "2026-03-19", runStart: null });
  });
  it("a slip resets the current streak but never the best streak", () => {
    const d = data({ cleanDays: ["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-14"].map((x) => met(A, x)), entries: [slip(A, "2026-03-13")] });
    expect(st(d)).toEqual({ current: 1, best: 3, lastSlip: "2026-03-13", runStart: "2026-03-14" });
  });
  it("today not yet checked in keeps yesterday's streak; a slip today ends it", () => {
    const d = data({ cleanDays: [met(A, "2026-03-18"), met(A, "2026-03-19")] });
    expect(st(d).current).toBe(2);
    expect(st({ ...d, entries: [slip(A, T0)] }).current).toBe(0);
  });
  it("runs across a year boundary and a leap day", () => {
    const d = data({ bornOn: "2023-12-01", cleanDays: [...days("2023-12-30", 4), ...days("2024-02-27", 4)].map((x) => met(A, x)) });
    expect(st(d, "2024-01-02").current).toBe(4);
    expect(st(d, "2024-03-01").current).toBe(8);
  });
  it("handles a long history (more than ten years) without a cap", () => {
    const d = data({ bornOn: "2015-01-01", cleanDays: days("2015-01-01", 4100).map((x) => met(A, x)) });
    const end = shiftDays("2015-01-01", 4099);
    expect(st(d, end)).toEqual({ current: 4100, best: 4100, lastSlip: null, runStart: "2015-01-01" });
  });
});

describe("track summary", () => {
  it("never treats missing data as failure: a quiet track has no slips, nothing lost, and check-in rate is just unknown days", () => {
    const s = trackSummary(data({ bornOn: "2026-03-11" }), A, T0);
    expect(s).toMatchObject({ current: 0, best: 0, care: 0, slips: 0, lastSlip: null, sinceSlip: null, missed: 9, quiet: 9, checkInRate: 0, daysTracked: 10, today: "unrecorded" });
  });
  it("after a setback, keeps days of care, best streak and milestones, and counts days since the slip", () => {
    const before = data({ cleanDays: days("2026-03-01", 14).map((x) => met(A, x)) });
    const after = { ...before, entries: [slip(A, "2026-03-16")] };
    const [a, b] = [trackSummary(before, A, T0), trackSummary(after, A, T0)];
    expect(b.care).toBe(a.care);
    expect(b.best).toBe(14);
    expect(b.current).toBe(0);
    expect(b.sinceSlip).toBe(4);
    expect(milestoneProgress(b.care, [3, 7, 14, 30]).reached).toEqual([3, 7, 14]);
  });
  it("leaves rest and paused days out of the check-in rate and out of missed check-ins", () => {
    const d = data({ bornOn: "2026-03-11", cleanDays: [met(A, "2026-03-11"), met(A, "2026-03-12")],
      settings: { trackRest: { [A]: ["2026-03-13"] }, pauses: { [A]: [{ from: "2026-03-14", to: "2026-03-19" }] } } });
    const s = trackSummary(d, A, T0);
    // Recorded: 11, 12. Unrecorded: 19 (yesterday) and 20 (today, not over yet but still a day that could be recorded).
    expect(s.checkInRate).toBe(50);
    expect(s.missed).toBe(1);
    expect(s.quiet).toBe(1);
  });
  it("reports elapsed time and the next recovery anniversary from the track's start", () => {
    const s = trackSummary(data({ bornOn: "2026-01-31" }), A, "2026-03-20");
    expect(s.tracked).toEqual({ years: 0, months: 1, days: 20, totalDays: 48 });
    expect(s.nextAnniversary).toEqual({ months: 2, day: "2026-03-31", inDays: 11 });
    expect(s.daysTracked).toBe(49);
  });
  it("ignores records dated after today", () => {
    const s = trackSummary(data({ cleanDays: [met(A, "2026-03-25")], entries: [slip(A, "2026-03-26")] }), A, T0);
    expect([s.care, s.slips, s.metDays, s.lastRecorded]).toEqual([0, 0, 0, null]);
  });
});

describe("corrections to past entries", () => {
  it("are reflected everywhere at once, because every number is derived from the records", () => {
    const d = data({ cleanDays: days("2026-03-10", 10).map((x) => met(A, x)) });
    expect(trackSummary(d, A, T0).current).toBe(10);
    const backdated = { ...d, entries: [slip(A, "2026-03-14")] };
    expect(trackSummary(backdated, A, T0)).toMatchObject({ current: 5, best: 5, care: 9, metDays: 9 });
    expect(trackSummary({ ...backdated, entries: [] }, A, T0)).toMatchObject({ current: 10, best: 10, care: 10 });
  });
  it("filling in a forgotten day joins two runs, since an unrecorded gap never broke them", () => {
    const d = data({ cleanDays: [met(A, "2026-03-17"), met(A, "2026-03-19")] });
    expect(trackSummary(d, A, T0).current).toBe(2);
    expect(trackSummary({ ...d, cleanDays: [...d.cleanDays, met(A, "2026-03-18")] }, A, T0).current).toBe(3);
  });
  it("never takes back a celebrated milestone, and never fires it twice", () => {
    expect(milestoneToCelebrate(2, [3], [3, 7])).toBeNull();
    expect(milestoneToCelebrate(3, [3], [3, 7])).toBeNull();
    expect(milestoneToCelebrate(7, [3], [3, 7])).toEqual({ hit: 7, seen: [3, 7] });
  });
});

describe("each track on its own", () => {
  it("a slip, rest day or pause on one track changes nothing on another", () => {
    const d = data({
      cleanDays: [...days("2026-03-15", 5).map((x) => met(A, x)), ...days("2026-03-15", 5).map((x) => met(B, x))],
      entries: [slip(A, "2026-03-19")],
      settings: { trackRest: { [A]: ["2026-03-20"] }, pauses: { [A]: [{ from: "2026-03-10", to: "2026-03-12" }] } },
    });
    const [a, b] = [trackSummary(d, A, T0), trackSummary(d, B, T0)];
    expect([a.current, a.today, a.slips]).toEqual([0, "rest", 1]);
    expect([b.current, b.today, b.slips]).toEqual([5, "unrecorded", 0]);
    expect(statusOf(trackIndex(d, B, T0), "2026-03-11")).toBe("unrecorded");
  });
  it("rest days from before tracks were separate apply to every track", () => {
    const d = data({ settings: { restDays: ["2026-03-19"] } });
    expect([statusOf(trackIndex(d, A, T0), "2026-03-19"), statusOf(trackIndex(d, B, T0), "2026-03-19")]).toEqual(["rest", "rest"]);
  });
  it("milestones celebrated before tracks were separate belong to the first track only", () => {
    const d = data({ settings: { celebrated: [3, 7] } });
    expect([celebratedFor(d, A), celebratedFor(d, B)]).toEqual([[3, 7], []]);
    const split = data({ settings: { celebrated: [3, 7], celebratedBy: { [A]: [3], [B]: [3, 7, 14] } } });
    expect([celebratedFor(split, A), celebratedFor(split, B)]).toEqual([[3], [3, 7, 14]]);
  });
});

describe("pausing and resuming", () => {
  it("opens a pause, resumes it, and keeps past pauses as history", () => {
    let p: Pause[] = withPause([], "2026-03-01");
    expect(p).toEqual([{ from: "2026-03-01", to: null }]);
    expect(withPause(p, "2026-03-05")).toBe(p); // already paused
    p = withResume(p, "2026-03-04");
    expect(p).toEqual([{ from: "2026-03-01", to: "2026-03-04" }]);
    expect(withPause(p, "2026-03-02")).toBe(p); // can't rewrite a past pause
    expect(withPause(p, "2026-03-04")).toEqual([{ from: "2026-03-01", to: null }]); // pausing again the day it resumed rejoins it
    expect(withPause(p, "2026-03-10")).toEqual([{ from: "2026-03-01", to: "2026-03-04" }, { from: "2026-03-10", to: null }]);
  });
  it("drops a pause resumed on the day it started", () => {
    expect(withResume([{ from: "2026-03-10", to: null }], "2026-03-10")).toEqual([]);
  });
});

// ---------- the store, on real actions ----------

describe("store actions on two tracks", () => {
  const t0 = new Date();
  const today = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, "0")}-${String(t0.getDate()).padStart(2, "0")}`;
  const load = (settings: Partial<AppData["settings"]> = {}) => actions.applyRemote(data({ bornOn: addDays(today, -30), settings }));
  it("rest days are per track, and clearing a shared old one keeps it on the other track", () => {
    load({ restDays: [addDays(today, -1)] });
    expect(actions.setRest(A, today, true)).toBe(true);
    expect(getData().settings.trackRest?.[A]).toEqual([today]);
    expect(statusOf(trackIndex(getData(), B, today), today)).toBe("unrecorded");
    actions.setRest(A, addDays(today, -1), false);
    expect(getData().settings.restDays).toEqual([]);
    expect(statusOf(trackIndex(getData(), A, today), addDays(today, -1))).toBe("unrecorded");
    expect(statusOf(trackIndex(getData(), B, today), addDays(today, -1))).toBe("rest");
  });
  it("pausing one track leaves the other running", () => {
    load();
    actions.pauseTrack(A, addDays(today, -3));
    expect(trackSummary(getData(), A, today).paused).toBe(true);
    expect(trackSummary(getData(), B, today).paused).toBe(false);
    actions.resumeTrack(A, today);
    expect(getData().settings.pauses?.[A]).toEqual([{ from: addDays(today, -3), to: today }]);
    expect(statusOf(trackIndex(getData(), A, today), addDays(today, -1))).toBe("paused");
    expect(statusOf(trackIndex(getData(), A, today), today)).toBe("unrecorded");
  });
  it("a slip over a goal-met day keeps the mark as history, and the companion isn't healed that day", () => {
    load();
    const day = addDays(today, -2);
    actions.markClean(A, day);
    const d = actions.logSlip(A, {}, day);
    expect(getData().cleanDays.some((c) => c.habitId === A && c.day === day)).toBe(true);
    expect(viewCompanion(getData(), `c-${A}`).states.find((s) => s.day === day)!.healedMonths).toBe(0);
    actions.deleteEntry(d.entry.id);
    expect(statusOf(trackIndex(getData(), A, today), day)).toBe("met");
  });
  it("celebrations are kept per track and reset per track", () => {
    load({ celebrated: [3] });
    actions.setCelebrated(B, [3, 7]);
    expect([celebratedFor(getData(), A), celebratedFor(getData(), B)]).toEqual([[3], [3, 7]]);
    actions.resetCelebrations(A);
    expect([celebratedFor(getData(), A), celebratedFor(getData(), B)]).toEqual([[], [3, 7]]);
  });
  it("per-track settings survive saving and loading", () => {
    const d = data({ settings: { trackRest: { [A]: ["2026-03-01"] }, pauses: { [A]: [{ from: "2026-03-02", to: null }] }, celebratedBy: { [B]: [3] } } });
    const back = normalize(JSON.parse(JSON.stringify(d)))!;
    expect([back.settings.trackRest, back.settings.pauses, back.settings.celebratedBy]).toEqual([{ [A]: ["2026-03-01"] }, { [A]: [{ from: "2026-03-02", to: null }] }, { [B]: [3] }]);
  });
});
