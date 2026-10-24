import type { Stage } from "@detox/engine";
import type { Tone } from "./types";

const ordinal = (n: number) => (n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`);
const mo = (m: number) => { const r = Math.round(m * 10) / 10; return `${r} ${r === 1 ? "month" : "months"}`; };

export const TONES: { id: Tone; label: string; sample: string }[] = [
  { id: "gentle", label: "Gentle", sample: "Biscuit is a little tired today. Tomorrow is a fresh start." },
  { id: "honest", label: "Honest", sample: "That was the third order today. Biscuit lost 4 months." },
  { id: "brutal", label: "Brutal", sample: "Look at him. You did that. Again." },
];

export function slipLine(tone: Tone, name: string, months: number, nth: number): string {
  if (tone === "gentle") return `${name} is a little tired today. Tomorrow is a fresh start.`;
  if (tone === "brutal") return nth > 1 ? `Look at ${name}. You did that. Again.` : `${name} paid for that. You know it.`;
  return `That was the ${ordinal(nth)} slip today. ${name} lost ${mo(months)}.`;
}

export function cleanLine(tone: Tone, name: string, streak: number): string {
  if (tone === "gentle") return `${name} wags once, slowly. A good day.`;
  if (tone === "brutal") return streak > 1 ? `${streak} clean days. ${name} is noticing.` : `One clean day. That is all it is, so far.`;
  return streak > 1 ? `${streak} clean days in a row. ${name} is healing.` : `Clean today. ${name} gets to rest.`;
}

const STATUS: Record<Tone, Record<Stage, string>> = {
  gentle: {
    baby: "{n} is full of beans.", young: "{n} is bright and playful.", adult: "{n} is calm and well.",
    middle: "{n} is slowing down a little.", old: "{n} needs some quiet days.", frail: "{n} needs a good week.", dead: "{n} has gone.",
  },
  honest: {
    baby: "{n} is a puppy again.", young: "{n} is in good shape.", adult: "{n} is fine, for now.",
    middle: "{n} is slowing down.", old: "{n} is tired, and old before the time.", frail: "{n} is weak. A clean week would help a lot.", dead: "{n} is gone.",
  },
  brutal: {
    baby: "{n} has no idea yet.", young: "{n} still trusts you.", adult: "{n} is carrying it.",
    middle: "{n} is wearing it on the face.", old: "{n} is old before the time. That's the slips.", frail: "{n} is running out of life. Stop now.", dead: "{n} is dead.",
  },
};
export const statusLine = (tone: Tone, name: string, stage: Stage) => STATUS[tone][stage].replace("{n}", name);

export function waitingLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} is waiting for you. No pressure.`;
  if (tone === "brutal") return `${name} is waiting. Say what happened today.`;
  return `${name} is waiting for today's check-in.`;
}

export function deathLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} has gone to sleep. You gave them a life, and tomorrow can still be different.`;
  if (tone === "brutal") return `${name} is gone. Your next one doesn't have to go the same way.`;
  return `${name} has died. The next one starts today, and what you do next decides how it goes.`;
}

export function dyingBanner(name: string, age: number): string {
  return `${name} is at ${Math.round(age)} of 100. A few more slips will be the end.`;
}

export function verdict(tone: Tone, slips: number, prev: number): string {
  if (slips === 0 && prev === 0) return "Nothing logged in either week.";
  if (slips === 0) return tone === "gentle" ? "A clean week. That counts for a lot." : "No slips this week. That is a clean week.";
  if (prev === 0) return `${slips} ${slips === 1 ? "slip" : "slips"} this week against none last week.`;
  if (slips < prev) return `Down from ${prev} to ${slips}. That is progress, and it is real.`;
  if (slips === prev) return `Level with last week at ${slips}. Nothing moved.`;
  return tone === "brutal" ? `Up from ${prev} to ${slips}. It is getting worse.` : `Up from ${prev} to ${slips} slips.`;
}

export const DISCLAIMER =
  "This app is a self-awareness tool. It is not medical advice, diagnosis or treatment. If your habit is affecting your health or safety, please talk to a doctor or a counselor.";

