import type { HabitClass } from "@detox/engine";
import type { Field, Measure } from "./types";

export interface Intake {
  what: string;
  measure: Measure;
  /** What the person wants to count each time, in their own words ("cigarettes", "minutes", "₹ spent"). */
  amountLabel?: string;
  triggers: string[];
  cls: HabitClass;
}

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

/** How an amount in the person's own words is used: money, minutes or a plain count. Nothing typed means no amount. */
export function inferMeasureFromLabel(label: string): Measure {
  const t = label.trim();
  if (!t) return "none";
  if (/spen[dt]|cost|price|money|paid|pay\b|bill|[₹$€£]|\brs\b|rupee|dollar|euro|pound/i.test(t)) return "money";
  if (/min|hour|\bhrs?\b|second|time/i.test(t)) return "minutes";
  return "count";
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
  fields.push({ id: "after", label: "How do you feel now?", type: "choice", required: false, options: [opt("better", "Better"), opt("same", "About the same"), opt("worse", "Worse"), opt("regret", "Not happy about it")] });
  fields.push({ id: "photo", label: "Photo (optional)", type: "photo", required: false });
  return fields;
}

/**
 * The check-in for a new track: only what the person asked for. An amount they named in their own words
 * (optional), a free note and an optional photo. Anything more they add themselves under Your plan, Questions.
 */
export function starterFields(intake: Intake): Field[] {
  const label = (intake.amountLabel ?? "").trim().slice(0, 40);
  const fields: Field[] = [];
  if (label && intake.measure !== "none") fields.push({ id: "amount", label, type: intake.measure === "money" ? "money" : "number", required: true, amount: true });
  fields.push({ id: "note", label: "Notes (optional)", type: "text", required: false });
  fields.push({ id: "photo", label: "Photo (optional)", type: "photo", required: false });
  return fields;
}

/** Marks a choice or multi answer the person typed themselves instead of picking from the list. */
export const OTHER_PREFIX = "other:";
/** Stored form of a typed answer. Commas are dropped because multi answers are comma-separated. */
export const otherAnswer = (text: string) => `${OTHER_PREFIX}${text.replace(/,/g, " ").slice(0, 40)}`;

/** The labels picked for a choice or multi answer, plus anything the person typed under "Other". */
export function pickedLabels(f: Field, v: unknown): string[] {
  if (typeof v !== "string" || !v) return [];
  const ids = f.type === "multi" ? v.split(",") : [v];
  const known = (f.options ?? []).filter((o) => ids.includes(o.id)).map((o) => o.label);
  const own = ids.filter((i) => i.startsWith(OTHER_PREFIX)).map((i) => i.slice(OTHER_PREFIX.length).trim()).filter(Boolean);
  return [...known, ...own];
}

/** Common behaviours people want to change, in plain words. "Other" is always available in the form. */
export const HABIT_CHOICES = [
  "Smoking or vaping", "Drinking alcohol", "Scrolling on my phone or social media", "Online shopping or impulse buying",
  "Ordering food or takeaway", "Betting or gambling", "Playing games", "Caffeine or energy drinks", "Biting nails or picking skin",
];

/** What to note each time. The measure is stated, not guessed, so "Minutes spent" can't be read as money. */
export const AMOUNT_CHOICES: { label: string; measure: Measure }[] = [
  { label: "How many", measure: "count" },
  { label: "Money spent", measure: "money" },
  { label: "Minutes spent", measure: "minutes" },
];

/** Chosen in an amount dropdown to mean "nothing to count"; it is stored as an empty label. */
export const NO_AMOUNT = "__none";

/** The measure for an amount label: a listed choice wins, anything the person typed is read from its words. */
export function measureForLabel(label: string): Measure {
  return AMOUNT_CHOICES.find((a) => a.label === label.trim())?.measure ?? inferMeasureFromLabel(label);
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
