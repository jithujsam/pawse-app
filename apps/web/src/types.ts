import type { HabitClass } from "@detox/engine";

export type Tone = "gentle" | "honest" | "brutal";
export type Species = "dog" | "cat" | "rabbit" | "fox" | "owl" | "panda";
export type Personality = "playful" | "calm" | "sassy" | "wise";
/** Things to wear, each unlocked by a clean-streak milestone. */
export type Accessory = "bandana" | "bow" | "flowers" | "scarf" | "glasses" | "crown";
export type FieldType = "text" | "number" | "money" | "yesno" | "photo" | "choice" | "multi" | "scale";

/** One tappable answer. A trigger option counts toward severity, like a yes to a trigger question. */
export interface FieldOption { id: string; label: string; trigger?: boolean }

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** A yes answer counts as a trigger flag (late night, stress, alone, extra). */
  trigger?: boolean;
  /** The money, count or minutes figure used for severity. */
  amount?: boolean;
  /** Answers for choice (pick one) and multi (pick any). Multi answers are stored comma-separated. */
  options?: FieldOption[];
  /** For scale fields: the words under 1 and 5. */
  scaleLabels?: [string, string];
}

export interface Companion {
  id: string;
  species: Species;
  name: string;
  bornOn: string;
  diedOn: string | null;
  finalAge: number | null;
  /** Coat colour id for the species (see COATS). Older companions have none and get the first coat. */
  coat?: string;
  personality?: Personality;
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

/** A craving noticed and ridden out (or not). Tracked only: it never changes the companion's age. */
export interface Urge {
  id: string;
  habitId: string;
  day: string;
  time: string | null;
  strength: number;
  outcome: "rode_it_out" | "slipped";
  createdAt: number;
}

/** One short reflection per day. */
export interface JournalEntry { day: string; mood: number; body: string }

export interface SavingsGoal { label: string; target: number }

export interface Settings {
  tone: Tone;
  reminder: string;
  currency: string;
  deathScene: boolean;
  onboarded: boolean;
  /** Legacy colour choice, no longer used. */
  tint?: Tint;
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
  /** What the companion is wearing, if anything. */
  wear: Accessory | null;
  /** Treats handed out so far. Treats earned = clean days; the difference is what's in the jar. */
  treatsGiven: number;
  /** The last day the companion ate (YYYY-MM-DD). */
  fedOn: string | null;
  /** Care notifications in the companion's voice (thank-yous, hunger strikes). */
  careNotes: boolean;
  /** Something to save the money toward (money habits). */
  savingsGoal: SavingsGoal | null;
  /** A heads-up before the hour slips usually happen. */
  riskNudge: boolean;
  /** Light, dark, or follow the phone. */
  theme: "system" | "light" | "dark";
  /** The app's accent colour: the pet's own, or a fixed choice. */
  accent: "pet" | "coral" | "ocean" | "forest" | "berry" | "plum" | "slate";
  /** Show the 3D pet where one exists (dog, fox). Off means the 2D art everywhere. */
  pet3d: boolean;
  /** Missed check-ins only count from this day on (when the rule arrived), never retroactively. */
  neglectFrom: string | null;
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
  urges: Urge[];
  journal: JournalEntry[];
  /** AI weekly summaries keyed by week start (YYYY-MM-DD). */
  summaries: Record<string, string>;
  updatedAt: number;
}
