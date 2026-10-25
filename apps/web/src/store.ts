import { useMemo, useSyncExternalStore } from "react";
import {
  baselineMonths, cleanDaysToAge, cleanDaysToUndo, computeSeverity, CONTINUITY, floorAge, simulate, STAGE_LABEL, stageForAge,
  type DayInput, type DayState, type HabitClass, type Stage,
} from "@detox/engine";
import { addDays, iso, today, weekStart } from "./dates";
import { outcomeDays, petDayInputs, quietDays, streaks, trackIndex, withPause, withResume } from "./progress";
import { effectsFor, EFFECT_LABEL, slipLine } from "./copy";
import { weightFor } from "./templates";
import { buildFields, countTriggers, pickedLabels, type Intake } from "./questions";
import { kv, idbAvailable } from "./db";
import { blank, migrateIds, normalize, normalizeWithReport, uuid } from "./persist";
import { canRecord, defaultTrackState, firstEventDay, focusedTrackId, getTrack, trackState, type Track } from "./tracks";
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

function commit(next: AppData, source: CommitSource = "local") {
  const prev = data;
  data = { ...next, updatedAt: Date.now() };
  listeners.forEach((l) => l());
  hooks.forEach((h) => h(prev, data, source));
  schedulePersist();
}

// ---------- persistence: IndexedDB, encrypted when a PIN is set ----------

let vaultKey: VaultKey | null = null;
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
    return { kind: "ready" };
  }
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
    if (legacy || v1 || (loaded && loaded !== data)) { await flush(); if (legacy) localStorage.removeItem(LEGACY_KEY); }
  } catch { data = blank(); }
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
  listeners.forEach((l) => l());
  return true;
}

const pinWatchers = new Set<() => void>();
/** Called when app lock is turned on or off, e.g. so the home screen widget hides or shows today's status. */
export const onPinChange = (fn: () => void) => { pinWatchers.add(fn); return () => { pinWatchers.delete(fn); }; };

export const vault = {
  hasPin: () => vaultKey !== null,
  async setPin(pin: string) { vaultKey = await newKey(pin); await flush(); await kv.set("pinLength", pin.length).catch(() => undefined); pinWatchers.forEach((w) => w()); },
  async removePin() { vaultKey = null; await flush(); await kv.del("pinLength").catch(() => undefined); pinWatchers.forEach((w) => w()); },
  pinLength: async () => (await kv.get<number>("pinLength").catch(() => undefined)) ?? 4,
  /** Re-checks the current PIN without changing anything. */
  async check(pin: string) { const s = await kv.get<Sealed>("data.enc"); return s ? (await vaultOpen(pin, s)) !== null : false; },
};

export const useData = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => data);
export const getData = () => data;
export const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

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

export function viewCompanion(d: AppData, companionId: string, upTo = today(), opts: { ignoreNoDeath?: boolean } = {}): CompanionView {
  const companion = d.companions.find((c) => c.id === companionId)!;
  const habit = d.habits.find((h) => h.companionId === companionId);
  // Missed check-ins never cost life unless the quiet-days rule is switched back on, and even then rest and
  // paused days, days with any record, today and days after a death are never "missed". petDayInputs counts only
  // this companion's slips on its own track, so a slip filed under another track can never age it.
  const inputs: DayInput[] = petDayInputs(d, companionId, upTo, today(), QUIET_DAYS_AGE ? d.settings.neglectFrom : null);
  // Continuity (the default): the companion can't die and every month can heal. Classic: the PRD rules.
  // A companion that already died stays as it was.
  const continuity = d.settings.petLife !== "classic" && !companion.diedOn && !opts.ignoreNoDeath;
  const states = simulate(inputs, continuity ? CONTINUITY : {});
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

/** The focused track, with its state. Screens that show one pet read per-track settings from here. */
export function useActiveTrack(): Track | undefined {
  const d = useData();
  return useMemo(() => { const id = focusedTrackId(d); return id ? getTrack(d, id) : undefined; }, [d]);
}
export const activeTrackId = (d: AppData = data) => focusedTrackId(d);

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

/** The longest streak ever, by the same rule as cleanStreak. */
export const bestStreak = (d: AppData, habitId: string, t0 = today()) => streaks(trackIndex(d, habitId, t0)).best;

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
  if (!habit || !companion) return { enabled: false, reminder, tone, name: "", checkedToday: false, lastCheckIn: null, riskHour: null, careNotes: false };
  const idx = trackIndex(d, habit.id, t0);
  const lastCheckIn = [...idx.checkedIn].filter((x) => x <= t0).sort().pop() ?? idx.start;
  const status = trackState(d, habit.id).status;
  return {
    enabled: remindersOn && status === "active" && !companion.diedOn, reminder, tone, name: companion.name, personality: companion.personality,
    checkedToday: idx.checkedIn.has(t0) || idx.rest.has(t0), lastCheckIn, riskHour: riskNudge ? riskyHour(d, habit.id) : null, careNotes,
  };
}

