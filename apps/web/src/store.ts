import { useSyncExternalStore } from "react";
import {
  baselineMonths, computeSeverity, simulate, stageForAge,
  type DayInput, type DayState,
} from "@detox/engine";
import { addDays, daysBetween, range, today, weekStart } from "./dates";
import { effectsFor, EFFECT_LABEL, slipLine } from "./copy";
import { templateFor, weightFor } from "./templates";
import type { AppData, Companion, Entry, Habit, Species, Tone } from "./types";

const KEY = "detox-companion/v1";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const blank = (): AppData => ({
  v: 1,
  settings: { tone: "honest", reminder: "20:00", currency: "Rs", deathScene: true, onboarded: false },
  companions: [], habits: [], entries: [], cleanDays: [],
});

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw) as AppData; if (d?.v === 1) return d; }
  } catch { /* storage unavailable */ }
  return blank();
}

let data: AppData = load();
const listeners = new Set<() => void>();
function commit(next: AppData) {
  data = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
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

export function viewCompanion(d: AppData, companionId: string, upTo = today()): CompanionView {
  const companion = d.companions.find((c) => c.id === companionId)!;
  const habit = d.habits.find((h) => h.companionId === companionId);
  const last = companion.diedOn && companion.diedOn < upTo ? companion.diedOn : upTo;
  const inputs: DayInput[] = daysBetween(companion.bornOn, last) < 0 ? [] : range(companion.bornOn, last).map((day) => ({
    day,
    damage: d.entries.filter((e) => e.companionId === companionId && e.day === day).map((e) => e.months),
    clean: !!habit && d.cleanDays.some((c) => c.habitId === habit.id && c.day === day),
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

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function cleanStreak(d: AppData, habitId: string): number {
  let n = 0;
  for (let day = today(); ; day = addDays(day, -1)) {
    const slipped = d.entries.some((e) => e.habitId === habitId && e.day === day);
    const clean = d.cleanDays.some((c) => c.habitId === habitId && c.day === day);
    if (slipped) break;
    if (clean) n++; else if (day !== today()) break;
    if (n > 3650) break;
  }
  return n;
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
}

export const actions = {
  setTone: (tone: Tone) => commit({ ...data, settings: { ...data.settings, tone } }),
  setSettings: (patch: Partial<AppData["settings"]>) => commit({ ...data, settings: { ...data.settings, ...patch } }),

  finishOnboarding(o: { species: Species; companionName: string; habitName: string; cls: Habit["cls"]; tone: Tone; reminder: string }) {
    const t = templateFor(o.cls);
    const companionId = uid();
    const companion: Companion = { id: companionId, species: o.species, name: o.companionName.trim() || "Biscuit", bornOn: today(), diedOn: null, finalAge: null };
    const habit: Habit = {
      id: uid(), name: o.habitName.trim() || t.label, cls: o.cls, classWeight: weightFor(o.cls),
      companionId, unit: t.unit, fields: t.fields.map((f) => ({ ...f })),
    };
    commit({ ...data, settings: { ...data.settings, tone: o.tone, reminder: o.reminder, onboarded: true }, companions: [companion], habits: [habit] });
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
    const triggers = habit.fields.filter((f) => f.trigger && values[f.id] === true).length;
    const severity = computeSeverity({ amount: amount ?? undefined, median: med, classWeight: habit.classWeight, triggers });
    const nth = data.entries.filter((e) => e.habitId === habitId && e.day === day).length + 1;
    const months = baselineMonths(severity, nth);
    const before = viewCompanion(data, companion.id, day);
    const effects = effectsFor(habit.cls, Math.min(100, before.age + months / 12));
    const tone = data.settings.tone;
    const entry: Entry = {
      id: uid(), habitId, companionId: companion.id, day, time, values, amount, months, severity, effects,
      explanation: slipLine(tone, companion.name, months, nth), createdAt: Date.now(),
    };
    let next: AppData = {
      ...data,
      entries: [...data.entries, entry],
      cleanDays: data.cleanDays.filter((c) => !(c.habitId === habitId && c.day === day)),
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
    return {
      entry, line: entry.explanation, nthToday: nth, weekSlips: ws.slips, died,
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

  adopt(habitId: string, name: string, species: Species) {
    const habit = data.habits.find((h) => h.id === habitId)!;
    const companion: Companion = { id: uid(), species, name: name.trim() || "Biscuit", bornOn: today(), diedOn: null, finalAge: null };
    commit({
      ...data,
      companions: [...data.companions, companion],
      habits: data.habits.map((h) => (h.id === habit.id ? { ...h, companionId: companion.id } : h)),
    });
  },

  /** Demo tool: backfill the last n days with slips so the ageing is visible. */
  demoWeek(habitId: string, perDay: number, days = 7) {
    for (let i = days; i >= 1; i--) {
      const day = addDays(today(), -i);
      const habit = data.habits.find((h) => h.id === habitId)!;
      const amountField = habit.fields.find((f) => f.amount);
      for (let k = 0; k < perDay; k++) {
        const values: Entry["values"] = {};
        if (amountField) values[amountField.id] = String(amountField.type === "money" ? 300 + k * 60 : 5 + k * 3);
        for (const f of habit.fields) if (f.trigger && k > 0) values[f.id] = true;
        actions.logSlip(habitId, values, day);
      }
    }
  },
  /** Demo tool: move the companion's birth earlier so a past week is part of its life. */
  backdateBirth(companionId: string, days: number) {
    commit({ ...data, companions: data.companions.map((c) => (c.id === companionId ? { ...c, bornOn: addDays(c.bornOn, -days) } : c)) });
  },

  exportJson: () => JSON.stringify(data, null, 2),
  resetAll() { commit(blank()); },
};
