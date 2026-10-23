import { DEFAULT_CLASS_WEIGHTS, type HabitClass } from "@detox/engine";
import type { Field, Habit } from "./types";

type Template = { cls: HabitClass; label: string; unit: Habit["unit"]; fields: Field[] };
const f = (id: string, label: string, type: Field["type"], extra: Partial<Field> = {}): Field => ({ id, label, type, required: false, ...extra });

export const TEMPLATES: Template[] = [
  { cls: "food_spending", label: "Food spending", unit: "money", fields: [
    f("amount", "How much did you spend?", "money", { required: true, amount: true }),
    f("what", "What was it?", "text"),
    f("late", "Was it late at night?", "yesno", { trigger: true }),
    f("extra", "Was it extra, beyond what you planned?", "yesno", { trigger: true }),
    f("photo", "Photo (optional)", "photo"),
  ] },
  { cls: "impulse_buying", label: "Impulse buying", unit: "money", fields: [
    f("amount", "How much did you spend?", "money", { required: true, amount: true }),
    f("what", "What did you buy?", "text"),
    f("stress", "Were you stressed?", "yesno", { trigger: true }),
    f("extra", "Was it unplanned?", "yesno", { trigger: true }),
    f("photo", "Photo (optional)", "photo"),
  ] },
  { cls: "doomscrolling", label: "Doomscrolling", unit: "minutes", fields: [
    f("amount", "How many minutes?", "number", { required: true, amount: true }),
    f("where", "Which app?", "text"),
    f("late", "Was it late at night?", "yesno", { trigger: true }),
    f("alone", "Were you alone?", "yesno", { trigger: true }),
  ] },
  { cls: "smoking", label: "Smoking or vaping", unit: "count", fields: [
    f("amount", "How many?", "number", { required: true, amount: true }),
    f("where", "Where were you?", "text"),
    f("stress", "Were you stressed?", "yesno", { trigger: true }),
    f("extra", "Was it more than you planned?", "yesno", { trigger: true }),
  ] },
  { cls: "alcohol", label: "Alcohol", unit: "count", fields: [
    f("amount", "How many drinks?", "number", { required: true, amount: true }),
    f("where", "Where were you?", "text"),
    f("late", "Was it late at night?", "yesno", { trigger: true }),
    f("alone", "Were you alone?", "yesno", { trigger: true }),
  ] },
  { cls: "custom", label: "Something else", unit: "none", fields: [
    f("what", "What happened?", "text", { required: true }),
    f("stress", "Were you stressed?", "yesno", { trigger: true }),
    f("extra", "Was it more than you planned?", "yesno", { trigger: true }),
  ] },
];

export const templateFor = (cls: HabitClass) => TEMPLATES.find((t) => t.cls === cls)!;
export const weightFor = (cls: HabitClass) => DEFAULT_CLASS_WEIGHTS[cls];
