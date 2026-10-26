import type { Stage } from "@detox/engine";
import type { Tone } from "./types";
import { monthsText, plural } from "./format";
import { t, tt } from "./text";

const ordinal = (n: number) => (n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`);
const mo = monthsText;

/**
 * One message in all three Voices. Every call site gives all three, so the compiler catches a missing one, and an
 * unknown or missing tone (old data, a newer build) reads as Honest instead of showing nothing.
 */
export const byTone = <T,>(tone: Tone, set: Readonly<Record<Tone, T>>): T => set[tone] ?? set.honest;
export const TONE_IDS: readonly Tone[] = ["gentle", "honest", "brutal"];

/** What a Voice is called on screen. The stored id for Direct is still "brutal". */
export const TONE_LABEL: Record<Tone, string> = { gentle: "Gentle", honest: "Honest", brutal: "Direct" };
export const toneLabel = (tone: Tone): string => TONE_LABEL[tone] ?? TONE_LABEL.honest;

export const TONES: { id: Tone; label: string; sample: string }[] = TONE_IDS.map((id) => ({ id, label: TONE_LABEL[id], sample: tonePreview(id, "Biscuit") }));

export function slipLine(tone: Tone, name: string, months: number, nth: number): string {
  return byTone(tone, {
    gentle: `${name} is a little tired today. Tomorrow is a fresh start.`,
    honest: `That was the ${ordinal(nth)} slip today. ${name} lost ${mo(months)}. Goal-met days win it back.`,
    brutal: nth > 1 ? `Slip ${nth} today: ${name} lost ${mo(months)}. Stop here and tonight still counts.` : `That cost ${name} ${mo(months)}. You can turn today around.`,
  });
}

export function cleanLine(tone: Tone, name: string, streak: number): string {
  return byTone(tone, {
    gentle: `${name} wags once, slowly. A good day.`,
    honest: streak > 1 ? `${streak} good days so far. ${name} is healing.` : `Goal met today. ${name} gets to rest.`,
    brutal: streak > 1 ? `${streak} good days. ${name} is noticing, and so should you.` : `One good day. That's how every streak starts.`,
  });
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
export const statusLine = (tone: Tone, name: string, stage: Stage) => (STATUS[tone] ?? STATUS.honest)[stage].replace("{n}", name);

export function waitingLine(tone: Tone, name: string): string {
  return byTone(tone, { gentle: `${name} is here whenever you're ready. No pressure.`, honest: `${name} is waiting for today's check-in.`, brutal: `${name} is waiting to hear how today went.` });
}

export function deathLine(tone: Tone, name: string): string {
  return byTone(tone, {
    gentle: `${name} has gone to sleep. You gave them a life, and tomorrow can still be different.`,
    honest: `${name} has died. The next one starts today, and what you do next decides how it goes.`,
    brutal: `${name} is gone. The next one can have a longer life, starting today.`,
  });
}

export function dyingBanner(tone: Tone, name: string, age: number): string {
  const a = Math.round(age);
  return byTone(tone, {
    gentle: `${name} is very tired right now (${a} of 100). Each day with your goal met helps them rest and recover.`,
    honest: `${name} is very frail at ${a} of 100. Days with your goal met help them recover.`,
    brutal: `${name} is very frail: ${a} of 100. Days with your goal met are what bring them back.`,
  });
}

/** Home, after a few days with nothing logged. Quiet days cost nothing; the line never scolds. */
export function welcomeBackLine(tone: Tone, name: string): string {
  return byTone(tone, {
    gentle: `Hello again. ${name} is just happy to see you. No catching up needed.`,
    honest: `There you are! ${name} is glad you're back. No catching up needed: just today.`,
    brutal: `You're back. ${name} is ready. Check in for today and carry on.`,
  });
}

/** The slip card when the hidden reserve took some of the cost. */
export function absorbedLine(tone: Tone, name: string, streak: number, absorbed: number, all: boolean): string {
  const m = monthsText(absorbed);
  if (all) {
    return byTone(tone, {
      gentle: `${streak} good days kept ${name} strong, so this one barely landed. The cushion is a little thinner now.`,
      honest: `${streak} good days made ${name} strong. This one was absorbed, but the cushion is thinner now.`,
      brutal: `${streak} good days absorbed this one. That cushion is thinner now; don't spend it all.`,
    });
  }
  return byTone(tone, {
    gentle: `${name}'s good days softened this: ${m} of it never landed.`,
    honest: `${name}'s strength from good days took ${m} of it.`,
    brutal: `Good days soaked up ${m} of this. The rest counted.`,
  });
}

