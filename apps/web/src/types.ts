import type { HabitClass } from "@detox/engine";

export type Tone = "gentle" | "honest" | "brutal";
export type Species = "dog" | "cat" | "rabbit";
export type FieldType = "text" | "number" | "money" | "yesno" | "photo";

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** A yes answer counts as a trigger flag (late night, stress, alone, extra). */
  trigger?: boolean;
  /** The money, count or minutes figure used for severity. */
  amount?: boolean;
}

export interface Companion {
  id: string;
  species: Species;
  name: string;
  bornOn: string;
  diedOn: string | null;
  finalAge: number | null;
}

export interface Habit {
  id: string;
  name: string;
  cls: HabitClass;
  classWeight: number;
  companionId: string;
  fields: Field[];
  /** Unit shown next to the amount figure. */
  unit: "money" | "count" | "minutes" | "none";
}

export type Tint = "ocean" | "meadow" | "blossom" | "sunrise";
export type Measure = "money" | "count" | "minutes" | "none";

export interface Entry {
  id: string;
  habitId: string;
  companionId: string;
  day: string;
  time: string | null;
  values: Record<string, string | boolean>;
  amount: number | null;
  months: number;
  severity: number;
  effects: string[];
  explanation: string;
  /** baseline = the deterministic engine only; ai = nudged by the AI layer. */
  source: "baseline" | "ai";
  aiAdjustPct: number | null;
  createdAt: number;
}

export interface CleanDay { habitId: string; day: string }

export interface Settings {
  tone: Tone;
  reminder: string;
  currency: string;
  deathScene: boolean;
  onboarded: boolean;
  tint: Tint;
  /** What the user said they want to let go of, in their own words. */
  goal: string;
  /** How often it happened before they started, as they described it. */
  baseline: Baseline | null;
  haptics: boolean;
  /** The person agreed to a daily check-in reminder. */
  remindersOn: boolean;
  /** First-run tips on Home have been shown. */
  coachSeen: boolean;
  /** Clean-streak milestones already celebrated, so each fires once per streak. */
  celebrated: number[];
  /** How long the app may sit in the background before the PIN is asked again. */
  autoLock: AutoLock;
}

export type AutoLock = "immediately" | "1m" | "5m" | "never";

export type Baseline = "many_daily" | "daily" | "few_weekly" | "weekly";

export interface AppData {
  v: 1;
  settings: Settings;
  companions: Companion[];
  habits: Habit[];
  entries: Entry[];
  cleanDays: CleanDay[];
  /** AI weekly summaries keyed by week start (YYYY-MM-DD). */
  summaries: Record<string, string>;
  updatedAt: number;
}
