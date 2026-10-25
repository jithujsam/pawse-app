import { useMemo, useSyncExternalStore } from "react";
import {
  baselineMonths, cleanDaysToAge, cleanDaysToUndo, computeSeverity, CONTINUITY, floorAge, simulate, STAGE_LABEL, stageForAge,
  type DayInput, type DayState, type Stage,
} from "@detox/engine";
import { addDays, iso, today, weekStart } from "./dates";
import { outcomeDays, petDayInputs, quietDays, streaks, trackIndex, withPause, withResume } from "./progress";
import { effectsFor, EFFECT_LABEL, slipLine } from "./copy";
import { weightFor } from "./templates";
import { buildFields, countTriggers, pickedLabels, type Intake } from "./questions";
import { kv, idbAvailable } from "./db";
import { blank, migrateIds, normalize, uuid } from "./persist";
import { newKey, open as vaultOpen, seal, type Sealed, type VaultKey } from "./vault";
import { localCurrency } from "./region";
import type { AppData, Baseline, Companion, Entry, Habit, Measure, Personality, RecoveryPlan, Species, StrategyId, Tone, Urge } from "./types";
import type { HabitClass } from "@detox/engine";

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
    const loaded = raw === undefined ? null : normalize(raw);
    if (raw !== undefined && !loaded) await kv.set(`data.unreadable.${Date.now()}`, raw);
    data = migrateIds(loaded ?? blank());
    if (data.settings.onboarded && !data.settings.neglectFrom) data = { ...data, settings: { ...data.settings, neglectFrom: today() } };
    if (legacy || (loaded && loaded !== data)) { await flush(); if (legacy) localStorage.removeItem(LEGACY_KEY); }
  } catch { data = blank(); }
  return { kind: "ready" };
}

