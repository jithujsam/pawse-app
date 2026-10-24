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
  personality: z.enum(["playful", "calm", "sassy", "wise"]).optional(),
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

export const SettingsSchema = z.object({
  tone: z.enum(["gentle", "honest", "brutal"]),
  reminder: z.string().regex(/^\d{2}:\d{2}$/),
  currency: z.string().max(4),
  deathScene: z.boolean(),
  onboarded: z.boolean(),
  tint: z.enum(["ocean", "meadow", "blossom", "sunrise"]),
  goal: z.string().max(60),
  baseline: z.enum(["many_daily", "daily", "few_weekly", "weekly"]).nullable(),
  haptics: z.boolean(),
  remindersOn: z.boolean(),
  coachSeen: z.boolean(),
  celebrated: z.array(z.number().int()).max(50),
  autoLock: z.enum(["immediately", "1m", "5m", "never"]),
  wear: z.enum(["bandana", "bow", "flowers", "scarf", "glasses", "crown"]).nullable(),
  treatsGiven: z.number().int().min(0).max(100_000),
  fedOn: day.nullable(),
  careNotes: z.boolean(),
  savingsGoal: z.object({ label: z.string().min(1).max(40), target: z.number().min(1).max(100_000_000) }).nullable(),
  riskNudge: z.boolean(),
  neglectFrom: day.nullable(),
  pet3d: z.boolean(),
  theme: z.enum(["system", "light", "dark"]),
  accent: z.enum(["pet", "coral", "ocean", "forest", "berry", "plum", "slate"]),
  plan: PlanSchema.nullable(),
  restDays: z.array(day).max(4000),
  weekFocus: z.array(z.object({ week: day, text: short(160) })).max(60),
  petLife: z.enum(["continuity", "classic"]),
}).partial();

export const AppDataSchema = z.object({
  v: z.literal(1),
  settings: SettingsSchema,
  companions: z.array(CompanionSchema).max(500),
  habits: z.array(HabitSchema).max(50),
  entries: z.array(EntrySchema).max(100_000),
  cleanDays: z.array(CleanDaySchema).max(100_000),
  urges: z.array(UrgeSchema).max(100_000).default([]),
  journal: z.array(JournalSchema).max(20_000).default([]),
  summaries: z.record(z.string().max(800)).default({}),
  updatedAt: z.number().default(0),
});
export type StoredData = z.infer<typeof AppDataSchema>;

/** Parses stored data. Returns null rather than throwing, so a bad file can never crash the app. */
export function parseAppData(raw: unknown): StoredData | null {
  const r = AppDataSchema.safeParse(raw);
  return r.success ? r.data : null;
}
