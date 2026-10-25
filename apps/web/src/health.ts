import { cleanDaysToAge, cleanDaysToUndo, floorAge, STAGE_LABEL } from "@detox/engine";
import { addDays, daysBetween, today } from "./dates";
import { cleanStreak, recoveryPlan, silentDays, type CompanionView } from "./store";
import { milestoneProgress, trackSummary } from "./progress";
import { MILESTONES } from "./copy";
import type { AppData, Species, Tone } from "./types";

/**
 * The pet's health, explained. Everything here is derived from the engine's numbers and the log,
 * written in plain words: what's wrong, why, and how many good days fix it. The conditions are
 * illustrative pet ailments that mirror the habit, not medical claims about the person.
 */
export type Level = "thriving" | "healthy" | "okay" | "unwell" | "critical";

export interface HealthReport {
  level: Level;
  /** 0..100, how full the heart is. */
  heart: number;
  title: string;
  body: string;
  silent: number;
}

export function healthReport(d: AppData, v: CompanionView, tone: Tone): HealthReport {
  const habit = v.habit!;
  const name = v.companion.name;
  const t0 = today();
  const slipped = d.entries.some((e) => e.habitId === habit.id && e.day === t0);
  const streak = cleanStreak(d, habit.id);
  const silent = silentDays(d, habit.id);
  const reserve = v.current?.reserveMonths ?? 0;
  // Quiet days are missing data, not a slip, so they don't lower the heart.
  let heart = 100 - v.age * 0.9 - (slipped ? 15 : 0) + Math.min(10, reserve);
  heart = Math.round(Math.max(3, Math.min(slipped ? 80 : 100, heart)));
  const level: Level = heart >= 85 ? "thriving" : heart >= 68 ? "healthy" : heart >= 48 ? "okay" : heart >= 28 ? "unwell" : "critical";
  const g = tone === "gentle", b = tone === "brutal";
  const lines: Record<Level, [string, string]> = {
    thriving: [`${name} is thriving`, streak > 1
      ? `${streak} good days in a row and it shows. This is what good care looks like${reserve >= 4 ? `, and ${name} has strength saved up for a rough day` : ""}.`
      : `Healthy, bright and happy. Keep the check-ins coming and it will stay that way.`],
    healthy: [`${name} is healthy`, slipped
      ? `${name} is strong enough to handle today, but won't eat until there's a good day. ${b ? "Make tomorrow count." : "Tomorrow is a good place to start."}`
      : `In good shape. ${streak ? `${streak} good ${streak === 1 ? "day" : "days"} so far` : "A good day today would make it even better"}.`],
    okay: [`${name} is okay`, slipped
      ? `Not great today: ${name} felt that slip and is off their food. A few good days will turn it around.`
      : silent > 1 ? `${name} hasn't heard from you in ${silent} days. No harm done: a check-in picks things up again.`
        : `Doing all right, with some wear showing. ${g ? "Every good day helps a little." : "A run of good days is the fastest way back."}`],
    unwell: [`${name} isn't doing well`, `${b ? "Straight talk: " : ""}${name} is unwell${slipped ? " and not eating" : ""}. Keeping the habit in check for a while is what helps most. You can do this, one day at a time.`],
    critical: [`${name} needs you`, `${name} is very weak right now. ${g ? "It's not too late." : "This is the moment to change course."} A good day today starts the healing, and every day after adds to it.`],
  };
  const [title, body] = lines[level];
  return { level, heart, title, body, silent };
}

export interface Condition {
  id: string;
  name: string;
  /** What it is, in a sentence. */
  what: string;
  /** Why the pet has it. */
  why: string;
  /** How to fix it, with a number of days. */
  fix: string;
  days: number | null;
  tone: "mild" | "moderate" | "serious";
}