/** The slip card on a day with three or more slips. */
export function bingeLine(tone: Tone, name: string): string {
  return byTone(tone, {
    gentle: `A heavy day. Part of it will stay with ${name} as a lasting mark, but every goal-met day from here still helps.`,
    honest: `A heavy day. Part of it now stays with ${name}: their life expectancy went down.`,
    brutal: `Three or more slips today. Part of this stays: ${name}'s life expectancy went down.`,
  });
}

/** Health sheet, after two or more quiet days. */
export function quietBanner(tone: Tone, name: string): string {
  return byTone(tone, {
    gentle: `${name} heals on the days you check in. Quiet days don't cost anything, so pick up whenever you're ready.`,
    honest: `${name} heals only on days you check in. Quiet days don't cost anything, so you can pick up again any time.`,
    brutal: `${name} only heals on days you check in. Quiet days cost nothing, but they don't heal either.`,
  });
}

export function verdict(tone: Tone, slips: number, prev: number): string {
  if (slips === 0 && prev === 0) return byTone(tone, { gentle: "Nothing logged in either week. That's okay.", honest: "Nothing logged in either week.", brutal: "Nothing logged in either week." });
  if (slips === 0) return byTone(tone, { gentle: "A slip-free week. That counts for a lot.", honest: "No slips this week. That counts for a lot.", brutal: "No slips this week. That's a win." });
  if (prev === 0) return byTone(tone, {
    gentle: `${plural(slips, "slip")} this week, after none last week. One week doesn't define you.`,
    honest: `${plural(slips, "slip")} this week against none last week.`,
    brutal: `${plural(slips, "slip")} this week against none last week. Find out what changed.`,
  });
  if (slips < prev) return byTone(tone, {
    gentle: `Down from ${prev} to ${slips}. That is progress, and it is real.`,
    honest: `Down from ${prev} to ${slips}. That is progress, and it is real.`,
    brutal: `Down from ${prev} to ${slips}. Keep going.`,
  });
  if (slips === prev) return byTone(tone, { gentle: `Level with last week at ${slips}. Steady is okay.`, honest: `Level with last week at ${slips}. Nothing moved.`, brutal: `Level with last week at ${slips}. Nothing moved.` });
  return byTone(tone, {
    gentle: `Up from ${prev} to ${slips}. A fresh week is a fresh start.`,
    honest: `Up from ${prev} to ${slips} slips. A fresh week is a fresh start.`,
    brutal: `Up from ${prev} to ${slips}. Next week can be better: start with today.`,
  });
}

export const DISCLAIMER = t("safety.disclaimer.body");

export const CRISIS_MESSAGE = t("safety.crisis.message", { helplines: t("safety.helplines.short") });

export const PROFESSIONAL_NOTE = t("safety.professional.note");

export const EFFECT_LABEL: Record<string, string> = {
  dull_coat: "The coat looks a little duller.", heavier: "Moving a bit slower.", labored_breathing: "Breathing a bit harder.",
  cough: "A small cough today.", thin: "Low on energy.", glassy_eyes: "Eyes a little glassy.", trembling: "A bit shaky.",
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
  return byTone(tone, {
    gentle: p === "night" ? `Still up${to}? Go easy tonight` : `Good ${p}${to}`,
    honest: p === "night" ? `It's late${to}` : `Good ${p}${to}`,
    brutal: p === "night" ? `Late night${to}. Choose well` : `Good ${p}${to}. Let's make it count`,
  });
}

export const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function milestoneLine(tone: Tone, name: string, days: number): { title: string; body: string } {
  return {
    title: `${days} days of care`,
    body: byTone(tone, {
      gentle: `${name} is resting easier. You did that, one day at a time.`,
      honest: `Days with your goal met or an urge managed add up, and they never reset. ${name} is healing.`,
      brutal: `${days} days with your goal met or an urge managed. ${name} noticed. Keep going.`,
    }),
  };
}

