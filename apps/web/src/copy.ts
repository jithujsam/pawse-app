import type { Stage } from "@detox/engine";
import type { Tone } from "./types";

const ordinal = (n: number) => (n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`);
/** A month amount in words: "1 month", "3.5 months". */
export const mo = (m: number) => { const r = Math.round(m * 10) / 10; return `${r} ${r === 1 ? "month" : "months"}`; };

export const TONES: { id: Tone; label: string; sample: string }[] = [
  { id: "gentle", label: "Gentle", sample: "Biscuit is a little tired today. Tomorrow is a fresh start, and you're not alone in it." },
  { id: "honest", label: "Honest", sample: "That was the third slip today. Biscuit lost 4 months. A good day starts healing it." },
  { id: "brutal", label: "Direct", sample: "That was slip three today. Biscuit felt it. Tonight can still go well." },
];

export function slipLine(tone: Tone, name: string, months: number, nth: number): string {
  if (tone === "gentle") return `${name} is a little tired today. Tomorrow is a fresh start.`;
  if (tone === "brutal") return nth > 1 ? `Slip ${nth} today: ${name} lost ${mo(months)}. Stop here and tonight still counts.` : `That cost ${name} ${mo(months)}. You can turn today around.`;
  return `That was the ${ordinal(nth)} slip today. ${name} lost ${mo(months)}. Good days win it back.`;
}

export function cleanLine(tone: Tone, name: string, streak: number): string {
  if (tone === "gentle") return `${name} wags once, slowly. A good day.`;
  if (tone === "brutal") return streak > 1 ? `${streak} good days. ${name} is noticing, and so should you.` : `One good day. That's how every streak starts.`;
  return streak > 1 ? `${streak} good days so far. ${name} is healing.` : `Goal met today. ${name} gets to rest.`;
}

const STATUS: Record<Tone, Record<Stage, string>> = {
  gentle: {
    baby: "{n} is full of beans.", young: "{n} is bright and playful.", adult: "{n} is calm and well.",
    middle: "{n} is slowing down a little.", old: "{n} needs some quiet days.", frail: "{n} needs a good week.", dead: "{n} has gone.",
  },
  honest: {
    baby: "{n} is a puppy again.", young: "{n} is in good shape.", adult: "{n} is fine, for now.",
    middle: "{n} is slowing down.", old: "{n} is tired, and old before the time.", frail: "{n} is weak. A slip-free week would help a lot.", dead: "{n} is gone.",
  },
  brutal: {
    baby: "{n} is brand new and full of life.", young: "{n} is strong. Keep it that way.", adult: "{n} is doing fine. Stay steady.",
    middle: "{n} is showing some wear. Good days will help.", old: "{n} has aged early. A good stretch would turn it around.", frail: "{n} is weak right now. Start a run of good days today.", dead: "{n} is gone.",
  },
};
export const statusLine = (tone: Tone, name: string, stage: Stage) => STATUS[tone][stage].replace("{n}", name);

export function waitingLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} is waiting for you. No pressure.`;
  if (tone === "brutal") return `${name} is waiting to hear how today went.`;
  return `${name} is waiting for today's check-in.`;
}

export function deathLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} has gone to sleep. You gave them a life, and tomorrow can still be different.`;
  if (tone === "brutal") return `${name} is gone. The next one can have a longer life, starting today.`;
  return `${name} has died. The next one starts today, and what you do next decides how it goes.`;
}

export function dyingBanner(tone: Tone, name: string, age: number): string {
  if (tone === "gentle") return `${name} is very tired right now (${Math.round(age)} of 100). Each day with your goal met helps them rest and recover.`;
  if (tone === "brutal") return `${name} is very frail: ${Math.round(age)} of 100. Days with your goal met are what bring them back.`;
  return `${name} is very frail at ${Math.round(age)} of 100. Days with your goal met help them recover.`;
}

/** Home, after a few days with nothing logged. Quiet days cost nothing; the line never scolds. */
export function welcomeBackLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `Hello again. ${name} is just happy to see you. No catching up needed.`;
  if (tone === "brutal") return `You're back. ${name} is ready. Check in for today and carry on.`;
  return `There you are! ${name} is glad you're back. No catching up needed: just today.`;
}

