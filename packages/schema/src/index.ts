import { z } from "zod";

/** The tags the companion art supports. The AI may only pick from these. */
export const EFFECT_VOCAB = [
  "dull_coat", "heavier", "labored_breathing", "cough", "thin", "glassy_eyes",
  "trembling", "tired_eyes", "slumped", "anxious", "worn_down",
] as const;
export type EffectTag = (typeof EFFECT_VOCAB)[number];

/**
 * Words AI text must never contain: medical claims, insults, food and weight talk, and anything that makes the pet's
 * care conditional or blames the person for a quiet day (PRD §22.2, RECOVERY_RULES rule 1).
 */
const BANNED = /\b(diagnos\w*|cancer|disease|cirrhosis|liver failure|heart attack|stroke|will die|going to die|addicted|addict|loser|stupid|idiot|pathetic|worthless|disgusting|weak|failure|hopeless|weight|calori\w*|diet\w*|obes\w*|fat|skinny|starv\w*|disappoint\w*|ashamed|shame\w*|lonely|abandon\w*|punish\w*|deserve\w*|earn(ed)?|won'?t eat|refus\w*)\b/i;
export const isSafeText = (t: string) => !BANNED.test(t);

export const AiSlipResult = z.object({
  ai_adjust_pct: z.number().min(-30).max(30),
  body_effects: z.array(z.enum(EFFECT_VOCAB)).max(3),
  explanation: z.string().trim().min(1).max(140).refine(isSafeText, "unsafe wording"),
}).strict();
export type AiSlipResult = z.infer<typeof AiSlipResult>;

export const AiWeeklyResult = z.object({
  summary: z.string().trim().min(20).max(700).refine(isSafeText, "unsafe wording").refine((t) => /\d/.test(t), "must cite a number"),
}).strict();
export type AiWeeklyResult = z.infer<typeof AiWeeklyResult>;

/** The pet's personalities. "savage" is shown as Brutal (see apps/web/src/pets.ts). */
export const PERSONALITY_IDS = ["playful", "calm", "sassy", "wise", "savage"] as const;

/** One line the pet says: short, first person, no markup. */
const petLine = z.string().trim().min(3).max(120).refine(isSafeText, "unsafe wording").refine((t) => !/[{}<>#]/.test(t), "no markup");

/**
 * A day's worth of lines in the pet's own personality (PRD §24): the Home speech bubble for each moment, and the
 * notification bodies. Each one is optional polish: the hand-written line stands whenever this is missing or invalid.
 */
export const AiPetResult = z.object({
  waiting: petLine, goal_met: petLine, after_slip: petLine, away: petLine, morning: petLine, risk: petLine, thanks: petLine,
}).strict();
export type AiPetResult = z.infer<typeof AiPetResult>;

/** What the app sends to the AI function. Free text is data, never instructions. */
export const SlipRequest = z.object({
  kind: z.literal("slip"),
  tone: z.enum(["gentle", "honest", "brutal"]),
  /** The pet's personality, so the sentence sounds like this pet. Missing on older builds. */
  personality: z.enum(PERSONALITY_IDS).optional(),
  habitClass: z.string().max(40),
  companionName: z.string().max(20),
  amount: z.number().nullable(),
  unit: z.enum(["money", "count", "minutes", "none"]),
  median: z.number().nullable(),
  triggers: z.array(z.string().max(60)).max(8),
  texts: z.array(z.string().max(80)).max(4),
  nthToday: z.number().int().min(1).max(50),
  baselineMonths: z.number().min(0).max(12),
  last7Slips: z.number().int().min(0).max(500),
});
export const WeeklyRequest = z.object({
  kind: z.literal("weekly"),
  tone: z.enum(["gentle", "honest", "brutal"]),
  habitClass: z.string().max(40),
  companionName: z.string().max(20),
  unit: z.enum(["money", "count", "minutes", "none"]),
  thisWeek: z.object({ slips: z.number(), spend: z.number(), months: z.number() }),
  lastWeek: z.object({ slips: z.number(), spend: z.number(), months: z.number() }),
  worstWeekday: z.string().max(12).nullable(),
  age: z.number().min(0).max(100),
  currency: z.string().max(4),
});
/** The facts for a day's pet lines. No notes, amounts or anything the person typed: only counts and the pet itself. */
export const PetRequest = z.object({
  kind: z.literal("pet"),
  tone: z.enum(["gentle", "honest", "brutal"]),
  personality: z.enum(PERSONALITY_IDS),
  species: z.string().max(12),
  companionName: z.string().max(20),
  habitClass: z.string().max(40),
  /** Today (YYYY-MM-DD): one set of lines per pet per day. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  streak: z.number().int().min(0).max(10000),
  quietDays: z.number().int().min(0).max(10000),
  last7Slips: z.number().int().min(0).max(500),
  stage: z.string().max(10),
});
export type PetRequest = z.infer<typeof PetRequest>;
export type SlipRequest = z.infer<typeof SlipRequest>;
export type WeeklyRequest = z.infer<typeof WeeklyRequest>;
export * from "./data";