type CondKey = "appetite" | "smoking" | "alcohol" | "food_spending" | "doomscrolling" | "impulse_buying" | "custom" | "aging" | "lonely";
const NAMES: Record<CondKey, Partial<Record<Species, [string, string]>> & { all: [string, string] }> = {
  appetite: {
    all: ["Off their food", "Too upset to eat today."],
    rabbit: ["Gut slowdown (GI stasis)", "Rabbits need to keep eating; stress makes their gut slow right down."],
    cat: ["Skipping meals", "Cats stop eating when something upsets them."],
    owl: ["Off their prey", "Too unsettled to hunt or eat today."],
    panda: ["Off their bamboo", "Pandas lose their appetite when stressed."],
  },
  smoking: {
    all: ["Chest cold", "A rattly chest and short breath."],
    dog: ["Kennel cough", "A dry, honking cough that's tiring for dogs."],
    cat: ["Feline asthma", "Tight airways and wheezing."],
    rabbit: ["Snuffles", "A sniffly nose and sneezing, common in rabbits."],
    owl: ["Wheezy breathing", "Air sacs irritated, so breathing is hard work."],
  },
  alcohol: {
    all: ["Tired liver", "Sluggish, sleepy and slow to bounce back."],
    rabbit: ["Wobbly balance", "Unsteady and dizzy, a sign something's off."],
  },
  food_spending: {
    all: ["Tummy trouble", "An upset stomach and low energy."],
    dog: ["Upset stomach", "Rich food upsets a dog's tummy."],
    cat: ["Hairballs and tummy trouble", "An unsettled stomach."],
    rabbit: ["Bloat", "A tight, uncomfortable tummy."],
  },
  doomscrolling: {
    all: ["Sleepless nights", "Restless and not resting properly."],
    cat: ["Stress overgrooming", "Licking too much when anxious."],
    rabbit: ["Stress thumping", "Thumping and jumpy, can't settle."],
    owl: ["Sleep upset", "Owls need deep daytime rest."],
  },
  impulse_buying: {
    all: ["Anxious and jumpy", "On edge and hard to settle."],
    dog: ["Separation anxiety", "Pacing and whining, worried and unsettled."],
    cat: ["Stress hiding", "Hiding under things to feel safe."],
  },
  custom: { all: ["Worn down", "Low energy and a bit run down."] },
  aging: {
    all: ["Stiff joints", "Moving slowly, achy in the mornings."],
    cat: ["Kidney strain", "Older cats' kidneys tire easily."],
    rabbit: ["Dental trouble", "Sore teeth make eating harder."],
    owl: ["Dull feathers", "Feathers losing their shine."],
  },
  lonely: {
    all: ["Lonely", "Misses hearing from you."],
    rabbit: ["Lonely (rabbits are social)", "Rabbits get low quickly without company."],
  },
};
const pick = (k: CondKey, s: Species) => NAMES[k][s] ?? NAMES[k].all;

export function conditions(d: AppData, v: CompanionView): Condition[] {
  const habit = v.habit!;
  const s = v.companion.species, name = v.companion.name;
  const t0 = today();
  const out: Condition[] = [];
  const slipped = d.entries.some((e) => e.habitId === habit.id && e.day === t0);
  const week = d.entries.filter((e) => e.habitId === habit.id && e.day > addDays(t0, -7));
  const weekDamage = v.states.filter((x) => x.day > addDays(t0, -7)).reduce((a, x) => a + x.damageMonths, 0);
  const silent = silentDays(d, habit.id);
  const plan = recoveryPlan(v);

  if (slipped) {
    const [n, w] = pick("appetite", s);
    out.push({ id: "appetite", name: n, what: w, why: `There was a slip today, and ${name} feels it.`, fix: "1 good day and the appetite comes back.", days: 1, tone: s === "rabbit" ? "moderate" : "mild" });
  }
  if (week.length >= 2 || (week.length >= 1 && v.age >= 30)) {
    const [n, w] = pick(habit.cls as CondKey, s);
    const days = cleanDaysToUndo(weekDamage);
    out.push({ id: habit.cls, name: n, what: w, why: `${week.length} ${week.length === 1 ? "slip" : "slips"} this week of ${habit.name.toLowerCase()}.`, fix: `${days} good days in a row clears it up.`, days, tone: week.length >= 5 ? "serious" : week.length >= 3 ? "moderate" : "mild" });
  }
  if (v.stage === "middle" || v.stage === "old" || v.stage === "frail") {
    const [n, w] = pick("aging", s);
    const days = plan?.stageBack?.days ?? cleanDaysToAge(v.current!, 49.9);
    out.push({ id: "aging", name: n, what: w, why: `${name} has aged early: ${STAGE_LABEL[v.stage].toLowerCase()} at age ${Math.round(v.age)}.`,
      fix: days ? `${days} good days in a row to feel younger again.` : "Some of this is permanent now, but good days still help.", days, tone: v.stage === "frail" ? "serious" : v.stage === "old" ? "moderate" : "mild" });
  }
  if (silent >= 2) {
    const [n, w] = pick("lonely", s);
    out.push({ id: "lonely", name: n, what: w, why: `No check-in for ${silent} days. Quiet days don't cost any life, but healing only happens on days you check in.`,
      fix: "Check in whenever you're ready. It only takes ten seconds, and nothing is held against the quiet days.", days: 0, tone: "mild" });
  }
  const scar = v.current ? Math.round(floorAge(v.current) * 10) / 10 : 0;
  if (v.states.some((x) => x.binge)) {
    out.push({ id: "scar", name: "Old scar", what: "A heavy day that left a lasting mark.", why: `A day with 3 or more slips. ${name}'s life expectancy is now ${Math.round(100 - scar)}.`, fix: "This part doesn't heal, but it doesn't have to grow. Avoid binge days.", days: null, tone: "moderate" });
  }
  return out;
}