/** The slip card when the hidden reserve took some of the cost. */
export function absorbedLine(tone: Tone, name: string, streak: number, absorbed: number, all: boolean): string {
  const m = Math.round(absorbed * 10) / 10;
  if (all) {
    if (tone === "gentle") return `${streak} good days kept ${name} strong, so this one barely landed. The cushion is a little thinner now.`;
    if (tone === "brutal") return `${streak} good days absorbed this one. That cushion is thinner now; don't spend it all.`;
    return `${streak} good days made ${name} strong. This one was absorbed, but the cushion is thinner now.`;
  }
  if (tone === "gentle") return `${name}'s good days softened this: ${m} months of it never landed.`;
  if (tone === "brutal") return `Good days soaked up ${m} months of this. The rest counted.`;
  return `${name}'s strength from good days took ${m} months of it.`;
}

/** The slip card on a day with three or more slips. */
export function bingeLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `A heavy day. Part of it will stay with ${name} as a scar, but every good day from here still helps.`;
  if (tone === "brutal") return `Three or more slips today. Part of this is now permanent: ${name}'s life expectancy went down.`;
  return `Binge day. Part of today is now a permanent scar: ${name}'s life expectancy went down.`;
}

/** Health sheet, after two or more quiet days. */
export function quietBanner(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} heals on the days you check in. Quiet days don't cost anything, so pick up whenever you're ready.`;
  if (tone === "brutal") return `${name} only heals on days you check in. Quiet days cost nothing, but they don't heal either.`;
  return `${name} heals only on days you check in. Quiet days don't cost anything, so you can pick up again any time.`;
}

export function verdict(tone: Tone, slips: number, prev: number): string {
  if (slips === 0 && prev === 0) return "Nothing logged in either week.";
  if (slips === 0) return tone === "gentle" ? "A slip-free week. That counts for a lot." : "No slips this week. That's a slip-free week.";
  if (prev === 0) return `${slips} ${slips === 1 ? "slip" : "slips"} this week against none last week.`;
  if (slips < prev) return `Down from ${prev} to ${slips}. That is progress, and it is real.`;
  if (slips === prev) return `Level with last week at ${slips}. Nothing moved.`;
  return tone === "brutal" ? `Up from ${prev} to ${slips}. Next week can be better: start with today.` : `Up from ${prev} to ${slips} slips. A fresh week is a fresh start.`;
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

export function greeting(tone: Tone, hour: number, name = ""): string {
  const p = part(hour);
  const n = name.trim();
  const to = n ? `, ${n}` : "";
  if (tone === "gentle") return p === "night" ? `Still up${to}? Go easy tonight` : `Good ${p}${to}`;
  if (tone === "brutal") return p === "night" ? `Late night${to}. Choose well` : `Good ${p}${to}. Let's make it count`;
  return p === "night" ? `It's late${to}` : `Good ${p}${to}`;
}

export const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function milestoneLine(tone: Tone, name: string, days: number): { title: string; body: string } {
  if (tone === "gentle") return { title: `${days} days of care`, body: `${name} is resting easier. You did that, one day at a time.` };
  if (tone === "brutal") return { title: `${days} days of care`, body: `${days} days with your goal met or an urge managed. ${name} noticed. Keep going.` };
  return { title: `${days} days of care`, body: `Days with your goal met or an urge managed add up, and they never reset. ${name} is healing.` };
}

/** What the companion would say in each tone, shown live while choosing. */
export function tonePreview(tone: Tone, name: string): string {
  const n = name.trim() || "Biscuit";
  if (tone === "gentle") return `${n} is a little tired today. Tomorrow is a fresh start.`;
  if (tone === "brutal") return `That was slip three today. ${n} felt it. Tonight can still go well.`;
  return `That was the third slip today. ${n} lost 4 months. A good day starts healing it.`;
}

export function hatchLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} is here, and glad to meet you.`;
  if (tone === "brutal") return `${name} is here. Let's give them a long, good life.`;
  return `${name} is here. Brand new, age 0.`;
}

