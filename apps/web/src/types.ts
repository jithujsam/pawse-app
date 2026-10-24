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
  createdAt: number;
}

export interface CleanDay { habitId: string; day: string }

export interface Settings {
  tone: Tone;
  reminder: string;
  currency: string;
  deathScene: boolean;
  onboarded: boolean;
}

export interface AppData {
  v: 1;
  settings: Settings;
  companions: Companion[];
  habits: Habit[];
  entries: Entry[];
  cleanDays: CleanDay[];
}
