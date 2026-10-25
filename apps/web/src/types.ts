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
  /** The track this companion belongs to. Filled on load; a companion belongs to exactly one track. */
  trackId?: string;
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
  /**
   * The track's own state and settings. Always present in loaded data; optional so a habit built in memory
   * still works. Read it through trackState() in tracks.ts, which fills the defaults.
   */
  track?: TrackState;
}

/** A recovery track: one behaviour the person wants to change. The Habit row is the track; this is its state. */
export type TrackStatus = "active" | "paused" | "archived";

/** One pause: from the first paused day to the day it ended (null while still paused). */
export interface Pause { from: string; to: string | null }

export interface TrackState {
  /** What this is about, in the person's own words. */
  description: string;
  /** The day the track began. Never later than its first recorded event. */
  startedOn: string;
  status: TrackStatus;
  /** Every pause, oldest first. At most one is open (to = null), and only while status is paused. */
  pauses: Pause[];
  archivedOn: string | null;
  /** When the track was made (ms), for a stable order. */
  createdAt: number;
  /** How often it happened before they started, as they described it. */
  baseline: Baseline | null;
  /** The person's plan for this track. plan.goal is the track's goal. */
  plan: RecoveryPlan | null;
  /** Days the person chose not to track. Neither progress nor a lapse; never counted either way. */
  restDays: string[];
  /** One adjustment per reviewed week. */
  weekFocus: WeekFocus[];
  /** Milestones already celebrated, so each fires once. */
  celebrated: number[];
  /** What this track's companion is wearing, if anything. */
  wear: Accessory | null;
  /** Treats handed out so far. Treats earned = clean days; the difference is what's in the jar. */
  treatsGiven: number;
  /** The last day the companion ate (YYYY-MM-DD). */
  fedOn: string | null;
  /** Something to save the money toward (money habits). */
  savingsGoal: SavingsGoal | null;
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
  /** rode_it_out: the person managed it without acting on it. slipped: they acted on it. */
  outcome: "rode_it_out" | "slipped";
  createdAt: number;
  /** The coping strategy the person was using when it ended, if they picked one. */
  strategy?: StrategyId | null;
  /** What they said set it off, if anything (a mood or situation label, in their words). */
  trigger?: string | null;
}

/** Ways to get through an urge. The person can switch between them at any point. */
export type StrategyId = "observe" | "name" | "move" | "friction" | "breathe" | "replace" | "reach";

/** What the person is aiming for. Their goal, not ours. */
export type GoalKind = "stop" | "reduce" | "understand";

/** The person's own plan: why, what's hard, what helps, and one realistic next step. Everything is optional. */
export interface RecoveryPlan {
  goal: GoalKind | null;
  /** Reasons for change, in their words (chip labels or typed). */
  reasons: string[];
  /** Situations that tend to be difficult (late at night, payday...). */
  situations: string[];
  /** One small, realistic first step. */
  firstStep: string;
  /** Strategies they'd like offered first when an urge hits, in order. */
  strategies: StrategyId[];
  /** Someone they could reach out to. A name only: no numbers or contacts are stored. */
  supportName: string;
  /** If-then plans, mostly added after a lapse ("If I'm home alone after 10, then I'll ..."). */
  ifThen: string[];
}

/** The one adjustment picked in a weekly review, for the week that follows it. */
export interface WeekFocus { week: string; text: string }

/** One short reflection per day. */
export interface JournalEntry { day: string; mood: number; body: string }

export interface SavingsGoal { label: string; target: number }

export interface Settings {
  tone: Tone;
  /** What the companion calls the person. Optional; empty means no name is used. */
  userName: string;
  reminder: string;
  currency: string;
  deathScene: boolean;
  onboarded: boolean;
  /** Legacy colour choice, no longer used. */
  tint?: Tint;
  haptics: boolean;
  /** The person agreed to a daily check-in reminder. */
  remindersOn: boolean;
  /** First-run tips on Home have been shown. */
  coachSeen: boolean;
  /** How long the app may sit in the background before the PIN is asked again. */
  autoLock: AutoLock;
  /** Care notifications in the companion's voice (thank-yous, hunger strikes). */
  careNotes: boolean;
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
  /**
   * continuity: the companion can become very frail but never dies, and all damage can heal back.
   * classic: the PRD rules, with death at 100, a permanent scar floor and binge scars.
   */
  petLife: "continuity" | "classic";
  /** The track the single-pet screens show on this phone. UI state only: never synced, never recovery data. */
  focusTrackId: string | null;
}

export type AutoLock = "immediately" | "1m" | "5m" | "never";

export type Baseline = "many_daily" | "daily" | "few_weekly" | "weekly";

export interface AppData {
  v: 2;
  settings: Settings;
  companions: Companion[];
  habits: Habit[];
  entries: Entry[];
  cleanDays: CleanDay[];
  urges: Urge[];
  journal: JournalEntry[];
  /** AI weekly summaries, by track id, then week start (YYYY-MM-DD). */
  summaries: Record<string, Record<string, string>>;
  updatedAt: number;
}