export function cleanToast(tone: Tone, name: string): string {
  if (tone === "gentle") return `A good day. ${name} is resting.`;
  if (tone === "brutal") return `Goal met. That's real progress.`;
  return `Goal met today. ${name} heals a little.`;
}

export function reminderLine(tone: Tone, name: string): { title: string; body: string } {
  if (tone === "gentle") return { title: `${name} is thinking of you`, body: "Whenever you're ready, a quick check-in." };
  if (tone === "brutal") return { title: `${name} is waiting`, body: "How did today go? Ten seconds." };
  return { title: `Check in with ${name}`, body: "Slip or goal met? It takes ten seconds." };
}

/** Shown when someone tries to track eating less, calories or weight (CLAUDE.md: never add restriction tracking). */
export const RESTRICTION_NOTE = "This app can't track eating less, calories or weight, and it won't. If food and eating feel hard right now, a doctor or counselor can really help. You can pick something else to watch, like money spent on orders.";

// ---------- pausing a track ----------

/** What pausing does, in the card menu. Plain about the rules in every tone: paused days count neither way. */
export function pauseHint(tone: Tone): string {
  if (tone === "gentle") return "Take a break whenever you need one. While this track is paused, days count neither way and its reminders stop. Anything you do log still counts.";
  if (tone === "brutal") return "Pausing stops this track's reminders. Paused days aren't wins or losses. Anything you log still counts.";
  return "Paused days count neither way: no progress and no slips. This track's reminders stop. Anything you log still counts.";
}

/** What the pet says while its track is paused and nothing is logged today. */
export function pausedLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `${name} is resting with you. Come back whenever you're ready.`;
  if (tone === "brutal") return `Paused. Nothing counts either way until you resume.`;
  return `Tracking is paused. ${name} is fine, and nothing changes while it's paused.`;
}

export function pauseToast(tone: Tone, name: string): string {
  if (tone === "gentle") return `Paused. ${name} will be here.`;
  if (tone === "brutal") return "Paused. No reminders for this track until you resume.";
  return "Paused. Reminders for this track are off.";
}

export function resumeToast(tone: Tone): string {
  if (tone === "gentle") return "Welcome back. Tracking is on again.";
  if (tone === "brutal") return "Resumed. Back to it.";
  return "Resumed. Reminders follow your settings again.";
}

export function resumeHint(tone: Tone): string {
  if (tone === "gentle") return "Resuming starts counting again from today, gently. Your reminders come back exactly as you set them.";
  if (tone === "brutal") return "Resuming counts from today. Your reminders come back as you set them.";
  return "Resuming starts counting again from today. Your reminders come back exactly as you set them.";
}

export function pauseRefused(tone: Tone): string {
  if (tone === "gentle") return "That couldn't change just now. Nothing was lost.";
  if (tone === "brutal") return "Couldn't change that. Nothing was lost.";
  return "That couldn't be changed. Nothing was lost.";
}

/** The update popup. Plain and calm in every tone: it never pushes. */
export const UPDATE_COPY: Record<Tone, { title: string; sub: string; now: string; later: string; skip: string; whatsNew: string }> = {
  gentle: { title: "Update available", sub: "A new version is ready whenever you are", now: "Download & install", later: "Later", skip: "Don't remind", whatsNew: "What's new" },
  honest: { title: "Update available", sub: "A new version is ready", now: "Download & install", later: "Later", skip: "Don't remind", whatsNew: "What's new" },
  brutal: { title: "Update available", sub: "A new version is out. Your call", now: "Download & install", later: "Later", skip: "Don't remind", whatsNew: "What's new" },
};
export const updatePhase = (percent: number | null): string | null => percent === null ? null : percent >= 100 ? "Checking the download…" : percent > 0 ? `Downloading ${percent}%` : "Starting the download…";