/** The hour of a slip: the time given, or when it was logged if logged the same day. */
export function slipHour(e: Entry): number | null {
  if (e.time) return Number(e.time.slice(0, 2));
  const at = new Date(e.createdAt);
  return iso(at) === e.day ? at.getHours() : null;
}

/** Treats in the jar: one per clean day ever, minus those already given. */
export function treatsLeft(d: AppData, habitId: string): number {
  const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
  return Math.max(0, d.cleanDays.filter((c) => c.habitId === habitId && !slips.has(c.day)).length - trackState(d, habitId).treatsGiven);
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
  setSettings: (patch: Partial<AppData["settings"]>) => commit({ ...data, settings: { ...data.settings, ...patch } }),

  finishOnboarding(o: { species: Species; coat?: string; personality?: Personality; companionName: string; userName?: string; intake: Intake; tone: Tone; reminder: string; baseline: Baseline | null; plan?: RecoveryPlan | null }) {
    const companionId = uid();
    const companion: Companion = { id: companionId, species: o.species, coat: o.coat, personality: o.personality, name: o.companionName.trim() || "Biscuit", bornOn: today(), diedOn: null, finalAge: null };
    const habitId = uid();
    const habit: Habit = {
      id: habitId, name: o.intake.what.trim().slice(0, 60) || "My habit", cls: o.intake.cls, classWeight: weightFor(o.intake.cls),
      companionId, unit: o.intake.measure, fields: buildFields(o.intake),
      track: { ...defaultTrackState(today(), Date.now()), baseline: o.baseline, plan: o.plan ? cleanPlan(o.plan) : null },
    };
    commit({
      ...data,
      settings: { ...data.settings, userName: (o.userName ?? "").trim().slice(0, 30), neglectFrom: today(), currency: localCurrency(data.settings.currency), tone: o.tone, reminder: o.reminder, onboarded: true, activeHabit: habitId },
      companions: [{ ...companion, trackId: habitId }], habits: [habit],
    });
  },

  /**
   * Applies a validated AI result to an entry that was first saved with the baseline. Returns the months
   * actually kept. The AI's nudge is dropped (the baseline stands) when it alone would decide whether the
   * companion lives or dies: a life-or-death outcome always comes from the deterministic engine.
   */
  applyAi(entryId: string, r: { months: number; adjustPct: number; effects: string[]; explanation: string }): number | null {
    const e = data.entries.find((x) => x.id === entryId);
    if (!e) return null;
    const c = data.companions.find((x) => x.id === e.companionId)!;
    const withMonths = (months: number, adjustPct: number | null): AppData => ({
      ...data,
      entries: data.entries.map((x) => (x.id === entryId ? { ...x, months, aiAdjustPct: adjustPct, effects: r.effects, explanation: r.explanation, source: "ai" as const } : x)),
    });
    let next = withMonths(r.months, r.adjustPct);
    const diesWithAi = viewCompanion(next, e.companionId).states.some((s) => s.stage === "dead");
    if (diesWithAi !== (c.diedOn !== null)) next = withMonths(e.months, null);
    commit(next);
    return next.entries.find((x) => x.id === entryId)!.months;
  },

  setSummary: (week: string, text: string, habitId?: string) => {
    const id = focused(habitId);
    if (data.habits.some((h) => h.id === id)) commit({ ...data, summaries: { ...data.summaries, [id]: { ...data.summaries[id], [week]: text } } });
  },

  /** Replace everything, used when an account's saved copy is newer than this phone's. */
  /** Applies rows that arrived from the account. Never marked as local changes, so they don't bounce back. */
  applyRemote(next: AppData) { commit(next, "remote"); },

  /**
   * Restores a backup file. Everything in it is validated and v1 backups are migrated; returns false if it isn't a
   * backup this version can read (including one from a newer version). Rows it can't use are left out; the file
   * itself is untouched, so nothing in it is lost.
   */
  importJson(text: string): boolean {
    try {
      const d = normalize(JSON.parse(text));
      if (!d || !d.settings.onboarded) return false;
      commit(migrateIds(d));
      return true;
    } catch { return false; }
  },

  /** Swaps a habit's questions for the current recommended set, keeping its class and unit. */
  refreshQuestions(habitId: string) {
    const h = data.habits.find((x) => x.id === habitId);
    if (!h) return;
    const triggers = h.fields.find((f) => f.id === "mood")?.options?.map((o) => o.id) ?? [];
    commit({ ...data, habits: data.habits.map((x) => (x.id === habitId ? { ...x, fields: buildFields({ what: trackState(data, x.id).description || x.name, measure: x.unit, cls: x.cls, triggers }) } : x)) });
  },

  updateHabitFields: (habitId: string, fields: Habit["fields"]) =>
    commit({ ...data, habits: data.habits.map((h) => (h.id === habitId ? { ...h, fields } : h)) }),

  /** Null when the track can't take a record: it is archived (read-only) or gone. A pause never refuses one. */
  logSlip(habitId: string, values: Entry["values"], day = today(), time: string | null = null): Deduction | null {
    if (!canRecord(data, habitId)) return null;
    const habit = data.habits.find((h) => h.id === habitId)!;
    const companion = data.companions.find((c) => c.id === habit.companionId)!;
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
    const before = viewCompanion(data, companion.id, day);
    const effects = effectsFor(habit.cls, Math.min(100, before.age + months / 12));
    const tone = data.settings.tone;
    const streakBefore = cleanStreak(data, habitId);
    const entry: Entry = {
      id: uid(), habitId, companionId: companion.id, day, time, values, amount, months, severity, effects,
      explanation: slipLine(tone, companion.name, months, nth), source: "baseline", aiAdjustPct: null, createdAt: Date.now(),
    };
    // A goal-met mark on this day stays as history: the slip wins while it exists, and deleting the slip brings
    // the goal-met day back. Milestones count days of care, which a slip doesn't take away, so they aren't reset.
    let next: AppData = withoutRest({ ...data, entries: [...data.entries, entry] }, habitId, day);
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
    commit(withoutRest({ ...data, cleanDays: [...data.cleanDays, { habitId, day }] }, habitId, day));
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
    commit(withTrack(data, habitId, (s) => { const rest = s.restDays.filter((x) => x !== day); return { ...s, restDays: on ? [...rest, day].sort().slice(-4000) : rest }; }));
    return true;
  },

  /** Saves a track's plan (the focused one by default). Text is trimmed and capped; empty items are dropped. */
  savePlan(p: RecoveryPlan, habitId?: string) { const id = focused(habitId); if (data.habits.some((h) => h.id === id)) commit(withTrack(data, id, (s) => ({ ...s, plan: cleanPlan(p) }))); },

  /** Adds one if-then plan (e.g. from a lapse reflection or weekly review) without duplicating it. */
  addIfThen(text: string, habitId?: string) {
    const t = text.trim().slice(0, 160);
    const id = focused(habitId);
    if (!t || !data.habits.some((h) => h.id === id)) return;
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
    commit({ ...data, entries: data.entries.map((e) => (e.id === entryId ? { ...e, values: { ...e.values, lapse_before: before, lapse_adjust: adjust } } : e)) });
  },

  /** The one adjustment picked for the week after a weekly review. */
  setWeekFocus(week: string, text: string, habitId?: string) {
    const t = text.trim().slice(0, 160);
    const id = focused(habitId);
    if (!data.habits.some((h) => h.id === id)) return;
    commit(withTrack(data, id, (s) => {
      const rest = s.weekFocus.filter((w) => w.week !== week);
      return { ...s, weekFocus: (t ? [...rest, { week, text: t }] : rest).sort((a, b) => a.week.localeCompare(b.week)).slice(-60) };
    }));
  },

  deleteEntry: (id: string) => commit({ ...data, entries: data.entries.filter((e) => e.id !== id) }),
  /** Puts back an entry removed by mistake (undo). */
  restoreEntry: (e: Entry) => commit({ ...data, entries: [...data.entries, e].sort((a, b) => a.createdAt - b.createdAt) }),
  unmarkClean: (habitId: string, day: string) => commit({ ...data, cleanDays: data.cleanDays.filter((c) => !(c.habitId === habitId && c.day === day)) }),
  /** Records which milestones a track has celebrated. */
  setCelebrated: (habitId: string, seen: number[]) => { if (data.habits.some((h) => h.id === habitId)) commit(withTrack(data, habitId, (s) => ({ ...s, celebrated: seen }))); },
  /** A new companion on a track celebrates its milestones afresh, once each. */
  resetCelebrations: (habitId?: string) => { const id = focused(habitId); if (trackState(data, id).celebrated.length) commit(withTrack(data, id, (s) => ({ ...s, celebrated: [] }))); },
  /** Per-track settings that need no checks of their own (what the pet wears, the savings goal, milestones seen...). */
  setTrackSettings(habitId: string, patch: Partial<Pick<TrackState, "wear" | "savingsGoal" | "celebrated" | "baseline" | "treatsGiven" | "fedOn">>) {
    if (data.habits.some((h) => h.id === habitId)) commit(withTrack(data, habitId, (s) => ({ ...s, ...patch })));
  },

  /** Records a craving and how it ended. Tracked only: the engine never sees it. */
  recordUrge(habitId: string, strength: number, outcome: Urge["outcome"], extra: { strategy?: StrategyId | null; trigger?: string | null } = {}): Urge | null {
    if (!canRecord(data, habitId)) return null;
    const now = new Date();
    const urge: Urge = {
      id: uid(), habitId, day: today(), time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      strength: Math.max(1, Math.min(5, Math.round(strength))), outcome, createdAt: Date.now(),
      strategy: extra.strategy ?? null, trigger: extra.trigger?.trim().slice(0, 40) || null,
    };
    commit({ ...data, urges: [...data.urges, urge] });
    return urge;
  },
  /** Saves today's (or another day's) reflection; an empty one is removed. */
  setJournal(day: string, mood: number, body: string) {
    const rest = data.journal.filter((j) => j.day !== day);
    const entry = { day, mood: Math.max(1, Math.min(5, Math.round(mood))), body: body.slice(0, 600) };
    commit({ ...data, journal: mood ? [...rest, entry].sort((a, b) => a.day.localeCompare(b.day)) : rest });
  },

  /** Switches the companion to another species, keeping its name, age and history. */
  setSpecies: (id: string, species: Species) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, species, coat: undefined } : c)) }),
  setCompanionLook: (id: string, patch: Pick<Companion, "coat" | "personality">) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),

  renameCompanion: (id: string, name: string) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, name: name.trim().slice(0, 20) || c.name } : c)) }),

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
  addTrack(o: { what: string; cls: HabitClass; measure: Measure; species: Species; name: string }): string | null {
    return actions.createTrack({ name: o.what.trim() || "My habit", cls: o.cls, unit: o.measure, species: o.species, companionName: o.name, focus: true });
  },

  adopt(habitId: string, name: string, species: Species, personality?: Personality) {
    const habit = data.habits.find((h) => h.id === habitId)!;
    const companion: Companion = { id: uid(), species, personality, name: name.trim() || "Biscuit", bornOn: today(), diedOn: null, finalAge: null, trackId: habit.id };
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
    name: string; description?: string; cls: HabitClass; unit: Measure; triggers?: string[]; fields?: Habit["fields"];
    species: Species; companionName: string; coat?: string; personality?: Personality; baseline?: Baseline | null; plan?: RecoveryPlan | null; focus?: boolean;
  }): string | null {
    const name = o.name.trim().slice(0, 60);
    if (!name || data.habits.length >= 50) return null;
    const habitId = uid(), companionId = uid();
    const companion: Companion = { id: companionId, species: o.species, coat: o.coat, personality: o.personality, name: o.companionName.trim().slice(0, 20) || "Biscuit", bornOn: today(), diedOn: null, finalAge: null, trackId: habitId };
    const habit: Habit = {
      id: habitId, name, cls: o.cls, classWeight: weightFor(o.cls), companionId, unit: o.unit,
      fields: o.fields ?? buildFields({ what: name, measure: o.unit, cls: o.cls, triggers: o.triggers ?? [] }),
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
   * Deletes a track and everything it owns. Only an archived track, and only when `confirmName` matches its
   * name (ignoring case and outer spaces). A companion another track still points at is never removed.
   * Returns what was removed so restoreTrack can undo it, or null if refused.
   */
  deleteTrack(habitId: string, confirmName: string): TrackBackup | null {
    const habit = data.habits.find((h) => h.id === habitId);
    if (!habit || trackState(data, habitId).status !== "archived") return null;
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
    vaultKey = null;
    try { await kv.clear(); localStorage.removeItem(LEGACY_KEY); localStorage.removeItem(AI_CACHE_KEY); } catch { /* ignore */ }
    commit(blank(), "reset");
  },
};

import type { SlipRequest, WeeklyRequest } from "@detox/schema";

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
      ...(habit.unit === "money" && e.amount !== null ? [`Spent ${data.settings.currency}${e.amount}`] : []),
      ...habit.fields.filter((f) => f.type === "text").map((f) => String(e.values[f.id] ?? "").trim()).filter(Boolean),
      ...habit.fields.filter((f) => f.id === "what" || f.id === "where").flatMap((f) => pickedLabels(f, e.values[f.id]).map((l) => `${f.id === "where" ? "Where" : "What"}: ${l}`)),
      ...(typeof e.values.urge === "string" && e.values.urge ? [`Urge strength: ${e.values.urge} of 5`] : []),
    ].map((t) => t.slice(0, 80)).slice(0, 4),
    nthToday: data.entries.filter((x) => x.habitId === habit.id && x.day === e.day && x.createdAt <= e.createdAt).length || 1,
    baselineMonths: e.months, last7Slips: last7,
  };
}

export function weekRequestFor(habitId: string, weekStartDay: string, worstWeekday: string | null): WeeklyRequest | null {
  const habit = data.habits.find((h) => h.id === habitId);
  const companion = habit && data.companions.find((c) => c.id === habit.companionId);
  if (!habit || !companion) return null;
  const pick = (w: ReturnType<typeof weekStats>) => ({ slips: w.slips, spend: Math.round(w.spend), months: Math.round(w.months * 10) / 10 });
  return {
    kind: "weekly", tone: data.settings.tone, habitClass: habit.cls, companionName: companion.name, unit: habit.unit,
    thisWeek: pick(weekStats(data, habitId, weekStartDay)), lastWeek: pick(weekStats(data, habitId, addDays(weekStartDay, -7))),
    worstWeekday, age: Math.round(viewCompanion(data, companion.id).age), currency: data.settings.currency,
  };
}
