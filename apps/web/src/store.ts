import { useMemo, useSyncExternalStore } from "react";
import {
  baselineMonths, cleanDaysToAge, cleanDaysToUndo, computeSeverity, floorAge, healthAgeFromMonths, healthRules, simulate, STAGE_LABEL, stageForAge,
  type DayInput, type DayState, type HabitClass, type Stage,
} from "@detox/engine";
import { addDays, iso, today, weekStart } from "./dates";
import { dayStatus, EDIT_DAYS, outcomeDays, petDayInputs, quietDays, shiftDays, streaks, trackIndex, withPause, withResume } from "./progress";
import { effectsFor, EFFECT_LABEL, slipLine } from "./copy";
import { weightFor } from "./templates";
import { countTriggers, OTHER_PREFIX, pickedLabels, starterFields, type Intake } from "./questions";
import { concernIn, concernInAny, type Concern } from "./guard";
import { NAMES } from "./pets";
import { money } from "./format";
import { kv, idbAvailable } from "./db";
import { withTimeout } from "./net";
import { blank, migrateIds, normalize, normalizeWithReport, uuid } from "./persist";
import { canRecord, defaultTrackState, firstEventDay, focusedTrackId, trackState } from "./tracks";
import { newKey, open as vaultOpen, seal, type Sealed, type VaultKey } from "./vault";
import { localCurrency } from "./region";
import type { AppData, Baseline, Companion, Entry, Habit, Measure, Personality, RecoveryPlan, Species, StrategyId, Tone, TrackState, Urge } from "./types";

const LEGACY_KEY = "detox-companion/v1";
/** Where ai.ts keeps AI results on this phone; cleared with everything else on a reset. */
export const AI_CACHE_KEY = "companion/ai-cache/v1";
const uid = uuid;

let data: AppData = blank();
const listeners = new Set<() => void>();
/** local: a change made on this phone, synced up. remote: rows from the account. reset: this phone's copy was wiped; never synced as deletions. */
export type CommitSource = "local" | "remote" | "reset";
const hooks = new Set<(prev: AppData, next: AppData, source: CommitSource) => void>();
/** Lets sync see exactly which rows changed in each commit. */
export const onCommit = (fn: (prev: AppData, next: AppData, source: CommitSource) => void) => { hooks.add(fn); return () => { hooks.delete(fn); }; };

/** Recording a day from before the pet was born (the calendar allows the last few days) moves the birth back to that day, so the record sits inside the pet's life. */
function bornBy(d: AppData, companionId: string, day: string): AppData {
  return d.companions.some((c) => c.id === companionId && day < c.bornOn)
    ? { ...d, companions: d.companions.map((c) => (c.id === companionId && day < c.bornOn ? { ...c, bornOn: day } : c)) }
    : d;
}

function commit(next: AppData, source: CommitSource = "local") {
  const prev = data;
  data = { ...next, updatedAt: Date.now() };
  listeners.forEach((l) => l());
  hooks.forEach((h) => h(prev, data, source));
  schedulePersist();
}

// ---------- persistence: IndexedDB, encrypted when a PIN is set ----------

let vaultKey: VaultKey | null = null;
/**
 * True only once `data` holds what was actually loaded: after a normal boot, after a successful unlock, or after an
 * explicit erase. While the vault is locked (or a boot read failed), `data` is a blank placeholder. Writing it would
 * overwrite the encrypted vault with an empty object, so flush() does nothing until this is true.
 */
let writable = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
let writing: Promise<void> = Promise.resolve();

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { void flush(); }, 250);
}
/** Writes now. Called on a timer after each change and when the app goes to the background. */
export function flush(): Promise<void> {
  clearTimeout(persistTimer);
  const snapshot = data;
  writing = writing.then(async () => {
    if (!writable) return;
    try {
      if (!idbAvailable()) { localStorage.setItem(LEGACY_KEY, JSON.stringify(snapshot)); return; }
      // The pet's species alone stays readable, so the lock screen wears the person's accent colour.
      const pet = activeCompanion(snapshot)?.species;
      if (pet) await kv.set("pet", pet);
      if (vaultKey) { await kv.set("data.enc", await seal(vaultKey, snapshot)); await kv.del("data"); }
      else { await kv.set("data", snapshot); await kv.del("data.enc"); }
    } catch { /* storage full or unavailable: the in-memory copy still works */ }
  });
  return writing;
}

export type Boot = { kind: "ready" } | { kind: "locked"; sealed: Sealed };