/** What the companion would say in each tone, shown live while choosing. */
export function tonePreview(tone: Tone, name: string): string {
  const n = name.trim() || "Biscuit";
  return byTone(tone, {
    gentle: `${n} is a little tired today. Tomorrow is a fresh start, and you're not alone in it.`,
    honest: `That was the third slip today. ${n} lost 4 months. A goal-met day starts healing it.`,
    brutal: `That was slip three today. ${n} felt it. Tonight can still go well.`,
  });
}

export function hatchLine(tone: Tone, name: string): string {
  return byTone(tone, { gentle: `${name} is here, and glad to meet you.`, honest: `${name} is here. Brand new, age 0.`, brutal: `${name} is here. Let's give them a long, good life.` });
}

export function cleanToast(tone: Tone, name: string): string {
  return byTone(tone, { gentle: `A good day. ${name} is resting.`, honest: `Goal met today. ${name} heals a little.`, brutal: `Goal met. That's real progress.` });
}

export function reminderLine(tone: Tone, name: string): { title: string; body: string } {
  return { title: tt("notifications.daily.title", tone, { name }), body: tt("notifications.daily.body", tone) };
}

/** The morning and bedtime note while days can still be filled in. Names read as a list; the day count is the most any one pet has open. */
export function catchupLine(tone: Tone, names: string[], n: number): { title: string; body: string } {
  const list = names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const vars = { names: list, n, days: n === 1 ? "day" : "days" };
  return { title: tt(names.length > 1 ? "notifications.catchup.title_many" : "notifications.catchup.title_one", tone, { names: list }), body: tt("notifications.catchup.body", tone, vars) };
}

/** Shown when someone tries to track eating less, calories or weight (CLAUDE.md: never add restriction tracking). */
export const RESTRICTION_NOTE = t("safety.restriction.note");
/** The same note, for the copy inspector. */
export const restrictionNoteSample = () => RESTRICTION_NOTE;

// ---------- pausing a track ----------

/** What pausing does, in the card menu. Plain about the rules in every tone: paused days count neither way. */
export function pauseHint(tone: Tone): string {
  return byTone(tone, {
    gentle: "Take a break whenever you need one. While this track is paused, days count neither way and its reminders stop. Anything you do log still counts.",
    honest: "Paused days count neither way: no progress and no slips. This track's reminders stop. Anything you log still counts.",
    brutal: "Pausing stops this track's reminders. Paused days aren't wins or losses. Anything you log still counts.",
  });
}

/** What the pet says while its track is paused and nothing is logged today. */
export function pausedLine(tone: Tone, name: string): string {
  return byTone(tone, {
    gentle: `${name} is resting with you. Come back whenever you're ready.`,
    honest: `Tracking is paused. ${name} is fine, and nothing changes while it's paused.`,
    brutal: `Paused. Nothing counts either way until you resume.`,
  });
}

export function pauseToast(tone: Tone, name: string): string {
  return byTone(tone, { gentle: `Paused. ${name} will be here.`, honest: "Paused. Reminders for this track are off.", brutal: "Paused. No reminders for this track until you resume." });
}

export function resumeToast(tone: Tone): string {
  return byTone(tone, { gentle: "Welcome back. Tracking is on again.", honest: "Resumed. Reminders follow your settings again.", brutal: "Resumed. Back to it." });
}

export function resumeHint(tone: Tone): string {
  return byTone(tone, {
    gentle: "Resuming starts counting again from today, gently. Your reminders come back exactly as you set them.",
    honest: "Resuming starts counting again from today. Your reminders come back exactly as you set them.",
    brutal: "Resuming counts from today. Your reminders come back as you set them.",
  });
}

export function pauseRefused(tone: Tone): string {
  return byTone(tone, { gentle: "That couldn't change just now. Nothing was lost.", honest: "That couldn't be changed. Nothing was lost.", brutal: "Couldn't change that. Nothing was lost." });
}

export const updatePhase = (percent: number | null): string | null => percent === null ? null : percent >= 100 ? t("update.dialog.checking") : percent > 0 ? t("update.dialog.downloading", { n: percent }) : t("update.dialog.starting");