/** Decrypts with the PIN. False when it's wrong. */
export async function unlockWith(pin: string, sealed: Sealed): Promise<boolean> {
  const r = await vaultOpen(pin, sealed);
  if (!r) return false;
  vaultKey = r.k;
  data = migrateIds(normalize(r.value) ?? blank());
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
  // paused days, days with any record, today and days after a death are never "missed".
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
 * switching them on now would end the companion's life on the spot.
 */
export function canAllowPassingAway(d: AppData): boolean {
  const c = activeCompanion(d);
  if (!c || c.diedOn) return true;
  return !viewCompanion(d, c.id, today(), { ignoreNoDeath: true }).states.some((s) => s.stage === "dead");
}

/** The companion of the open recovery track: the one chosen on this phone, else the first. */
export const activeCompanion = (d: AppData): Companion | undefined => {
  const habit = d.habits.find((h) => h.id === d.settings.activeHabit) ?? d.habits[0];
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

/** The hour of a slip: the time given, or when it was logged if logged the same day. */
export function slipHour(e: Entry): number | null {
  if (e.time) return Number(e.time.slice(0, 2));
  const at = new Date(e.createdAt);
  return iso(at) === e.day ? at.getHours() : null;
}

/** Treats in the jar: one per clean day ever, minus those already given. */
export function treatsLeft(d: AppData, habitId: string): number {
  const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
  return Math.max(0, d.cleanDays.filter((c) => c.habitId === habitId && !slips.has(c.day)).length - d.settings.treatsGiven);
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
  const baseline = d.settings.baseline;
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

/**
 * Clears a rest day for one track. A day in the shared list from before tracks were separate is moved to every
 * other track's own list, so clearing it here doesn't change what the other tracks show.
 */
function withoutRest(d: AppData, habitId: string, day: string): AppData["settings"] {
  const s = d.settings;
  const own = s.trackRest?.[habitId] ?? [];
  const shared = s.restDays.includes(day);
  if (!shared && !own.includes(day)) return s;
  const trackRest = { ...s.trackRest, [habitId]: own.filter((x) => x !== day) };
  if (shared) for (const h of d.habits) if (h.id !== habitId) trackRest[h.id] = [...new Set([...(trackRest[h.id] ?? []), day])].sort();
  return { ...s, restDays: shared ? s.restDays.filter((x) => x !== day) : s.restDays, trackRest };
}

export const emptyPlan = (): RecoveryPlan => ({ goal: null, reasons: [], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] });

function cleanPlan(p: RecoveryPlan): RecoveryPlan {
  const list = (xs: string[], n: number, len: number) => [...new Set(xs.map((x) => x.trim().slice(0, len)).filter(Boolean))].slice(0, n);
  return {
    goal: p.goal, reasons: list(p.reasons, 8, 80), situations: list(p.situations, 8, 60), firstStep: p.firstStep.trim().slice(0, 140),
    strategies: [...new Set(p.strategies)].slice(0, 7), supportName: p.supportName.trim().slice(0, 40), ifThen: list(p.ifThen, 8, 160),
  };
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
    const habit: Habit = {
      id: uid(), name: o.intake.what.trim() || "My habit", cls: o.intake.cls, classWeight: weightFor(o.intake.cls),
      companionId, unit: o.intake.measure, fields: buildFields(o.intake),
    };
    commit({
      ...data,
      settings: { ...data.settings, userName: (o.userName ?? "").trim().slice(0, 30), neglectFrom: today(), currency: localCurrency(data.settings.currency), tone: o.tone, reminder: o.reminder, goal: o.intake.what.trim(), baseline: o.baseline, onboarded: true, plan: o.plan ? cleanPlan(o.plan) : data.settings.plan },
      companions: [companion], habits: [habit],
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

  setSummary: (week: string, text: string) => commit({ ...data, summaries: { ...data.summaries, [week]: text } }),

  /** Replace everything, used when an account's saved copy is newer than this phone's. */
  /** Applies rows that arrived from the account. Never marked as local changes, so they don't bounce back. */
  applyRemote(next: AppData) { commit(next, "remote"); },

  /** Restores a backup file. Everything in it is validated first; returns false if it isn't a backup. */
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
    commit({ ...data, habits: data.habits.map((x) => (x.id === habitId ? { ...x, fields: buildFields({ what: data.settings.goal || x.name, measure: x.unit, cls: x.cls, triggers }) } : x)) });
  },

  updateHabitFields: (habitId: string, fields: Habit["fields"]) =>
    commit({ ...data, habits: data.habits.map((h) => (h.id === habitId ? { ...h, fields } : h)) }),

  logSlip(habitId: string, values: Entry["values"], day = today(), time: string | null = null): Deduction {
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
    let next: AppData = {
      ...data,
      entries: [...data.entries, entry],
      // A goal-met mark on this day stays as history: the slip wins while it exists, and deleting the slip brings
      // the goal-met day back. Milestones count days of care, which a slip doesn't take away, so they aren't reset.
      settings: withoutRest(data, habitId, day),
    };
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
    if (data.entries.some((e) => e.habitId === habitId && e.day === day)) return false;
    if (data.cleanDays.some((c) => c.habitId === habitId && c.day === day)) return true;
    commit({ ...data, cleanDays: [...data.cleanDays, { habitId, day }], settings: withoutRest(data, habitId, day) });
    return true;
  },

  /**
   * Marks a day as intentionally not tracked (or clears that). A day with a slip or marked as goal met
   * can't be a rest day: what was recorded wins. Rest days never count as progress or as a lapse.
   */
  setRest(habitId: string, day: string, on: boolean): boolean {
    if (on && (data.entries.some((e) => e.habitId === habitId && e.day === day) || data.cleanDays.some((c) => c.habitId === habitId && c.day === day)
      || data.urges.some((u) => u.habitId === habitId && u.day === day && u.outcome === "rode_it_out"))) return false;
    if (!on) { commit({ ...data, settings: withoutRest(data, habitId, day) }); return true; }
    const own = data.settings.trackRest?.[habitId] ?? [];
    if (own.includes(day) || data.settings.restDays.includes(day)) return true;
    commit({ ...data, settings: { ...data.settings, trackRest: { ...data.settings.trackRest, [habitId]: [...own, day].sort().slice(-4000) } } });
    return true;
  },

  /** Pauses a track from a day on (today by default). Paused days count neither way. Records still win. */
  pauseTrack(habitId: string, from = today()) {
    const pauses = data.settings.pauses?.[habitId] ?? [];
    const next = withPause(pauses, from);
    if (next !== pauses) commit({ ...data, settings: { ...data.settings, pauses: { ...data.settings.pauses, [habitId]: next } } });
  },
  /** Resumes a paused track: `on` (today by default) is the first day tracked again. */
  resumeTrack(habitId: string, on = today()) {
    const pauses = data.settings.pauses?.[habitId] ?? [];
    if (!pauses.some((p) => p.to === null)) return;
    commit({ ...data, settings: { ...data.settings, pauses: { ...data.settings.pauses, [habitId]: withResume(pauses, on) } } });
  },

  /** Saves the person's plan. Text is trimmed and capped; empty items are dropped. */
  savePlan(p: RecoveryPlan) { commit({ ...data, settings: { ...data.settings, plan: cleanPlan(p) } }); },

  /** Adds one if-then plan (e.g. from a lapse reflection or weekly review) without duplicating it. */
  addIfThen(text: string) {
    const t = text.trim().slice(0, 160);
    if (!t) return;
    const plan = data.settings.plan ?? emptyPlan();
    if (plan.ifThen.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    commit({ ...data, settings: { ...data.settings, plan: { ...plan, ifThen: [...plan.ifThen, t].slice(-8) } } });
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
  setWeekFocus(week: string, text: string) {
    const t = text.trim().slice(0, 160);
    const rest = data.settings.weekFocus.filter((w) => w.week !== week);
    commit({ ...data, settings: { ...data.settings, weekFocus: (t ? [...rest, { week, text: t }] : rest).sort((a, b) => a.week.localeCompare(b.week)).slice(-60) } });
  },

  deleteEntry: (id: string) => commit({ ...data, entries: data.entries.filter((e) => e.id !== id) }),
  /** Puts back an entry removed by mistake (undo). */
  restoreEntry: (e: Entry) => commit({ ...data, entries: [...data.entries, e].sort((a, b) => a.createdAt - b.createdAt) }),
  unmarkClean: (habitId: string, day: string) => commit({ ...data, cleanDays: data.cleanDays.filter((c) => !(c.habitId === habitId && c.day === day)) }),
  /** Records which milestones a track has celebrated. */
  setCelebrated: (habitId: string, seen: number[]) => commit({ ...data, settings: { ...data.settings, celebratedBy: { ...data.settings.celebratedBy, [habitId]: seen } } }),
  /** A new companion on a track celebrates its milestones afresh, once each. */
  resetCelebrations: (habitId: string) => {
    const legacy = data.habits[0]?.id === habitId && data.settings.celebrated.length > 0;
    commit({ ...data, settings: { ...data.settings, celebratedBy: { ...data.settings.celebratedBy, [habitId]: [] }, celebrated: legacy ? [] : data.settings.celebrated } });
  },

  /** Records a craving and how it ended. Tracked only: the engine never sees it. */
  recordUrge(habitId: string, strength: number, outcome: Urge["outcome"], extra: { strategy?: StrategyId | null; trigger?: string | null } = {}) {
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

  /** Opens a recovery track on this phone. Unknown ids are ignored. */
  selectTrack(habitId: string) {
    if (data.settings.activeHabit === habitId || !data.habits.some((h) => h.id === habitId)) return;
    commit({ ...data, settings: { ...data.settings, activeHabit: habitId } });
  },

  /**
   * A new recovery track: its own habit and its own companion, born today. Nothing is shared with other
   * tracks' entries or companions. Opens it on this phone and returns its habit id.
   */
  addTrack(o: { what: string; cls: HabitClass; measure: Measure; species: Species; name: string }): string {
    const companion: Companion = { id: uid(), species: o.species, name: o.name.trim().slice(0, 20) || "Biscuit", bornOn: today(), diedOn: null, finalAge: null };
    const intake: Intake = { what: o.what.trim().slice(0, 60), measure: o.measure, triggers: [], cls: o.cls };
    const habit: Habit = {
      id: uid(), name: intake.what || "My habit", cls: o.cls, classWeight: weightFor(o.cls),
      companionId: companion.id, unit: o.measure, fields: buildFields(intake),
    };
    commit({ ...data, companions: [...data.companions, companion], habits: [...data.habits, habit], settings: { ...data.settings, activeHabit: habit.id } });
    return habit.id;
  },

  adopt(habitId: string, name: string, species: Species, personality?: Personality) {
    const habit = data.habits.find((h) => h.id === habitId)!;
    const companion: Companion = { id: uid(), species, personality, name: name.trim() || "Biscuit", bornOn: today(), diedOn: null, finalAge: null };
    commit({
      ...data,
      companions: [...data.companions, companion],
      habits: data.habits.map((h) => (h.id === habit.id ? { ...h, companionId: companion.id } : h)),
    });
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