/** Loads saved data before the first render. Returns "locked" when a PIN protects it. */
export async function boot(): Promise<Boot> {
  if (!idbAvailable()) {
    try { data = migrateIds(normalize(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null")) ?? blank()); } catch { data = blank(); }
    writable = true;
    return { kind: "ready" };
  }
  writable = false;
  try {
    const sealed = await kv.get<Sealed>("data.enc");
    if (sealed) {
      const pet = await kv.get<string>("pet");
      if (pet) document.documentElement.dataset.pet = pet;
      return { kind: "locked", sealed };
    }
    let raw = await kv.get<unknown>("data");
    let legacy = false;
    if (raw === undefined) { const s = localStorage.getItem(LEGACY_KEY); if (s) { raw = JSON.parse(s); legacy = true; } }
    const result = raw === undefined ? null : normalizeWithReport(raw);
    const loaded = result?.data ?? null;
    // Never lose data silently: anything this version can't read (damaged, or from a newer version), or had to
    // leave rows out of, is kept as it was before the cleaned copy is saved over it.
    if (raw !== undefined && (!result || result.report.invalid + result.report.orphaned > 0)) await kv.set(`data.unreadable.${Date.now()}`, raw);
    // Saved before tracks: keep the old copy once, so the move to tracks can be undone by hand.
    const v1 = loaded !== null && (raw as { v?: unknown }).v === 1;
    if (v1 && (await kv.get("data.v1-backup")) === undefined) await kv.set("data.v1-backup", raw);
    data = migrateIds(loaded ?? blank());
    if (data.settings.onboarded && !data.settings.neglectFrom) data = { ...data, settings: { ...data.settings, neglectFrom: today() } };
    writable = true;
    if (legacy || v1 || (loaded && loaded !== data)) { await flush(); if (legacy) localStorage.removeItem(LEGACY_KEY); }
  } catch { data = blank(); writable = false; }
  return { kind: "ready" };
}

/** Decrypts with the PIN. False when it's wrong. */
export async function unlockWith(pin: string, sealed: Sealed): Promise<boolean> {
  const r = await vaultOpen(pin, sealed);
  if (!r) return false;
  vaultKey = r.k;
  const result = normalizeWithReport(r.value);
  // As in boot, but the kept copy stays encrypted: it is the sealed blob, not the opened data.
  if (!result || result.report.invalid + result.report.orphaned > 0) await kv.set(`data.enc.unreadable.${Date.now()}`, sealed).catch(() => undefined);
  data = migrateIds(result?.data ?? blank());
  if (data.settings.onboarded && !data.settings.neglectFrom) data = { ...data, settings: { ...data.settings, neglectFrom: today() } };
  writable = true;
  listeners.forEach((l) => l());
  return true;
}

const pinWatchers = new Set<() => void>();
/** Called when app lock is turned on or off, e.g. so the home screen widget hides or shows today's status. */
export const onPinChange = (fn: () => void) => { pinWatchers.add(fn); return () => { pinWatchers.delete(fn); }; };

export const vault = {
  hasPin: () => vaultKey !== null,
  async setPin(pin: string) { if (!writable) return; vaultKey = await newKey(pin); await flush(); await kv.set("pinLength", pin.length).catch(() => undefined); pinWatchers.forEach((w) => w()); },
  async removePin() { if (!writable) return; vaultKey = null; await flush(); await kv.del("pinLength").catch(() => undefined); pinWatchers.forEach((w) => w()); },
  pinLength: async () => (await kv.get<number>("pinLength").catch(() => undefined)) ?? 4,
  /** Re-checks the current PIN without changing anything. */
  async check(pin: string) { const s = await kv.get<Sealed>("data.enc"); return s ? (await vaultOpen(pin, s)) !== null : false; },
};

export const useData = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => data);
export const getData = () => data;

// ---------- derived ----------

export interface CompanionView {
  companion: Companion;
  habit: Habit | undefined;
  states: DayState[];
  current: DayState | undefined;
  age: number;
  stage: ReturnType<typeof stageForAge>;
  dead: boolean;
}

/**
 * Whether a day with nothing logged costs the companion life (the PRD 5.3 v3 "loneliness" rule). Off: a missing
 * check-in is missing data, not proof of a slip, so quiet days neither hurt nor heal. The engine still supports the
 * rule; flipping this back on restores it without touching any stored data. See docs/PAWSE_OVERNIGHT_LOG.md.
 */
export const QUIET_DAYS_AGE = false;

/** The health bar has no permanent scars, so a heavy day leaves no lasting mark and its copy stays off. */
export const SCARS_ON = false;

export function viewCompanion(d: AppData, companionId: string, upTo = today(), opts: { ignoreNoDeath?: boolean } = {}): CompanionView {
  const companion = d.companions.find((c) => c.id === companionId)!;
  const habit = d.habits.find((h) => h.companionId === companionId);
  // Missed check-ins never cost life unless the quiet-days rule is switched back on, and even then rest and
  // paused days, days with any record, today and days after a death are never "missed". petDayInputs counts only
  // this companion's slips on its own track, so a slip filed under another track can never age it.
  const inputs: DayInput[] = petDayInputs(d, companionId, upTo, today(), QUIET_DAYS_AGE ? d.settings.neglectFrom : null);
  // The health bar runs on a 30-month budget (20 clean days). Continuity (the default): the companion can't die.
  // Classic: fully red is death. A companion that already died stays as it was.
  const continuity = d.settings.petLife !== "classic" && !companion.diedOn && !opts.ignoreNoDeath;
  const states = simulate(inputs, healthRules(!continuity));
  const current = states[states.length - 1];
  const age = companion.finalAge ?? current?.visibleAge ?? 0;
  return { companion, habit, states, current, age, stage: stageForAge(age), dead: companion.diedOn !== null };
}

/**
 * Classic rules (death, scars) can be switched on only while that wouldn't mean the companion had already died:
 * under continuity, damage past the ceiling was never counted, but the classic rules would count it. False when
 * switching them on now would end any track's companion's life on the spot.
 */
export function canAllowPassingAway(d: AppData): boolean {
  // The pet rules are the person's, so they apply to every track's current companion, not only the one on screen.
  const living = d.habits.map((h) => d.companions.find((c) => c.id === h.companionId)).filter((c): c is Companion => !!c && !c.diedOn);
  return living.every((c) => !viewCompanion(d, c.id, today(), { ignoreNoDeath: true }).states.some((s) => s.stage === "dead"));
}

/** The focused track's current companion (see focusedTrackId). With one track, habits[0]'s. */
export const activeCompanion = (d: AppData): Companion | undefined => {
  const id = focusedTrackId(d);
  const habit = id ? d.habits.find((h) => h.id === id) : undefined;
  return habit ? d.companions.find((c) => c.id === habit.companionId) : undefined;
};

/** The active companion's view, recomputed only when the data changes. */
export function useActiveView(): CompanionView | undefined {
  const d = useData();
  const day = today();
  return useMemo(() => { const c = activeCompanion(d); return c ? viewCompanion(d, c.id, day) : undefined; }, [d, day]);
}

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Good days (goal met or an urge managed) since the last slip. Unrecorded, rest and paused days don't break it. */
export const cleanStreak = (d: AppData, habitId: string, t0 = today()) => streaks(trackIndex(d, habitId, t0)).current;

/** The hour slips most often happen, once there's a clear pattern (at least 5 timed slips, 30% within an hour of the peak). */
export function riskyHour(d: AppData, habitId: string): number | null {
  const hours = d.entries.filter((e) => e.habitId === habitId).map(slipHour).filter((h): h is number => h !== null);
  if (hours.length < 5) return null;
  const count = Array.from({ length: 24 }, (_, h) => hours.filter((x) => Math.min(Math.abs(x - h), 24 - Math.abs(x - h)) <= 1).length);
  const peak = count.indexOf(Math.max(...count));
  return count[peak] / hours.length >= 0.3 ? peak : null;
}

/** What the notification plan needs (PlanInput without the clock and the last care event). */
export interface ReminderInputs {
  enabled: boolean; reminder: string; tone: Tone; name: string; personality?: Personality;
  checkedToday: boolean; lastCheckIn: string | null; riskHour: number | null; careNotes: boolean;
  /** Pets with days in the editable window that nothing is recorded for, in any active track. */
  catchup: { name: string; days: string[] }[];
}

/** Per living pet on an active track: the days of the last four that are still empty, so they can be filled in before they lock. */
function catchupDays(d: AppData, t0: string): { name: string; days: string[] }[] {
  const out: { name: string; days: string[] }[] = [];
  for (const h of d.habits) {
    const c = d.companions.find((x) => x.id === h.companionId);
    if (!c || c.diedOn || trackState(d, h.id).status !== "active") continue;
    const days = Array.from({ length: EDIT_DAYS + 1 }, (_, i) => shiftDays(t0, -i)).filter((x) => dayStatus(d, h.id, x, t0) === "unrecorded").sort();
    if (days.length) out.push({ name: c.name, days });
  }
  return out;
}

/**
 * The reminders for this phone: one plan, for the open track (approved D3). A paused or archived track sends
 * nothing, and the person's own reminder settings are never changed by a pause, so resuming brings back exactly
 * what they had chosen. Any record today (a slip, goal met or an urge) or a day not tracked means no reminder today.
 */
export function reminderInputs(d: AppData, t0 = today()): ReminderInputs {
  const { remindersOn, reminder, tone, riskNudge, careNotes } = d.settings;
  const id = focusedTrackId(d);
  const habit = id ? d.habits.find((h) => h.id === id) : undefined;
  const companion = habit && d.companions.find((c) => c.id === habit.companionId);
  const catchup = remindersOn ? catchupDays(d, t0) : [];
  if (!habit || !companion) return { enabled: false, reminder, tone, name: "", checkedToday: false, lastCheckIn: null, riskHour: null, careNotes: false, catchup };
  const idx = trackIndex(d, habit.id, t0);
  const lastCheckIn = [...idx.checkedIn].filter((x) => x <= t0).sort().pop() ?? idx.start;
  const status = trackState(d, habit.id).status;
  return {
    enabled: remindersOn && status === "active" && !companion.diedOn, reminder, tone, name: companion.name, personality: companion.personality,
    checkedToday: idx.checkedIn.has(t0) || idx.rest.has(t0), lastCheckIn, riskHour: riskNudge ? riskyHour(d, habit.id) : null, careNotes, catchup,
  };
}

/** The hour of a slip: the time given, or when it was logged if logged the same day. */
export function slipHour(e: Entry): number | null {
  if (e.time) return Number(e.time.slice(0, 2));
  const at = new Date(e.createdAt);
  return iso(at) === e.day ? at.getHours() : null;
}

/** Unrecorded days in a row up to yesterday. A rest or paused day, or anything recorded, ends the count. */
export const silentDays = (d: AppData, habitId: string, t0 = today()) => quietDays(trackIndex(d, habitId, t0));

/** Days from `from` to today with a known outcome (a slip or a goal-met mark). Days with nothing logged are unknown, not clean. */
export const checkedInDays = (d: AppData, habitId: string, from: string): string[] => outcomeDays(trackIndex(d, habitId, today()), from);

export const BASELINE_PER_WEEK: Record<Baseline, number> = { many_daily: 21, daily: 7, few_weekly: 3, weekly: 1 };

/**
 * Money kept against the starting pace, counted only over days the person checked in: a day with nothing
 * logged could have been a slip, so it never counts as money saved. Null without a baseline or any amounts.
 */
export function moneyKept(d: AppData, habitId: string, bornOn: string): { saved: number; days: number } | null {
  const baseline = trackState(d, habitId).baseline;
  // This life only: spending from earlier companions' lives isn't set against days counted since this one was born.
  const amounts = d.entries.filter((e) => e.habitId === habitId && e.day >= bornOn && e.amount !== null && e.amount > 0).map((e) => e.amount as number);
  const typical = median(amounts);
  if (!baseline || !typical) return null;
  const days = checkedInDays(d, habitId, bornOn).length;
  const expected = (BASELINE_PER_WEEK[baseline] * days / 7) * typical;
  return { saved: Math.max(0, Math.round(expected - amounts.reduce((a, b) => a + b, 0))), days };
}

/** Slips per checked-in week over the last `window` days; null until a day in that window is logged. */
export function recentPace(d: AppData, habitId: string, bornOn: string, window = 14): number | null {
  const from = [addDays(today(), -(window - 1)), bornOn].sort().pop()!;
  const days = checkedInDays(d, habitId, from).length;
  if (!days) return null;
  const slips = d.entries.filter((e) => e.habitId === habitId && e.day >= from && e.day <= today()).length;
  return (slips / days) * 7;
}

export const weekStats = (d: AppData, habitId: string, weekStartDay: string) => {
  const end = addDays(weekStartDay, 6);
  const es = d.entries.filter((e) => e.habitId === habitId && e.day >= weekStartDay && e.day <= end);
  return {
    slips: es.length,
    spend: es.reduce((a, e) => a + (e.amount ?? 0), 0),
    months: es.reduce((a, e) => a + e.months, 0),
    entries: es,
  };
};

// ---------- actions ----------

/** Replaces one track's state. Every per-track write goes through here. */
const withTrack = (d: AppData, habitId: string, fn: (s: TrackState) => TrackState): AppData =>
  ({ ...d, habits: d.habits.map((h) => (h.id === habitId ? { ...h, track: fn(trackState(d, habitId)) } : h)) });
const withoutRest = (d: AppData, habitId: string, day: string): AppData =>
  (trackState(d, habitId).restDays.includes(day) ? withTrack(d, habitId, (s) => ({ ...s, restDays: s.restDays.filter((x) => x !== day) })) : d);
/** The track an action without one applies to: the focused one. */
const focused = (habitId?: string) => habitId ?? focusedTrackId(data) ?? "";

export const emptyPlan = (): RecoveryPlan => ({ goal: null, reasons: [], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] });

// ---------- the last line of defence for typed text ----------
// The screens check what is typed as it is typed. These checks run again where it is saved, so no screen, edit flow,
// restored backup or synced row can put crisis language, or something that tracks food or weight, into the data.

/** A pet's name when none was given, fitting its species. */
export const defaultPetName = (species: Species): string => NAMES[species]?.[0] ?? "Biscuit";

const planTexts = (p: RecoveryPlan | null | undefined): string[] => (p ? [...p.reasons, ...p.situations, ...p.ifThen, p.firstStep, p.supportName] : []);
const fieldTexts = (fields: Habit["fields"]): string[] => fields.flatMap((f) => [f.label, ...(f.options ?? []).map((o) => o.label), ...(f.scaleLabels ?? [])]);

/** What a slip's answers need: notes are checked for crisis language, typed answers to questions for food and weight too. Photos are skipped. */
function valuesConcern(values: Entry["values"]): Concern | null {
  let found: Concern | null = null;
  for (const v of Object.values(values)) {
    if (typeof v !== "string" || !v || v.startsWith("data:")) continue;
    if (concernIn(v, "crisis")) return "crisis";
    for (const part of v.split(",")) if (part.startsWith(OTHER_PREFIX) && concernIn(part.slice(OTHER_PREFIX.length))) found = "restriction";
  }
  return found;
}

/** Drops anything that would track food or weight (or carries crisis text) from track definitions that arrive from outside: a backup file or another phone. */
/**
 * The additive restore rule. Rows the phone doesn't have yet are added. A row with the same key keeps this phone's
 * version: the same id for companions, habits, entries, urges and summaries; the same habit and day for clean days;
 * the same day for journal entries; the same week for a weekly summary. Settings stay as they are on a phone that
 * is already set up; a phone that isn't set up yet (new, or just erased) takes the backup's settings, so the
 * restore doesn't leave it stuck in onboarding. Nothing is deleted, so an import can't undo anything done since the
 * backup was made. Rows whose parent is missing are left out by normalize, as on any load.
 * Returns `local` itself when nothing would change.
 */
export function mergeAdditive(local: AppData, incoming: AppData): AppData {
  const add = <T,>(have: T[], more: T[], key: (x: T) => string): T[] => {
    const ids = new Set(have.map(key));
    return [...have, ...more.filter((x) => !ids.has(key(x)))];
  };
  const summaries: AppData["summaries"] = { ...local.summaries };
  for (const [habitId, weeks] of Object.entries(incoming.summaries)) summaries[habitId] = { ...weeks, ...(local.summaries[habitId] ?? {}) };
  const merged = normalize({
    ...local,
    settings: local.settings.onboarded ? local.settings : incoming.settings,
    companions: add(local.companions, incoming.companions, (c) => c.id),
    habits: add(local.habits, incoming.habits, (h) => h.id),
    entries: add(local.entries, incoming.entries, (e) => e.id).sort((a, b) => a.createdAt - b.createdAt),
    cleanDays: add(local.cleanDays, incoming.cleanDays, (c) => `${c.habitId}|${c.day}`),
    urges: add(local.urges, incoming.urges, (u) => u.id).sort((a, b) => a.createdAt - b.createdAt),
    journal: add(local.journal, incoming.journal, (j) => j.day),
    summaries,
  });
  if (!merged) return local;
  const same = JSON.stringify(merged) === JSON.stringify(local);
  return same ? local : merged;
}

export function scrubTracking(d: AppData): AppData {
  let changed = false;
  const habits = d.habits.map((h) => {
    const nameBad = concernIn(h.name) !== null;
    const fields = h.fields.filter((f) => concernInAny(fieldTexts([f])) === null);
    if (!nameBad && fields.length === h.fields.length) return h;
    changed = true;
    return { ...h, name: nameBad ? "My habit" : h.name, fields };
  });
  return changed ? { ...d, habits } : d;
}

function cleanPlan(p: RecoveryPlan): RecoveryPlan {
  const list = (xs: string[], n: number, len: number) => [...new Set(xs.map((x) => x.trim().slice(0, len)).filter(Boolean))].slice(0, n);
  return {
    goal: p.goal, reasons: list(p.reasons, 8, 80), situations: list(p.situations, 8, 60), firstStep: p.firstStep.trim().slice(0, 140),
    strategies: [...new Set(p.strategies)].slice(0, 7), supportName: p.supportName.trim().slice(0, 40), ifThen: list(p.ifThen, 8, 160),
  };
}

/** Everything deleteTrack removed, so it can be put back. */
export interface TrackBackup {
  habit: Habit; position: number; companions: Companion[]; entries: Entry[]; cleanDays: AppData["cleanDays"]; urges: Urge[]; summaries: Record<string, string>;
}

export interface Deduction {
  entry: Entry;
  line: string;
  effectLine: string;
  nthToday: number;
  weekSlips: number;
  died: boolean;
  /** Months the hidden reserve soaked up today; the companion didn't age by these. */
  absorbed: number;
  /** Today is now a binge day (3+ slips): part of it is a permanent scar. */
  binge: boolean;
  /** Clean days in a row before this slip. */
  streakBefore: number;
}

const STAGE_FLOOR: Partial<Record<Stage, Stage>> = { young: "baby", adult: "young", middle: "adult", old: "middle", frail: "old" };
const STAGE_MIN: Record<Stage, number> = { baby: 0, young: 10, adult: 30, middle: 50, old: 70, frail: 80, dead: 100 };

/** The way back: clean days to undo today's damage, to reach the previous stage, and life expectancy. */
export function recoveryPlan(v: CompanionView, day = today()): { undoToday: number; stageBack: { days: number; label: string } | null; lifeExpectancy: number } | null {
  const cur = v.current;
  if (!cur) return null;
  const todayState = v.states.find((s) => s.day === day);
  const prev = STAGE_FLOOR[cur.stage];
  const days = prev ? cleanDaysToAge(cur, STAGE_MIN[cur.stage] - 0.01) : null;
  return {
    undoToday: cleanDaysToUndo(todayState?.damageMonths ?? 0),
    stageBack: prev && days !== null && days > 0 ? { days, label: STAGE_LABEL[prev] } : null,
    lifeExpectancy: Math.round(100 - floorAge(cur)),
  };
}

export const actions = {
  setTone: (tone: Tone) => commit({ ...data, settings: { ...data.settings, tone } }),
  setSettings: (patch: Partial<AppData["settings"]>) => {
    const { userName, ...rest } = patch;
    const safeName = userName !== undefined && concernIn(userName) === null ? { userName } : {};
    commit({ ...data, settings: { ...data.settings, ...rest, ...safeName } });
  },

  finishOnboarding(o: { species: Species; coat?: string; personality?: Personality; companionName: string; userName?: string; intake: Intake; tone: Tone; reminder: string; baseline: Baseline | null; plan?: RecoveryPlan | null }): boolean {
    if (concernInAny([o.companionName, o.userName, o.intake.what, o.intake.amountLabel, ...o.intake.triggers, ...planTexts(o.plan)])) return false;
    const companionId = uid();
    const companion: Companion = { id: companionId, species: o.species, coat: o.coat, personality: o.personality, name: o.companionName.trim() || defaultPetName(o.species), bornOn: today(), diedOn: null, finalAge: null };
    const habitId = uid();
    const habit: Habit = {
      id: habitId, name: o.intake.what.trim().slice(0, 60) || "My habit", cls: o.intake.cls, classWeight: weightFor(o.intake.cls),
      companionId, unit: o.intake.measure, fields: starterFields(o.intake),
      track: { ...defaultTrackState(today(), Date.now()), baseline: o.baseline, plan: o.plan ? cleanPlan(o.plan) : null },
    };
    commit({
      ...data,
      settings: { ...data.settings, userName: (o.userName ?? "").trim().slice(0, 30), neglectFrom: today(), currency: localCurrency(data.settings.currency), tone: o.tone, reminder: o.reminder, onboarded: true, activeHabit: habitId },
      companions: [{ ...companion, trackId: habitId }], habits: [habit],
    });
    return true;
  },

  /**
   * Adds the AI's sentence and body-effect tags to an entry that was saved with the baseline. The months lost
   * never change: the AI has no say in any recovery number. Returns false if there is no such entry.
   */
  applyAi(entryId: string, r: { effects: string[]; explanation: string }): boolean {
    if (!data.entries.some((x) => x.id === entryId)) return false;
    commit({
      ...data,
      entries: data.entries.map((x) => (x.id === entryId ? { ...x, effects: r.effects, explanation: r.explanation, source: "ai" as const } : x)),
    });
    return true;
  },

  setSummary: (week: string, text: string, habitId?: string) => {
    const id = focused(habitId);
    if (data.habits.some((h) => h.id === id)) commit({ ...data, summaries: { ...data.summaries, [id]: { ...data.summaries[id], [week]: text } } });
  },

  /** Replace everything, used when an account's saved copy is newer than this phone's. */
  /** Applies rows that arrived from the account. Never marked as local changes, so they don't bounce back. */
  applyRemote(next: AppData) { commit(scrubTracking(next), "remote"); },

  /**
   * Restores a backup file. Everything in it is validated and v1 backups are migrated; returns false if it isn't a
   * backup this version can read (including one from a newer version). Rows it can't use are left out; the file
   * itself is untouched, so nothing in it is lost.
   */
  /**
   * Restores a backup additively (see mergeAdditive): rows this phone doesn't have are added, and nothing here is
   * replaced or deleted. False when the file isn't a backup of an onboarded person.
   */
  importJson(text: string): boolean {
    try {
      const incoming = normalize(JSON.parse(text));
      if (!incoming || !incoming.settings.onboarded) return false;
      const merged = mergeAdditive(data, migrateIds(scrubTracking(incoming)));
      if (merged !== data) commit(merged);
      return true;
    } catch { return false; }
  },

  /** Swaps a habit's questions for the current recommended set, keeping its class and unit. */
  refreshQuestions(habitId: string) {
    const h = data.habits.find((x) => x.id === habitId);
    if (!h) return;
    const amountLabel = h.fields.find((f) => f.amount)?.label;
    commit({ ...data, habits: data.habits.map((x) => (x.id === habitId ? { ...x, fields: starterFields({ what: trackState(data, x.id).description || x.name, measure: x.unit, amountLabel, cls: x.cls, triggers: [] }) } : x)) });
  },

  /** False when a question's wording or answers need the safety note: nothing is saved then. */
  updateHabitFields(habitId: string, fields: Habit["fields"]): boolean {
    if (concernInAny(fieldTexts(fields))) return false;
    commit({ ...data, habits: data.habits.map((h) => (h.id === habitId ? { ...h, fields } : h)) });
    return true;
  },

  /** Null when the track can't take a record: it is archived (read-only) or gone. A pause never refuses one. */
  logSlip(habitId: string, values: Entry["values"], day = today(), time: string | null = null): Deduction | null {
    if (!canRecord(data, habitId)) return null;
    if (valuesConcern(values)) return null; // the slip sheet shows the note before it ever gets here
    const habit = data.habits.find((h) => h.id === habitId)!;
    const base = bornBy(data, habit.companionId, day);
    const companion = base.companions.find((c) => c.id === habit.companionId)!;
    const amountField = habit.fields.find((f) => f.amount);
    const raw = amountField ? Number(values[amountField.id]) : NaN;
    const amount = Number.isFinite(raw) && amountField ? raw : null;
    const since = addDays(day, -30);
    const med = median(data.entries.filter((e) => e.habitId === habitId && e.amount !== null && e.day >= since && e.day < day).map((e) => e.amount as number));
    const hour = time ? Number(time.slice(0, 2)) : day === today() ? new Date().getHours() : null;
    const triggers = countTriggers(habit.fields, values, hour);
    const severity = computeSeverity({ amount: amount ?? undefined, median: med, classWeight: habit.classWeight, triggers });
    const nth = data.entries.filter((e) => e.habitId === habitId && e.day === day).length + 1;
    const months = baselineMonths(severity, nth);
    const before = viewCompanion(base, companion.id, day);
    const effects = effectsFor(habit.cls, Math.min(100, before.age + healthAgeFromMonths(months)));
    const tone = data.settings.tone;
    const streakBefore = cleanStreak(data, habitId);
    const entry: Entry = {
      id: uid(), habitId, companionId: companion.id, day, time, values, amount, months, severity, effects,
      explanation: slipLine(tone, companion.name, months, nth), source: "baseline", aiAdjustPct: null, createdAt: Date.now(),
    };
    // A goal-met mark on this day stays as history: the slip wins while it exists, and deleting the slip brings
    // the goal-met day back. Milestones count days of care, which a slip doesn't take away, so they aren't reset.
    let next: AppData = withoutRest({ ...base, entries: [...base.entries, entry] }, habitId, day);
    let died = false;
    const v = viewCompanion(next, companion.id);
    const deadState = v.states.find((s) => s.stage === "dead");
    if (deadState && !companion.diedOn) {
      died = true;
      next = { ...next, companions: next.companions.map((c) => (c.id === companion.id ? { ...c, diedOn: deadState.day, finalAge: 100 } : c)) };
    }
    commit(next);
    const ws = weekStats(next, habitId, weekStart(day));
    const st = v.states.find((s) => s.day === day);
    return {
      entry, line: entry.explanation, nthToday: nth, weekSlips: ws.slips, died,
      absorbed: st?.absorbedMonths ?? 0, binge: st?.binge ?? false, streakBefore,
      effectLine: effects.map((e) => EFFECT_LABEL[e]).filter(Boolean).slice(0, 2).join(" "),
    };
  },

  markClean(habitId: string, day = today()) {
    if (!canRecord(data, habitId)) return false;
    if (data.entries.some((e) => e.habitId === habitId && e.day === day)) return false;
    if (data.cleanDays.some((c) => c.habitId === habitId && c.day === day)) return true;
    const owner = data.habits.find((h) => h.id === habitId)!.companionId;
    commit(withoutRest({ ...bornBy(data, owner, day), cleanDays: [...data.cleanDays, { habitId, day }] }, habitId, day));
    return true;
  },

  /**
   * Marks a day as intentionally not tracked (or clears that). A day with a slip or marked as goal met
   * can't be a rest day: what was recorded wins. Rest days never count as progress or as a lapse.
   */
  setRest(habitId: string, day: string, on: boolean): boolean {
    if (!canRecord(data, habitId)) return false;
    if (on && (data.entries.some((e) => e.habitId === habitId && e.day === day) || data.cleanDays.some((c) => c.habitId === habitId && c.day === day)
      || data.urges.some((u) => u.habitId === habitId && u.day === day && u.outcome === "rode_it_out"))) return false;
    const base = on ? bornBy(data, data.habits.find((h) => h.id === habitId)!.companionId, day) : data;
    commit(withTrack(base, habitId, (s) => { const rest = s.restDays.filter((x) => x !== day); return { ...s, restDays: on ? [...rest, day].sort().slice(-4000) : rest }; }));
    return true;
  },

  /** Saves a track's plan (the focused one by default). Text is trimmed and capped; empty items are dropped. */
  savePlan(p: RecoveryPlan, habitId?: string): boolean {
    const id = focused(habitId);
    if (!data.habits.some((h) => h.id === id) || concernInAny(planTexts(p))) return false;
    commit(withTrack(data, id, (s) => ({ ...s, plan: cleanPlan(p) })));
    return true;
  },

  /** Adds one if-then plan (e.g. from a lapse reflection or weekly review) without duplicating it. */
  addIfThen(text: string, habitId?: string) {
    const t = text.trim().slice(0, 160);
    const id = focused(habitId);
    if (!t || concernIn(t) || !data.habits.some((h) => h.id === id)) return;
    const plan = trackState(data, id).plan ?? emptyPlan();
    if (plan.ifThen.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    commit(withTrack(data, id, (s) => ({ ...s, plan: { ...plan, ifThen: [...plan.ifThen, t].slice(-8) } })));
  },

  /**
   * Optional reflection after a lapse: what came before it and one small adjustment. Stored on the slip
   * itself, so it never changes the companion's age and goes with the slip if it is deleted.
   */
  reflectOnLapse(entryId: string, r: { before: string; adjust: string }) {
    const before = r.before.trim().slice(0, 160), adjust = r.adjust.trim().slice(0, 160);
    if (concernIn(before, "crisis") || concernIn(adjust)) return;
    commit({ ...data, entries: data.entries.map((e) => (e.id === entryId ? { ...e, values: { ...e.values, lapse_before: before, lapse_adjust: adjust } } : e)) });
  },

  /** The one adjustment picked for the week after a weekly review. */
  setWeekFocus(week: string, text: string, habitId?: string) {
    const t = text.trim().slice(0, 160);
    const id = focused(habitId);
    if (concernIn(t) || !data.habits.some((h) => h.id === id)) return;
    commit(withTrack(data, id, (s) => {
      const rest = s.weekFocus.filter((w) => w.week !== week);
      return { ...s, weekFocus: (t ? [...rest, { week, text: t }] : rest).sort((a, b) => a.week.localeCompare(b.week)).slice(-60) };
    }));
  },

  deleteEntry: (id: string) => commit({ ...data, entries: data.entries.filter((e) => e.id !== id) }),
  /** Puts back an entry removed by mistake (undo). Does nothing if an entry with that id is already here. */
  restoreEntry: (e: Entry) => { if (!data.entries.some((x) => x.id === e.id)) commit({ ...data, entries: [...data.entries, e].sort((a, b) => a.createdAt - b.createdAt) }); },
  unmarkClean: (habitId: string, day: string) => commit({ ...data, cleanDays: data.cleanDays.filter((c) => !(c.habitId === habitId && c.day === day)) }),
  /** Records which milestones a track has celebrated. */
  setCelebrated: (habitId: string, seen: number[]) => { if (data.habits.some((h) => h.id === habitId)) commit(withTrack(data, habitId, (s) => ({ ...s, celebrated: seen }))); },
  /** A new companion on a track celebrates its milestones afresh, once each. */
  resetCelebrations: (habitId?: string) => { const id = focused(habitId); if (trackState(data, id).celebrated.length) commit(withTrack(data, id, (s) => ({ ...s, celebrated: [] }))); },
  /** Per-track settings that need no checks of their own (what the pet wears, the savings goal, milestones seen...). */
  setTrackSettings(habitId: string, patch: Partial<Pick<TrackState, "wear" | "savingsGoal" | "celebrated" | "baseline" | "treatsGiven" | "fedOn">>) {
    if (patch.savingsGoal && concernIn(patch.savingsGoal.label)) return;
    if (data.habits.some((h) => h.id === habitId)) commit(withTrack(data, habitId, (s) => ({ ...s, ...patch })));
  },

  /** Records a craving and how it ended. Tracked only: the engine never sees it. */
  recordUrge(habitId: string, strength: number, outcome: Urge["outcome"], extra: { strategy?: StrategyId | null; trigger?: string | null } = {}): Urge | null {
    if (!canRecord(data, habitId)) return null;
    const now = new Date();
    const urge: Urge = {
      id: uid(), habitId, day: today(), time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      strength: Math.max(1, Math.min(5, Math.round(strength))), outcome, createdAt: Date.now(),
      strategy: extra.strategy ?? null, trigger: extra.trigger && !concernIn(extra.trigger) ? extra.trigger.trim().slice(0, 40) || null : null,
    };
    commit({ ...data, urges: [...data.urges, urge] });
    return urge;
  },
  /** Saves today's (or another day's) reflection; an empty one is removed. */
  setJournal(day: string, mood: number, body: string) {
    if (concernIn(body, "crisis")) return;
    const rest = data.journal.filter((j) => j.day !== day);
    const entry = { day, mood: Math.max(1, Math.min(5, Math.round(mood))), body: body.slice(0, 600) };
    commit({ ...data, journal: mood ? [...rest, entry].sort((a, b) => a.day.localeCompare(b.day)) : rest });
  },

  /** Switches the companion to another species, keeping its name, age and history. */
  setSpecies: (id: string, species: Species) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, species, coat: undefined } : c)) }),
  setCompanionLook: (id: string, patch: Pick<Companion, "coat" | "personality">) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),

  /** False when the name needs the safety note: the pet keeps its name then. */
  renameCompanion(id: string, name: string): boolean {
    if (concernIn(name)) return false;
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, name: name.trim().slice(0, 20) || c.name } : c)) });
    return true;
  },

  /**
   * Opens a recovery track on this phone. It is device-only UI state (settings.activeHabit): never synced and
   * never recovery data. Unknown ids are ignored.
   */
  selectTrack(habitId: string) {
    if (data.settings.activeHabit === habitId || !data.habits.some((h) => h.id === habitId)) return;
    commit({ ...data, settings: { ...data.settings, activeHabit: habitId } });
  },

  /**
   * A new recovery track from the Pets grid: its own habit and its own companion, born today, opened on this
   * phone. Returns its habit id, or null at the 50-track limit.
   */
  addTrack(o: { what: string; cls: HabitClass; measure: Measure; amountLabel?: string; species: Species; name: string; coat?: string; personality?: Personality }): string | null {
    return actions.createTrack({ name: o.what.trim() || "My habit", cls: o.cls, unit: o.measure, amountLabel: o.amountLabel, species: o.species, companionName: o.name, coat: o.coat, personality: o.personality, focus: true });
  },

  adopt(habitId: string, name: string, species: Species, personality?: Personality) {
    const habit = data.habits.find((h) => h.id === habitId)!;
    const companion: Companion = { id: uid(), species, personality, name: (concernIn(name) ? "" : name.trim()) || defaultPetName(species), bornOn: today(), diedOn: null, finalAge: null, trackId: habit.id };
    commit({
      ...data,
      companions: [...data.companions, companion],
      habits: data.habits.map((h) => (h.id === habit.id ? { ...h, companionId: companion.id } : h)),
    });
  },

  // ---------- tracks: create, edit, pause, archive, delete ----------

  /**
   * Starts a new track with its own companion. Returns its id, or null when the name is empty or the
   * 50-track limit is reached. Nothing about any other track changes.
   */
  createTrack(o: {
    name: string; description?: string; cls: HabitClass; unit: Measure; amountLabel?: string; triggers?: string[]; fields?: Habit["fields"];
    species: Species; companionName: string; coat?: string; personality?: Personality; baseline?: Baseline | null; plan?: RecoveryPlan | null; focus?: boolean;
  }): string | null {
    const name = o.name.trim().slice(0, 60);
    if (!name || data.habits.length >= 50) return null;
    if (concernInAny([o.name, o.description, o.amountLabel, o.companionName, ...(o.triggers ?? []), ...fieldTexts(o.fields ?? []), ...planTexts(o.plan)])) return null;
    const habitId = uid(), companionId = uid();
    const companion: Companion = { id: companionId, species: o.species, coat: o.coat, personality: o.personality, name: o.companionName.trim().slice(0, 20) || defaultPetName(o.species), bornOn: today(), diedOn: null, finalAge: null, trackId: habitId };
    const habit: Habit = {
      id: habitId, name, cls: o.cls, classWeight: weightFor(o.cls), companionId, unit: o.unit,
      fields: o.fields ?? starterFields({ what: name, measure: o.unit, amountLabel: o.amountLabel, cls: o.cls, triggers: o.triggers ?? [] }),
      track: { ...defaultTrackState(today(), Date.now()), description: (o.description ?? "").trim().slice(0, 280), baseline: o.baseline ?? null, plan: o.plan ? cleanPlan(o.plan) : null },
    };
    commit({
      ...data, companions: [...data.companions, companion], habits: [...data.habits, habit],
      settings: o.focus ? { ...data.settings, activeHabit: habitId } : data.settings,
    });
    return habitId;
  },

  /** Edits a track. A start date can't be in the future or after the track's first record. False if refused. */
  updateTrack(habitId: string, patch: { name?: string; description?: string; startedOn?: string; baseline?: Baseline | null; plan?: RecoveryPlan | null }): boolean {
    const h = data.habits.find((x) => x.id === habitId);
    if (!h) return false;
    if (concernInAny([patch.name, patch.description, ...planTexts(patch.plan)])) return false;
    const name = patch.name === undefined ? h.name : patch.name.trim().slice(0, 60);
    if (!name) return false;
    if (patch.startedOn !== undefined) {
      const first = firstEventDay(data, habitId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.startedOn) || patch.startedOn > today() || (first !== null && patch.startedOn > first)) return false;
    }
    const next = withTrack({ ...data, habits: data.habits.map((x) => (x.id === habitId ? { ...x, name } : x)) }, habitId, (s) => ({
      ...s,
      ...(patch.description !== undefined ? { description: patch.description.trim().slice(0, 280) } : {}),
      ...(patch.startedOn !== undefined ? { startedOn: patch.startedOn } : {}),
      ...(patch.baseline !== undefined ? { baseline: patch.baseline } : {}),
      ...(patch.plan !== undefined ? { plan: patch.plan ? cleanPlan(patch.plan) : null } : {}),
    }));
    commit(next);
    return true;
  },

  /**
   * Pauses a track from a day on (today by default), by the rules in docs/RECOVERY_RULES.md (withPause): paused
   * days count neither way, records still win and are never refused, and past pauses are never rewritten.
   * False if nothing changed (already paused, archived, unknown, or a start inside an earlier pause).
   */
  pauseTrack(habitId: string, from = today()): boolean {
    const s = trackState(data, habitId);
    if (!data.habits.some((h) => h.id === habitId) || s.status === "archived") return false;
    const pauses = withPause(s.pauses, from);
    if (pauses === s.pauses) return false;
    commit(withTrack(data, habitId, (x) => ({ ...x, status: "paused", pauses: pauses.slice(-500) })));
    return true;
  },

  /** Resumes a paused track: `on` (today by default) is the first day tracked again. A pause ended the day it began is dropped. */
  resumeTrack(habitId: string, on = today()): boolean {
    const s = trackState(data, habitId);
    if (s.status !== "paused" || !s.pauses.some((p) => p.to === null)) return false;
    commit(withTrack(data, habitId, (x) => ({ ...x, status: "active", pauses: withResume(x.pauses, on) })));
    return true;
  },

  /**
   * Archives a track: read-only, history and pet kept. Refused for the last track that isn't archived,
   * since the app always shows one pet.
   */
  archiveTrack(habitId: string): boolean {
    const s = trackState(data, habitId);
    if (!data.habits.some((h) => h.id === habitId) || s.status === "archived") return false;
    if (!data.habits.some((h) => h.id !== habitId && trackState(data, h.id).status !== "archived")) return false;
    const t = today();
    commit(withTrack(data, habitId, (x) => ({ ...x, status: "archived", archivedOn: t, pauses: withResume(x.pauses, t) })));
    return true;
  },

  unarchiveTrack(habitId: string): boolean {
    if (trackState(data, habitId).status !== "archived") return false;
    commit(withTrack(data, habitId, (x) => ({ ...x, status: "active", archivedOn: null })));
    return true;
  },

  /**
   * Deletes a track and everything it owns, archived or not, and only when `confirmName` matches its
   * name (ignoring case and outer spaces). The screen asks first and offers undo. A companion another track still points at is never removed.
   * Returns what was removed so restoreTrack can undo it, or null if refused.
   */
  deleteTrack(habitId: string, confirmName: string): TrackBackup | null {
    const habit = data.habits.find((h) => h.id === habitId);
    if (!habit) return null;
    if (confirmName.trim().toLowerCase() !== habit.name.trim().toLowerCase()) return null;
    const usedElsewhere = new Set(data.habits.filter((h) => h.id !== habitId).map((h) => h.companionId));
    const companionIds = new Set(data.companions.filter((c) => (c.trackId === habitId || (!c.trackId && c.id === habit.companionId)) && !usedElsewhere.has(c.id)).map((c) => c.id));
    const backup: TrackBackup = {
      habit, position: data.habits.indexOf(habit),
      companions: data.companions.filter((c) => companionIds.has(c.id)),
      entries: data.entries.filter((e) => e.habitId === habitId),
      cleanDays: data.cleanDays.filter((c) => c.habitId === habitId),
      urges: data.urges.filter((u) => u.habitId === habitId),
      summaries: data.summaries[habitId] ?? {},
    };
    const { [habitId]: _gone, ...summaries } = data.summaries;
    commit({
      ...data,
      habits: data.habits.filter((h) => h.id !== habitId),
      companions: data.companions.filter((c) => !companionIds.has(c.id)),
      entries: data.entries.filter((e) => e.habitId !== habitId),
      cleanDays: data.cleanDays.filter((c) => c.habitId !== habitId),
      urges: data.urges.filter((u) => u.habitId !== habitId),
      summaries,
      settings: data.settings.activeHabit === habitId ? { ...data.settings, activeHabit: null } : data.settings,
    });
    return backup;
  },

  /** Puts back a track removed by deleteTrack (undo). False if a track with that id exists again. */
  restoreTrack(b: TrackBackup): boolean {
    if (data.habits.some((h) => h.id === b.habit.id)) return false;
    const have = new Set(data.companions.map((c) => c.id));
    const habits = [...data.habits];
    habits.splice(Math.min(b.position, habits.length), 0, b.habit);
    commit({
      ...data, habits,
      companions: [...data.companions, ...b.companions.filter((c) => !have.has(c.id))],
      entries: [...data.entries, ...b.entries].sort((a, c) => a.createdAt - c.createdAt),
      cleanDays: [...data.cleanDays, ...b.cleanDays],
      urges: [...data.urges, ...b.urges].sort((a, c) => a.createdAt - c.createdAt),
      summaries: Object.keys(b.summaries).length ? { ...data.summaries, [b.habit.id]: b.summaries } : data.summaries,
    });
    return true;
  },

  exportJson: () => JSON.stringify(data, null, 2),
  /**
   * Wipes this phone's copy only. The account's copy is never touched: the commit is marked "reset",
   * so sync starts over and, while signed in, brings the account's history back.
   */
  async resetAll() {
    // An erase is the person's explicit choice, so it may write even from the lock screen (Forgot PIN → Erase).
    vaultKey = null; writable = true;
    // Bounded: if storage never answers, the erase still finishes; the commit below writes over what's left.
    try { await withTimeout(kv.clear(), 5000); localStorage.removeItem(LEGACY_KEY); localStorage.removeItem(AI_CACHE_KEY); } catch { /* ignore */ }
    commit(blank(), "reset");
  },
};

