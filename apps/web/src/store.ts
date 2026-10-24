import { useMemo, useSyncExternalStore } from "react";
import {
  baselineMonths, cleanDaysToAge, cleanDaysToUndo, computeSeverity, floorAge, simulate, STAGE_LABEL, stageForAge,
  type DayInput, type DayState, type Stage,
} from "@detox/engine";
import { addDays, daysBetween, range, today, weekStart } from "./dates";
import { effectsFor, EFFECT_LABEL, slipLine } from "./copy";
import { weightFor } from "./templates";
import { buildFields, countTriggers, pickedLabels, type Intake } from "./questions";
import { kv, idbAvailable } from "./db";
import { blank, migrateIds, normalize, uuid } from "./persist";
import { newKey, open as vaultOpen, seal, type Sealed, type VaultKey } from "./vault";
import type { AppData, Baseline, Companion, Entry, Habit, Personality, Species, Tone } from "./types";

const LEGACY_KEY = "detox-companion/v1";
const uid = uuid;

let data: AppData = blank();
const listeners = new Set<() => void>();
export type CommitSource = "local" | "remote";
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
  listeners.forEach((l) => l());
  return true;
}

export const vault = {
  hasPin: () => vaultKey !== null,
  async setPin(pin: string) { vaultKey = await newKey(pin); await flush(); await kv.set("pinLength", pin.length); },
  async removePin() { vaultKey = null; await flush(); await kv.del("pinLength"); },
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

export function viewCompanion(d: AppData, companionId: string, upTo = today()): CompanionView {
  const companion = d.companions.find((c) => c.id === companionId)!;
  const habit = d.habits.find((h) => h.companionId === companionId);
  const last = companion.diedOn && companion.diedOn < upTo ? companion.diedOn : upTo;
  // Bucket once so the fold is linear in days + entries, not days x entries.
  const damage = new Map<string, number[]>();
  for (const e of d.entries) if (e.companionId === companionId) { const a = damage.get(e.day); if (a) a.push(e.months); else damage.set(e.day, [e.months]); }
  const clean = new Set(habit ? d.cleanDays.filter((c) => c.habitId === habit.id).map((c) => c.day) : []);
  const inputs: DayInput[] = daysBetween(companion.bornOn, last) < 0 ? [] : range(companion.bornOn, last).map((day) => ({
    day, damage: damage.get(day) ?? [], clean: clean.has(day),
  }));
  const states = simulate(inputs);
  const current = states[states.length - 1];
  const age = companion.finalAge ?? current?.visibleAge ?? 0;
  return { companion, habit, states, current, age, stage: stageForAge(age), dead: companion.diedOn !== null };
}

export const activeCompanion = (d: AppData): Companion | undefined => {
  const habit = d.habits[0];
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

export function cleanStreak(d: AppData, habitId: string): number {
  let n = 0;
  const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
  const cleans = new Set(d.cleanDays.filter((c) => c.habitId === habitId).map((c) => c.day));
  for (let day = today(); ; day = addDays(day, -1)) {
    const slipped = slips.has(day);
    const clean = cleans.has(day);
    if (slipped) break;
    if (clean) n++; else if (day !== today()) break;
    if (n > 3650) break;
  }
  return n;
}

/** The longest run of clean days with no slip in between, ever. */
export function bestStreak(d: AppData, habitId: string): number {
  const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
  const days = [...new Set(d.cleanDays.filter((c) => c.habitId === habitId && !slips.has(c.day)).map((c) => c.day))].sort();
  let best = 0, run = 0, prev = "";
  for (const day of days) { run = prev && addDays(prev, 1) === day ? run + 1 : 1; best = Math.max(best, run); prev = day; }
  return best;
}

/** Treats in the jar: one per clean day ever, minus those already given. */
export function treatsLeft(d: AppData, habitId: string): number {
  const slips = new Set(d.entries.filter((e) => e.habitId === habitId).map((e) => e.day));
  return Math.max(0, d.cleanDays.filter((c) => c.habitId === habitId && !slips.has(c.day)).length - d.settings.treatsGiven);
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

  finishOnboarding(o: { species: Species; coat?: string; personality?: Personality; companionName: string; intake: Intake; tone: Tone; reminder: string; baseline: Baseline | null }) {
    const companionId = uid();
    const companion: Companion = { id: companionId, species: o.species, coat: o.coat, personality: o.personality, name: o.companionName.trim() || "Biscuit", bornOn: today(), diedOn: null, finalAge: null };
    const habit: Habit = {
      id: uid(), name: o.intake.what.trim() || "My habit", cls: o.intake.cls, classWeight: weightFor(o.intake.cls),
      companionId, unit: o.intake.measure, fields: buildFields(o.intake),
    };
    commit({
      ...data,
      settings: { ...data.settings, tone: o.tone, reminder: o.reminder, goal: o.intake.what.trim(), baseline: o.baseline, onboarded: true },
      companions: [companion], habits: [habit],
    });
  },

  /** Applies a validated AI result to an entry that was first saved with the baseline. */
  applyAi(entryId: string, r: { months: number; adjustPct: number; effects: string[]; explanation: string }) {
    const e = data.entries.find((x) => x.id === entryId);
    if (!e) return;
    let next: AppData = {
      ...data,
      entries: data.entries.map((x) => (x.id === entryId ? { ...x, months: r.months, aiAdjustPct: r.adjustPct, effects: r.effects, explanation: r.explanation, source: "ai" as const } : x)),
    };
    const v = viewCompanion(next, e.companionId);
    const dead = v.states.find((s) => s.stage === "dead");
    const c = next.companions.find((x) => x.id === e.companionId)!;
    if (dead && !c.diedOn) next = { ...next, companions: next.companions.map((x) => (x.id === c.id ? { ...x, diedOn: dead.day, finalAge: 100 } : x)) };
    commit(next);
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
      cleanDays: data.cleanDays.filter((c) => !(c.habitId === habitId && c.day === day)),
      settings: { ...data.settings, celebrated: [] },
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
    commit({ ...data, cleanDays: [...data.cleanDays, { habitId, day }] });
    return true;
  },

  deleteEntry: (id: string) => commit({ ...data, entries: data.entries.filter((e) => e.id !== id) }),
  /** Puts back an entry removed by mistake (undo). */
  restoreEntry: (e: Entry) => commit({ ...data, entries: [...data.entries, e].sort((a, b) => a.createdAt - b.createdAt) }),
  unmarkClean: (habitId: string, day: string) => commit({ ...data, cleanDays: data.cleanDays.filter((c) => !(c.habitId === habitId && c.day === day)) }),
  celebrate: (n: number) => commit({ ...data, settings: { ...data.settings, celebrated: [...data.settings.celebrated, n] } }),
  resetCelebrations: () => { if (data.settings.celebrated.length) commit({ ...data, settings: { ...data.settings, celebrated: [] } }); },

  /** Feeding: true if the companion ate. It refuses on a day with a slip, and eats once a day. */
  feed(habitId: string): "ate" | "full" | "strike" {
    const t = today();
    if (data.entries.some((e) => e.habitId === habitId && e.day === t)) return "strike";
    if (data.settings.fedOn === t) return "full";
    commit({ ...data, settings: { ...data.settings, fedOn: t } });
    return "ate";
  },
  /** Gives one treat from the jar (one is earned per clean day). */
  giveTreat(habitId: string): "ate" | "empty" | "strike" {
    if (data.entries.some((e) => e.habitId === habitId && e.day === today())) return "strike";
    if (treatsLeft(data, habitId) <= 0) return "empty";
    commit({ ...data, settings: { ...data.settings, treatsGiven: data.settings.treatsGiven + 1 } });
    return "ate";
  },
  setCompanionLook: (id: string, patch: Pick<Companion, "coat" | "personality">) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),

  renameCompanion: (id: string, name: string) =>
    commit({ ...data, companions: data.companions.map((c) => (c.id === id ? { ...c, name: name.trim().slice(0, 20) || c.name } : c)) }),

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
  async resetAll() {
    vaultKey = null;
    try { await kv.clear(); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    commit(blank());
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