export interface HistoryItem { day: string; kind: "born" | "slip" | "shrug" | "binge" | "clean" | "milestone" | "urge" | "lonely"; text: string; months?: number }

/** The pet's life story, newest first: slips with what they cost, clean stretches with what they gave back. */
export function history(d: AppData, v: CompanionView): HistoryItem[] {
  const habit = v.habit!;
  const name = v.companion.name;
  const items: HistoryItem[] = [{ day: v.companion.bornOn, kind: "born", text: `${name} was born` }];
  let run: { from: string; to: string; healed: number; n: number } | null = null;
  const flush = () => { if (run) items.push({ day: run.to, kind: "clean", text: `${run.n} clean ${run.n === 1 ? "day" : "days"}${run.healed > 0 ? `, ${Math.round(run.healed * 10) / 10} months of life back` : ""}`, months: run.healed }); run = null; };
  for (const s of v.states) {
    const slips = d.entries.filter((e) => e.habitId === habit.id && e.day === s.day);
    if (slips.length) {
      flush();
      if (s.damageMonths < 0.05 && s.absorbedMonths > 0) items.push({ day: s.day, kind: "shrug", text: `A slip, but ${name} was strong enough to shrug it off` });
      else items.push({ day: s.day, kind: s.binge ? "binge" : "slip", months: s.damageMonths, text: `${name} lost ${Math.round(s.damageMonths * 10) / 10} months of lifespan${slips.length > 1 ? ` (${slips.length} slips)` : ""}${s.binge ? ". A lasting scar" : ""}` });
    } else if (d.cleanDays.some((c) => c.habitId === habit.id && c.day === s.day)) {
      if (!run) run = { from: s.day, to: s.day, healed: 0, n: 0 };
      run.to = s.day; run.healed += s.healedMonths; run.n++;
    } else if (s.neglectMonths > 0) {
      flush();
      items.push({ day: s.day, kind: "lonely", months: s.damageMonths, text: `Quiet day: ${name} got lonely${s.damageMonths > 0 ? ` and lost ${s.damageMonths} months` : ""}` });
    }
  }
  flush();
  for (const u of d.urges) if (u.habitId === habit.id && u.outcome === "rode_it_out") items.push({ day: u.day, kind: "urge", text: "Rode out an urge" });
  // The same milestones as everywhere else: days of care, which a slip never takes away.
  for (const m of milestoneProgress(trackSummary(d, habit.id, today()).care, MILESTONES).reached) items.push({ day: "", kind: "milestone", text: `Reached ${m} days of care` });
  return items.filter((i) => i.day).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : (a.kind === "born" ? 1 : 0) - (b.kind === "born" ? 1 : 0)))
    .concat(items.filter((i) => !i.day));
}

export function stats(d: AppData, v: CompanionView) {
  const habit = v.habit!;
  const t0 = today();
  const together = Math.max(1, daysBetween(v.companion.bornOn, t0) + 1);
  const p = trackSummary(d, habit.id, t0);
  const lost = v.states.reduce((a, s) => a + s.damageMonths, 0);
  const healed = v.states.reduce((a, s) => a + s.healedMonths, 0);
  return {
    together, cleanDays: p.metDays, slips: p.slips,
    // Recorded days out of days that could have been recorded: rest and paused days are left out.
    checkInRate: p.checkInRate ?? 0,
    lost: Math.round(lost * 10) / 10, healed: Math.round(healed * 10) / 10,
    lifeExpectancy: v.current ? Math.round(100 - floorAge(v.current)) : 100,
    best: p.best,
    urges: p.managedUrges,
    spent: Math.round(d.entries.filter((e) => e.habitId === habit.id).reduce((a, e) => a + (e.amount ?? 0), 0)),
    reflections: d.journal.length,
  };
}
