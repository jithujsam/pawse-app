import { z } from "zod";

/** The tags the companion art supports. The AI may only pick from these. */
export const EFFECT_VOCAB = [
  "dull_coat", "heavier", "labored_breathing", "cough", "thin", "glassy_eyes",
  "trembling", "tired_eyes", "slumped", "anxious", "worn_down",
] as const;
export type EffectTag = (typeof EFFECT_VOCAB)[number];

/** Words an explanation or summary must never contain: medical claims and insults. */
const BANNED = /\b(diagnos\w*|cancer|disease|cirrhosis|liver failure|heart attack|stroke|will die|going to die|addicted|addict|loser|stupid|idiot|pathetic|worthless|disgusting|weak|failure|hopeless)\b/i;
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

/** What the app sends to the AI function. Free text is data, never instructions. */
export const SlipRequest = z.object({
  kind: z.literal("slip"),
  tone: z.enum(["gentle", "honest", "brutal"]),
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
export type SlipRequest = z.infer<typeof SlipRequest>;
export type WeeklyRequest = z.infer<typeof WeeklyRequest>;
export * from "./data";