export const CRISIS_MESSAGE =
  "That sounds heavy, and it matters more than any log. If you might hurt yourself, please contact local emergency services or a crisis line now, or reach someone you trust. In India you can call Tele-MANAS on 14416; in the US call or text 988. Nothing was saved.";

export const PROFESSIONAL_NOTE =
  "If this habit is affecting your health, talk to a doctor or counselor before changing it suddenly. Stopping alcohol abruptly can be dangerous.";

export const EFFECT_LABEL: Record<string, string> = {
  dull_coat: "The coat looks a little duller.", heavier: "Moving a bit slower.", labored_breathing: "Breathing a bit harder.",
  cough: "A small cough today.", thin: "Not much appetite.", glassy_eyes: "Eyes a little glassy.", trembling: "A bit shaky.",
  tired_eyes: "Eyes look tired.", slumped: "Sitting low today.", anxious: "Looking anxious.", worn_down: "Looking worn down.",
};

const EFFECTS: Record<string, [string[], string[]]> = {
  food_spending: [["heavier", "dull_coat"], ["labored_breathing", "heavier"]],
  smoking: [["cough"], ["cough", "thin"]],
  alcohol: [["glassy_eyes"], ["trembling", "glassy_eyes"]],
  doomscrolling: [["tired_eyes", "slumped"], ["slumped", "tired_eyes"]],
  impulse_buying: [["anxious"], ["anxious", "worn_down"]],
  custom: [["worn_down"], ["worn_down", "thin"]],
};
export const effectsFor = (cls: string, age: number) => (EFFECTS[cls] ?? EFFECTS.custom)[age >= 50 ? 1 : 0];

// ---------- greetings, milestones, onboarding ----------

const part = (h: number) => (h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night");

export function greeting(tone: Tone, hour: number): string {
  const p = part(hour);
  if (tone === "gentle") return p === "night" ? "Still up? Go easy tonight" : `Good ${p}`;
  if (tone === "brutal") return p === "night" ? "Late night. Be straight with yourself" : `${p[0].toUpperCase()}${p.slice(1)}. Be honest today`;
  return p === "night" ? "It's late" : `Good ${p}`;
}

export const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function milestoneLine(tone: Tone, name: string, days: number): { title: string; body: string } {
  if (tone === "gentle") return { title: `${days} gentle days`, body: `${name} is resting easier. You did that, one day at a time.` };
  if (tone === "brutal") return { title: `${days} days clean`, body: `${name} noticed. Don't make this the high point.` };
  return { title: `${days} clean days in a row`, body: `${name} is healing. Every clean day takes a little damage back.` };
}

/** What the companion would say in each tone, shown live while choosing. */
export function tonePreview(tone: Tone, name: string): string {
  const n = name.trim() || "Biscuit";
  if (tone === "gentle") return `${n} is a little tired today. Tomorrow is a fresh start.`;
  if (tone === "brutal") return `Look at ${n}. You did that. Again.`;
  return `That was the third slip today. ${n} lost 4 months.`;
}

export function hatchLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} is here, and glad to meet you.`;
  if (tone === "brutal") return `${name} is here. What happens next is on you.`;
  return `${name} is here. Brand new, age 0.`;
}

export function slipKicker(tone: Tone, name: string): string {
  if (tone === "gentle") return `Thank you for being honest. ${name} still loves you.`;
  if (tone === "brutal") return `Logged. ${name} felt that one.`;
  return `Logged honestly. That is how this works.`;
}

export function cleanToast(tone: Tone, name: string): string {
  if (tone === "gentle") return `A good day. ${name} is resting.`;
  if (tone === "brutal") return `Clean. One day. Keep going.`;
  return `Clean day logged. ${name} heals a little.`;
}

export function reminderLine(tone: Tone, name: string): { title: string; body: string } {
  if (tone === "gentle") return { title: `${name} is thinking of you`, body: "Whenever you're ready, a quick check-in." };
  if (tone === "brutal") return { title: `${name} is waiting`, body: "Say what happened today. Ten seconds." };
  return { title: `Check in with ${name}`, body: "Slipped or clean? It takes ten seconds." };
}
