import { z } from "zod";

/** What the app keeps on the phone. Everything loaded from storage, a backup file or the server passes through here. */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(64);
const habitClass = z.enum(["food_spending", "impulse_buying", "doomscrolling", "smoking", "alcohol", "custom"]);
const unit = z.enum(["money", "count", "minutes", "none"]);

export const FieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().max(120),
  type: z.enum(["text", "number", "money", "yesno", "photo", "choice", "multi", "scale"]),
  required: z.boolean(),
  trigger: z.boolean().optional(),
  amount: z.boolean().optional(),
  options: z.array(z.object({ id: z.string().min(1).max(40), label: z.string().max(40), trigger: z.boolean().optional() })).max(12).optional(),
  scaleLabels: z.tuple([z.string().max(20), z.string().max(20)]).optional(),
});

export const CompanionSchema = z.object({
  id,
  species: z.enum(["dog", "cat", "rabbit", "fox", "owl", "panda"]),
  name: z.string().min(1).max(20),
  bornOn: day,
  diedOn: day.nullable(),
  finalAge: z.number().min(0).max(100).nullable(),
  coat: z.string().regex(/^[a-z_]{1,20}$/).optional(),
  breed: z.string().regex(/^[a-z_]{1,20}$/).optional(),
  personality: z.enum(["playful", "calm", "sassy", "wise"]).optional(),
  /** The track this companion belongs to (v2). Filled on load for older data. */
  trackId: id.optional(),
  /** Adoption mode (PRD §23). Missing means raise. */
  adoption: z.enum(["raise", "rescue"]).optional(),
  /** Mission memory: completions and celebrations only; progress is recomputed. */
  missions: z.object({
    v: z.number().int().min(1).max(100),
    done: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(100),
    seen: z.array(z.string().regex(/^[a-z_]{1,40}(:[a-z_0-9]{1,40})?(:\d{4}-\d{2}-\d{2})?$/)).max(1000),
    target: z.union([z.literal(30), z.literal(60), z.literal(120)]).optional(),
    // Older builds kept a pet-days count here; read and ignored.
    petDays: z.number().int().min(0).max(100000).optional(),
    petOn: day.nullable().optional(),
  }).optional(),
});

export const HabitSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  cls: habitClass,
  classWeight: z.number().min(0.1).max(3),
  companionId: id,
  fields: z.array(FieldSchema).max(20),
  unit,
});

export const EntrySchema = z.object({
  id,
  habitId: id,
  companionId: id,
  day,
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  /** Photos are data URLs and can be large; text answers are short. */
  values: z.record(z.union([z.string().max(2_000_000), z.boolean()])),
  amount: z.number().min(0).max(10_000_000).nullable(),
  months: z.number().min(0).max(24),
  severity: z.number().min(0).max(3),
  effects: z.array(z.string().max(40)).max(6),
  explanation: z.string().max(200),
  source: z.enum(["baseline", "ai"]).default("baseline"),
  aiAdjustPct: z.number().min(-30).max(30).nullable().default(null),
  createdAt: z.number(),
});

const strategy = z.enum(["observe", "name", "move", "friction", "breathe", "replace", "reach"]);
const short = (n: number) => z.string().max(n);

export const PlanSchema = z.object({
  goal: z.enum(["stop", "reduce", "understand"]).nullable(),
  reasons: z.array(short(80)).max(8),
  situations: z.array(short(60)).max(8),
  firstStep: short(140),
  strategies: z.array(strategy).max(7),
  supportName: short(40),
  ifThen: z.array(short(160)).max(8),
});

export const CleanDaySchema = z.object({ habitId: id, day });

export const UrgeSchema = z.object({
  id, habitId: id, day,
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
  strength: z.number().int().min(1).max(5),
  outcome: z.enum(["rode_it_out", "slipped"]),
  createdAt: z.number(),
  strategy: strategy.nullable().optional(),
  trigger: z.string().max(40).nullable().optional(),
});

export const JournalSchema = z.object({ day, mood: z.number().int().min(1).max(5), body: z.string().max(600) });

const accessory = z.enum(["bandana", "bow", "flowers", "scarf", "glasses", "crown"]);
const baseline = z.enum(["many_daily", "daily", "few_weekly", "weekly"]);
const savingsGoal = z.object({ label: z.string().min(1).max(40), target: z.number().min(1).max(100_000_000) });
const weekFocus = z.array(z.object({ week: day, text: short(160) })).max(60);

/** One pause: from the first paused day up to, not including, the day it ended (null while still paused). */
export const PauseSchema = z.object({ from: day, to: day.nullable() });