import type { SlipRequest } from "@detox/schema";

/** What the AI is allowed to see about one slip: no photos, short notes only. */
export function slipRequest(entryId: string): SlipRequest | null {
  const e = data.entries.find((x) => x.id === entryId);
  const habit = e && data.habits.find((h) => h.id === e.habitId);
  const companion = e && data.companions.find((c) => c.id === e.companionId);
  if (!e || !habit || !companion) return null;
  const since = addDays(e.day, -30);
  const med = median(data.entries.filter((x) => x.habitId === habit.id && x.amount !== null && x.day >= since && x.day < e.day).map((x) => x.amount as number));
  const last7 = data.entries.filter((x) => x.habitId === habit.id && x.day > addDays(e.day, -7) && x.day <= e.day).length;
  return {
    kind: "slip", tone: data.settings.tone, habitClass: habit.cls, companionName: companion.name,
    amount: e.amount, unit: habit.unit, median: med ?? null,
    triggers: [
      ...habit.fields.filter((f) => f.type === "yesno" && f.trigger && e.values[f.id] === true).map((f) => f.label),
      ...habit.fields.filter((f) => f.id === "mood" || f.id === "plan" || f.id === "who").flatMap((f) => pickedLabels(f, e.values[f.id])),
    ].map((t) => t.slice(0, 60)).slice(0, 8),
    texts: [
      ...(habit.unit === "money" && e.amount !== null ? [`Spent ${money(data.settings.currency, e.amount)}`] : []),
      ...habit.fields.filter((f) => f.type === "text").map((f) => String(e.values[f.id] ?? "").trim()).filter(Boolean),
      ...habit.fields.filter((f) => f.id === "what" || f.id === "where").flatMap((f) => pickedLabels(f, e.values[f.id]).map((l) => `${f.id === "where" ? "Where" : "What"}: ${l}`)),
      ...(typeof e.values.urge === "string" && e.values.urge ? [`Urge strength: ${e.values.urge} of 5`] : []),
    ].map((t) => t.slice(0, 80)).slice(0, 4),
    nthToday: data.entries.filter((x) => x.habitId === habit.id && x.day === e.day && x.createdAt <= e.createdAt).length || 1,
    baselineMonths: e.months, last7Slips: last7,
  };
}
