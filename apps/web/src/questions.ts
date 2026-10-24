import type { HabitClass } from "@detox/engine";
import type { Field, Measure } from "./types";

export interface Intake {
  what: string;
  measure: Measure;
  triggers: string[];
  cls: HabitClass;
}

export const SUGGESTIONS: { label: string; cls: HabitClass; measure: Measure }[] = [
  { label: "Ordering food I didn't plan", cls: "food_spending", measure: "money" },
  { label: "Impulse shopping", cls: "impulse_buying", measure: "money" },
  { label: "Doomscrolling", cls: "doomscrolling", measure: "minutes" },
  { label: "Smoking or vaping", cls: "smoking", measure: "count" },
  { label: "Drinking", cls: "alcohol", measure: "count" },
  { label: "Betting or gambling", cls: "custom", measure: "money" },
];

export const TRIGGERS: { id: string; chip: string; question: string }[] = [
  { id: "late", chip: "Late at night", question: "Was it late at night?" },
  { id: "stress", chip: "When I'm stressed", question: "Were you stressed?" },
  { id: "alone", chip: "When I'm alone", question: "Were you on your own?" },
  { id: "bored", chip: "When I'm bored", question: "Were you bored?" },
  { id: "social", chip: "With other people", question: "Were other people around?" },
  { id: "tired", chip: "When I'm tired", question: "Were you tired?" },
];

const RULES: [RegExp, HabitClass][] = [
  [/smok|vap|cigar|nicotin|tobacco|hookah/i, "smoking"],
  [/drink|alcohol|beer|wine|whisk|vodka|booze|liquor/i, "alcohol"],
  [/scroll|reel|short|tiktok|instagram|youtube|twitter|social media|phone|screen/i, "doomscrolling"],
  [/shop|buy|purchas|amazon|cart|spend/i, "impulse_buying"],
  [/food|order|deliver|swiggy|zomato|takeaway|snack|junk|sweets|eat/i, "food_spending"],
];

export function inferClass(text: string): HabitClass {
  return RULES.find(([re]) => re.test(text))?.[1] ?? "custom";
}

export function inferMeasure(cls: HabitClass): Measure {
  return ({ food_spending: "money", impulse_buying: "money", doomscrolling: "minutes", smoking: "count", alcohol: "count", custom: "none" } as const)[cls];
}

/** This product never tracks eating less, calories or weight. */
export function isRestrictionRelated(text: string): boolean {
  return /calori|weigh|diet\b|dieting|starv|purg|skip(ping)? (meals|food)|eat(ing)? less|fasting|too fat|binge/i.test(text);
}

const AMOUNT_LABEL: Record<Measure, string | null> = {
  money: "How much did you spend?",
  count: "How many?",
  minutes: "How many minutes?",
  none: null,
};

/** Builds the daily questions from what the person told us, in a fixed, predictable order. */
export function buildFields(intake: Intake): Field[] {
  const fields: Field[] = [];
  const label = AMOUNT_LABEL[intake.measure];
  if (label) fields.push({ id: "amount", label, type: intake.measure === "money" ? "money" : "number", required: true, amount: true });
  fields.push({ id: "what", label: intake.measure === "none" ? "What happened?" : "What was it?", type: "text", required: intake.measure === "none" });
  fields.push({ id: "where", label: "Where were you?", type: "text", required: false });
  for (const id of intake.triggers) {
    const t = TRIGGERS.find((x) => x.id === id);
    if (t) fields.push({ id: `trg_${t.id}`, label: t.question, type: "yesno", required: false, trigger: true });
  }
  fields.push({ id: "extra", label: "Was it more than you planned?", type: "yesno", required: false, trigger: true });
  fields.push({ id: "photo", label: "Photo (optional)", type: "photo", required: false });
  return fields;
}

export const unitFor = (m: Measure) => m;
