import type { AppData, Pause } from "./types";

/**
 * The one place recovery numbers are worked out: day states, streaks, days of care, milestones, recovery months
 * and elapsed time, for one track (habit) at a time. Pure: no React, no storage, and "today" is always passed in.
 * Home, Calendar, Insights, the weekly review and milestones all read from here. The rules are in
 * docs/RECOVERY_RULES.md; the short version:
 * - Everything is derived from the records each time, so editing or deleting a record corrects every number.
 * - A day with nothing recorded is unknown. It never counts as progress, never as a slip, and never ends a streak.
 * - Only a slip ends the current streak, and a slip never takes away days of care, the best streak or milestones.
 */

// ---------- calendar arithmetic on YYYY-MM-DD day keys ----------
// Day keys are the local calendar day a record was made on. Arithmetic runs on UTC day numbers, so a
// daylight-saving change can't add or lose a day, and nothing ever assumes a month has 30 days.

const MS_PER_DAY = 86_400_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Days since 1970-01-01 for a day key. */
export const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
};
export const fromDayNumber = (n: number) => {
  const t = new Date(n * MS_PER_DAY);
  return `${String(t.getUTCFullYear()).padStart(4, "0")}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
};
export const shiftDays = (day: string, n: number) => fromDayNumber(dayNumber(day) + n);
/** Calendar days from a to b: 0 for the same day, 1 for the next day. */
export const daysFrom = (a: string, b: string) => dayNumber(b) - dayNumber(a);

/** A real calendar day in YYYY-MM-DD form (no 2025-02-29, no 2025-13-01). */
export function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** Days in month m (1-12) of year y: 28 to 31. */
export const daysInMonth = (y: number, m: number) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** Monday of the week containing day. Weeks run Monday to Sunday. */
export const mondayOf = (day: string) => { const n = dayNumber(day); return fromDayNumber(n - (((n + 3) % 7) + 7) % 7); };

/** The calendar month a day falls in, as YYYY-MM. */
export const monthOf = (day: string) => day.slice(0, 7);
/** Every day of a calendar month (YYYY-MM), 28 to 31 of them. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: daysInMonth(y, m) }, (_, i) => `${month}-${pad2(i + 1)}`);
}
/** The calendar month n months after (or before) a YYYY-MM month. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${pad2((((total % 12) + 12) % 12) + 1)}`;
}

