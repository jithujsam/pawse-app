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

/**
 * What tends to come before a slip. Chosen in onboarding; becomes the "What was going on?" question.
 * Negative states count as triggers (PRD 5.3); celebrating and autopilot are tracked but don't add severity.
 */
export const MOODS: { id: string; chip: string; label: string; trigger: boolean }[] = [
  { id: "stress", chip: "When I'm stressed", label: "Stressed", trigger: true },
  { id: "bored", chip: "When I'm bored", label: "Bored", trigger: true },
  { id: "lonely", chip: "When I'm lonely", label: "Lonely", trigger: true },
  { id: "tired", chip: "When I'm tired", label: "Tired", trigger: true },
  { id: "upset", chip: "When I'm upset or angry", label: "Upset or angry", trigger: true },
  { id: "celebrating", chip: "When I'm celebrating", label: "Celebrating", trigger: false },
  { id: "autopilot", chip: "Out of pure habit", label: "On autopilot", trigger: false },
];
/** Kept so habits created by earlier versions still read sensibly. */
export const TRIGGERS = MOODS.map((m) => ({ id: m.id, chip: m.chip, question: m.label }));
export const DEFAULT_MOODS = ["stress", "bored", "tired", "autopilot"];

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

const opt = (id: string, label: string, trigger = false) => ({ id, label, ...(trigger ? { trigger: true } : {}) });

/** What it was, in one tap, per kind of habit. */
function whatField(intake: Intake): Field {
  const gambling = /bet|gambl|casino|lotter|poker|slots/i.test(intake.what);
  const sets: Record<string, [string, string[]]> = {
    food_spending: ["What was it?", ["Delivery order", "Takeaway", "Snacks", "Sweets", "Other"]],
    impulse_buying: ["What did you buy?", ["Clothes", "Gadgets", "Home stuff", "Beauty", "Other"]],
    doomscrolling: ["Which app?", ["Instagram", "YouTube", "TikTok", "X", "Reddit", "Other"]],
    smoking: ["What was it?", ["Cigarette", "Vape", "Other"]],
    alcohol: ["What did you drink?", ["Beer", "Wine", "Spirits", "Cocktails", "Other"]],
    gambling: ["What was it?", ["Sports bet", "Casino or slots", "Lottery", "Cards", "Other"]],
  };
  const set = gambling ? sets.gambling : sets[intake.cls];
  if (!set) return { id: "what", label: "What happened?", type: "text", required: intake.measure === "none" };
  return { id: "what", label: set[0], type: "choice", required: false, options: set[1].map((l) => opt(l.toLowerCase().replace(/[^a-z]+/g, "_"), l)) };
}

/**
 * The check-in after a slip, built from what the person told us. Ordered like a functional analysis:
 * what it was, what led up to it (mood, urge, plan, place, company), and how it felt after.
 * Every question is one tap; only the amount is required, so logging stays under 15 seconds (PRD 3.4).
 */
export function buildFields(intake: Intake): Field[] {
  const fields: Field[] = [];
  const label = AMOUNT_LABEL[intake.measure];
  if (label) fields.push({ id: "amount", label, type: intake.measure === "money" ? "money" : "number", required: true, amount: true });
  fields.push(whatField(intake));
  const moods = MOODS.filter((m) => (intake.triggers.length ? intake.triggers : DEFAULT_MOODS).includes(m.id));
  fields.push({ id: "mood", label: "What was going on?", type: "multi", required: false, trigger: true, options: moods.map((m) => opt(m.id, m.label, m.trigger)) });
  fields.push({ id: "urge", label: "How strong was the urge?", type: "scale", required: false, scaleLabels: ["Barely", "Overwhelming"] });
  fields.push({ id: "plan", label: "Was it planned?", type: "choice", required: false, trigger: true, options: [opt("planned", "Planned"), opt("spur", "Spur of the moment", true), opt("more", "More than I planned", true)] });
  fields.push({ id: "where", label: "Where were you?", type: "choice", required: false, options: [opt("home", "Home"), opt("work", "Work or college"), opt("out", "Out"), opt("moving", "On the move")] });
  fields.push({ id: "who", label: "Who were you with?", type: "choice", required: false, trigger: true, options: [opt("alone", "Alone", true), opt("partner", "Partner or family"), opt("friends", "Friends"), opt("others", "Other people")] });
  fields.push({ id: "after", label: "How do you feel now?", type: "choice", required: false, options: [opt("better", "Better"), opt("same", "About the same"), opt("worse", "Worse"), opt("regret", "I regret it")] });
  fields.push({ id: "photo", label: "Photo (optional)", type: "photo", required: false });
  return fields;
}

/** The labels picked for a choice or multi answer. */
export function pickedLabels(f: Field, v: unknown): string[] {
  if (typeof v !== "string" || !v || !f.options) return [];
  const ids = f.type === "multi" ? v.split(",") : [v];
  return f.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
}

/** Trigger flags in one answer set: yes to a trigger question, or a picked trigger option. Late night counts too. */
export function countTriggers(fields: Field[], values: Record<string, string | boolean>, hour: number | null): number {
  let n = 0;
  for (const f of fields) {
    const v = values[f.id];
    if (f.type === "yesno") { if (f.trigger && v === true) n++; continue; }
    if ((f.type === "choice" || f.type === "multi") && typeof v === "string" && v) {
      const ids = f.type === "multi" ? v.split(",") : [v];
      n += (f.options ?? []).filter((o) => o.trigger && ids.includes(o.id)).length;
    }
  }
  const hasLateQuestion = fields.some((f) => f.id === "trg_late" || f.id === "late");
  if (!hasLateQuestion && hour !== null && (hour >= 22 || hour < 4)) n++;
  return n;
}