/**
 * Settings that belong to the person or this phone. Per-track settings live in TrackStateSchema.
 * Unknown keys are kept (passthrough): a field added by a newer app version survives being loaded and saved
 * again by this one, instead of being dropped from the account's profile.
 */
export const SettingsSchema = z.object({
  tone: z.enum(["gentle", "honest", "brutal"]),
  userName: short(30),
  activeHabit: z.string().max(64).nullable(),
  reminder: z.string().regex(/^\d{2}:\d{2}$/),
  currency: z.string().max(4),
  deathScene: z.boolean(),
  onboarded: z.boolean(),
  tint: z.enum(["ocean", "meadow", "blossom", "sunrise"]),
  haptics: z.boolean(),
  remindersOn: z.boolean(),
  coachSeen: z.boolean(),
  autoLock: z.enum(["immediately", "1m", "5m", "never"]),
  careNotes: z.boolean(),
  riskNudge: z.boolean(),
  neglectFrom: day.nullable(),
  pet3d: z.boolean(),
  theme: z.enum(["system", "light", "dark"]),
  accent: z.enum(["pet", "coral", "ocean", "forest", "berry", "plum", "slate"]),
  petLife: z.enum(["continuity", "classic"]),
}).partial().passthrough();

/**
 * Settings as stored before tracks had their own state (v1). Read only to migrate. Two shapes exist:
 * single-track data (per-track settings sat here directly) and the interim multi-track shape on main, which added
 * per-habit maps (trackRest, pauses, celebratedBy) next to the still-shared ones.
 */
export const LegacySettingsSchema = SettingsSchema.extend({
  goal: z.string().max(60),
  baseline: baseline.nullable(),
  celebrated: z.array(z.number().int()).max(50),
  wear: accessory.nullable(),
  treatsGiven: z.number().int().min(0).max(100_000),
  fedOn: day.nullable(),
  savingsGoal: savingsGoal.nullable(),
  plan: PlanSchema.nullable(),
  restDays: z.array(day).max(4000),
  weekFocus,
  trackRest: z.record(z.array(day).max(4000)),
  pauses: z.record(z.array(PauseSchema).max(500)),
  celebratedBy: z.record(z.array(z.number().int()).max(50)),
}).partial().passthrough();

/** Everything that belongs to one recovery track rather than to the person. Unknown keys are kept, as for settings. */
export const TrackStateSchema = z.object({
  description: short(280),
  startedOn: day,
  status: z.enum(["active", "paused", "archived"]),
  pauses: z.array(PauseSchema).max(500),
  archivedOn: day.nullable(),
  createdAt: z.number(),
  baseline: baseline.nullable(),
  plan: PlanSchema.nullable(),
  restDays: z.array(day).max(4000),
  weekFocus,
  celebrated: z.array(z.number().int()).max(50),
  wear: accessory.nullable(),
  treatsGiven: z.number().int().min(0).max(100_000),
  fedOn: day.nullable(),
  savingsGoal: savingsGoal.nullable(),
}).passthrough();

export const TrackHabitSchema = HabitSchema.extend({ track: TrackStateSchema.optional() });

const rowsOf = {
  companions: z.array(CompanionSchema).max(500),
  entries: z.array(EntrySchema).max(100_000),
  cleanDays: z.array(CleanDaySchema).max(100_000),
  urges: z.array(UrgeSchema).max(100_000).default([]),
  journal: z.array(JournalSchema).max(20_000).default([]),
  updatedAt: z.number().default(0),
};

/** v1: one habit; per-track settings in settings; summaries keyed by week. */
export const AppDataV1Schema = z.object({
  v: z.literal(1),
  settings: LegacySettingsSchema,
  habits: z.array(HabitSchema).max(50),
  summaries: z.record(z.string().max(800)).default({}),
  ...rowsOf,
});
export type StoredDataV1 = z.infer<typeof AppDataV1Schema>;

/** v2: many tracks; each habit carries its track state; summaries keyed by track, then week. */
export const AppDataSchema = z.object({
  v: z.literal(2),
  settings: SettingsSchema,
  habits: z.array(TrackHabitSchema).max(50),
  summaries: z.record(z.record(z.string().max(800))).default({}),
  ...rowsOf,
});
export type StoredData = z.infer<typeof AppDataSchema>;

/** Parses stored data. Returns null rather than throwing, so a bad file can never crash the app. */
export function parseAppData(raw: unknown): StoredData | null {
  const r = AppDataSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Parses data saved before tracks (v1). Null when it isn't valid v1 data. */
export function parseAppDataV1(raw: unknown): StoredDataV1 | null {
  const r = AppDataV1Schema.safeParse(raw);
  return r.success ? r.data : null;
}