/** The local calendar day of an instant in a time zone (the phone's own when none is given). */
export function localDay(at: Date | number, timeZone?: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The n-th monthly anniversary of a start day: the same day of the month, n calendar months on, moved back to the
 * month's last day when that month is shorter. Jan 31 gives Feb 28 (29 in a leap year), then Mar 31.
 * A Feb 29 start has its yearly anniversary on Feb 28 in other years.
 */
export function monthAnniversary(start: string, n: number): string {
  const d = Number(start.slice(8, 10));
  const [Y, M] = shiftMonth(monthOf(start), n).split("-").map(Number);
  return `${String(Y).padStart(4, "0")}-${pad2(M)}-${pad2(Math.min(d, daysInMonth(Y, M)))}`;
}

/** Whole calendar months completed from start to day (0 before the first anniversary or when day < start). */
export function monthsBetween(start: string, day: string): number {
  if (day < start) return 0;
  let n = (Number(day.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(day.slice(5, 7)) - Number(start.slice(5, 7)));
  if (monthAnniversary(start, n) > day) n--;
  return Math.max(0, n);
}

/** Elapsed time from start to day as calendar years, months and days, plus the plain day count. */
export interface Elapsed { years: number; months: number; days: number; totalDays: number }
export function elapsed(start: string, day: string): Elapsed {
  if (day < start) return { years: 0, months: 0, days: 0, totalDays: 0 };
  const n = monthsBetween(start, day);
  return { years: Math.floor(n / 12), months: n % 12, days: daysFrom(monthAnniversary(start, n), day), totalDays: daysFrom(start, day) };
}

/** If day is a monthly recovery anniversary of start, which one (1, 2, ... 12 is a year). Otherwise null. */
export function anniversaryOn(start: string, day: string): number | null {
  const n = monthsBetween(start, day);
  return n >= 1 && monthAnniversary(start, n) === day ? n : null;
}

/** The next monthly anniversary on or after day (today counts), never the start itself. */
export function nextAnniversary(start: string, day: string): { months: number; day: string; inDays: number } {
  let n = Math.max(1, monthsBetween(start, day));
  if (monthAnniversary(start, n) < day) n++;
  const on = monthAnniversary(start, n);
  return { months: n, day: on, inDays: daysFrom(day, on) };
}

// ---------- one track's records ----------

/**
 * What one day was, for one track. Precedence, highest first: future, before the track started, a slip,
 * goal met, an urge managed, paused, not tracking (rest), and finally unrecorded. Records always win over
 * a pause or a rest day: something that was logged is never hidden.
 */
export type DayStatus = "future" | "before" | "lapse" | "met" | "urge" | "paused" | "rest" | "unrecorded";
/** Statuses of days that have happened since the track started. */
export type PastStatus = Exclude<DayStatus, "future" | "before">;

export interface TrackIndex {
  habitId: string;
  /** The day this track started: its companion's birth or its first record, whichever is earlier. */
  start: string;
  today: string;
  slips: Map<string, number>;
  met: Set<string>;
  managed: Map<string, number>;
  rest: Set<string>;
  pauses: Pause[];
}

const cache = new WeakMap<AppData, Map<string, TrackIndex>>();

/** Indexes one track's records once per data snapshot, so per-day lookups are cheap. */
export function trackIndex(d: AppData, habitId: string, today: string): TrackIndex {
  const key = `${habitId}|${today}`;
  let byKey = cache.get(d);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const slips = new Map<string, number>(), managed = new Map<string, number>(), met = new Set<string>();
  const habit = d.habits.find((h) => h.id === habitId);
  let start = d.companions.find((c) => c.id === habit?.companionId)?.bornOn ?? today;
  for (const e of d.entries) if (e.habitId === habitId) { slips.set(e.day, (slips.get(e.day) ?? 0) + 1); if (e.day < start) start = e.day; }
  for (const c of d.cleanDays) if (c.habitId === habitId) { met.add(c.day); if (c.day < start) start = c.day; }
  for (const u of d.urges) if (u.habitId === habitId) {
    if (u.outcome === "rode_it_out") managed.set(u.day, (managed.get(u.day) ?? 0) + 1);
    if (u.day < start) start = u.day;
  }
  const rest = new Set([...d.settings.restDays, ...(d.settings.trackRest?.[habitId] ?? [])]);
  const idx: TrackIndex = { habitId, start, today, slips, met, managed, rest, pauses: d.settings.pauses?.[habitId] ?? [] };
  if (!byKey) { byKey = new Map(); cache.set(d, byKey); }
  byKey.set(key, idx);
  return idx;
}

/** Whether a track is paused on a day. A pause runs from `from` up to, not including, `to` (open while to is null). */
export const pausedOn = (pauses: Pause[], day: string) => pauses.some((p) => p.from <= day && (p.to === null || day < p.to));

export function statusOf(idx: TrackIndex, day: string): DayStatus {
  if (day > idx.today) return "future";
  if (day < idx.start) return "before";
  if (idx.slips.has(day)) return "lapse";
  if (idx.met.has(day)) return "met";
  if (idx.managed.has(day)) return "urge";
  if (pausedOn(idx.pauses, day)) return "paused";
  if (idx.rest.has(day)) return "rest";
  return "unrecorded";
}

export const dayStatus = (d: AppData, habitId: string, day: string, today: string) => statusOf(trackIndex(d, habitId, today), day);

const emptyCounts = (): Record<PastStatus, number> => ({ lapse: 0, met: 0, urge: 0, paused: 0, rest: 0, unrecorded: 0 });

/** How many days of each kind between from and to (inclusive), only counting days since the start and up to today. */
export function countDays(idx: TrackIndex, from: string, to: string): Record<PastStatus, number> {
  const counts = emptyCounts();
  const a = Math.max(dayNumber(from), dayNumber(idx.start)), b = Math.min(dayNumber(to), dayNumber(idx.today));
  for (let n = a; n <= b; n++) counts[statusOf(idx, fromDayNumber(n)) as PastStatus]++;
  return counts;
}

/**
 * Streaks. Goal-met and urge-managed days add one. Only a slip ends a streak. Unrecorded, rest and paused days are
 * skipped: they neither add to a streak nor break it, because missing data is not a failure.
 */
export function streaks(idx: TrackIndex): { current: number; best: number; lastSlip: string | null } {
  let run = 0, best = 0, lastSlip: string | null = null;
  const a = dayNumber(idx.start), b = dayNumber(idx.today);
  for (let n = a; n <= b; n++) {
    const s = statusOf(idx, fromDayNumber(n));
    if (s === "lapse") { run = 0; lastSlip = fromDayNumber(n); } else if (s === "met" || s === "urge") best = Math.max(best, ++run);
  }
  return { current: run, best, lastSlip };
}

/**
 * Days of care: days with the goal met (and no slip), plus days with an urge managed, up to today. An urge managed
 * still counts on a day that later had a slip: it was still a skill used. Only grows; a slip never takes it away.
 */
export function careDayCount(idx: TrackIndex): number {
  const days = new Set<string>();
  for (const day of idx.met) if (!idx.slips.has(day) && day <= idx.today) days.add(day);
  for (const day of idx.managed.keys()) if (day <= idx.today) days.add(day);
  return days.size;
}

/** Consecutive unrecorded days ending yesterday. Today isn't over yet, so it is never "missed". */
export function quietDays(idx: TrackIndex): number {
  let n = 0;
  for (let day = shiftDays(idx.today, -1); day >= idx.start && statusOf(idx, day) === "unrecorded"; day = shiftDays(day, -1)) n++;
  return n;
}

/** The last day anything was recorded (a slip, goal met or an urge managed), or null. */
export function lastRecorded(idx: TrackIndex): string | null {
  const days = [...idx.slips.keys(), ...idx.met, ...idx.managed.keys()].filter((x) => x <= idx.today);
  return days.length ? days.sort()[days.length - 1] : null;
}

// ---------- milestones ----------

/** Where days of care stand against the milestones: reached ones, the next one, and progress toward it. */
export function milestoneProgress(care: number, milestones: readonly number[]) {
  const reached = milestones.filter((m) => m <= care);
  const next = milestones.find((m) => m > care) ?? null;
  const prev = reached[reached.length - 1] ?? 0;
  return { reached, next, prev, toGo: next === null ? 0 : next - care, pct: next === null ? 100 : ((care - prev) / (next - prev)) * 100 };
}

/**
 * The milestone to celebrate at this many days of care: the highest one reached and not yet celebrated, so a
 * person who already has many days sees one celebration, not a backlog. Lower ones are marked as seen with it.
 * A correction that lowers days of care never takes a celebration back, and the same milestone never fires twice.
 */
export function milestoneToCelebrate(care: number, celebrated: number[], milestones: readonly number[]): { hit: number; seen: number[] } | null {
  const { reached } = milestoneProgress(care, milestones);
  const hit = reached[reached.length - 1];
  if (hit === undefined || celebrated.includes(hit)) return null;
  return { hit, seen: [...new Set([...celebrated, ...reached])].sort((a, b) => a - b) };
}

/** Milestones already celebrated for a track. The single list from before tracks were separate belongs to the first. */
export function celebratedFor(d: AppData, habitId: string): number[] {
  return d.settings.celebratedBy?.[habitId] ?? (d.habits[0]?.id === habitId ? d.settings.celebrated : []);
}

// ---------- everything for one track ----------

export interface TrackSummary {
  start: string;
  today: DayStatus;
  paused: boolean;
  resting: boolean;
  current: number;
  best: number;
  care: number;
  /** Goal-met days without a slip. */
  metDays: number;
  managedUrges: number;
  slips: number;
  slipDays: number;
  lastSlip: string | null;
  /** Calendar days since the last slip, or null if there has never been one. */
  sinceSlip: number | null;
  /** Calendar days since the track started, counting the start day as day 1. */
  daysTracked: number;
  /** Time since the track started, in calendar years, months and days. */
  tracked: Elapsed;
  nextAnniversary: { months: number; day: string; inDays: number };
  /** Recorded days out of days that could have been recorded (rest and paused days left out), 0-100. Null before any. */
  checkInRate: number | null;
  /** Past days with nothing recorded, not counting rest or paused days. Unknown, never a failure. */
  missed: number;
  quiet: number;
  lastRecorded: string | null;
}

export function trackSummary(d: AppData, habitId: string, today: string): TrackSummary {
  const idx = trackIndex(d, habitId, today);
  const s = streaks(idx);
  const counts = countDays(idx, idx.start, today);
  const yesterday = countDays(idx, idx.start, shiftDays(today, -1));
  const recorded = counts.lapse + counts.met + counts.urge;
  const possible = recorded + counts.unrecorded;
  const status = statusOf(idx, today);
  return {
    start: idx.start, today: status, paused: pausedOn(idx.pauses, today), resting: idx.rest.has(today),
    current: s.current, best: s.best, care: careDayCount(idx),
    metDays: [...idx.met].filter((x) => !idx.slips.has(x) && x <= today).length,
    managedUrges: [...idx.managed].filter(([x]) => x <= today).reduce((a, [, n]) => a + n, 0),
    slips: [...idx.slips].filter(([x]) => x <= today).reduce((a, [, n]) => a + n, 0),
    slipDays: [...idx.slips.keys()].filter((x) => x <= today).length,
    lastSlip: s.lastSlip, sinceSlip: s.lastSlip ? daysFrom(s.lastSlip, today) : null,
    daysTracked: Math.max(1, daysFrom(idx.start, today) + 1), tracked: elapsed(idx.start, today), nextAnniversary: nextAnniversary(idx.start, today),
    checkInRate: possible ? Math.round((recorded / possible) * 100) : null,
    missed: yesterday.unrecorded, quiet: quietDays(idx), lastRecorded: lastRecorded(idx),
  };
}

// ---------- pausing a track ----------

/**
 * Starts a pause on `from`. A pause that is already open stays as it is, and one that ended on `from` is reopened.
 * A pause can't start inside or before an earlier one: past pauses are history and are never rewritten.
 */
export function withPause(pauses: Pause[], from: string): Pause[] {
  if (pauses.some((p) => p.to === null)) return pauses;
  const joined = pauses.find((p) => p.to === from);
  if (joined) return pauses.map((p) => (p === joined ? { ...p, to: null } : p));
  if (pauses.some((p) => p.to !== null && from < p.to)) return pauses;
  return [...pauses, { from, to: null }];
}

/** Ends the open pause on `on` (the first day tracked again). A pause ended on the day it began is dropped. */
export function withResume(pauses: Pause[], on: string): Pause[] {
  return pauses.flatMap((p) => (p.to !== null ? [p] : on <= p.from ? [] : [{ ...p, to: on }]));
}
