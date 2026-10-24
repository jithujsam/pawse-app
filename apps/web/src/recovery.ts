import type { HabitClass } from "@detox/engine";
import { addDays, daysBetween, parse, today } from "./dates";
import { pickedLabels } from "./questions";
import { slipHour } from "./store";
import type { AppData, GoalKind, Habit, StrategyId, Tone } from "./types";

/**
 * The recovery layer: what each day was, what the person's own records show, and the weekly review.
 * Everything here is derived from what was actually recorded. Nothing is inferred from app use, and a
 * day nobody recorded is "unrecorded", never progress and never a lapse.
 */

/** lapse: a slip was logged. met: marked as goal met. urge: no slip, an urge managed, nothing else marked. */
export type DayStatus = "lapse" | "met" | "urge" | "rest" | "unrecorded" | "future";

export const STATUS_LABEL: Record<DayStatus, string> = {
  lapse: "Slip", met: "Goal met", urge: "Urge managed", rest: "Not tracking", unrecorded: "Not recorded", future: "Upcoming",
};

export function dayStatus(d: AppData, habitId: string, day: string, t0 = today()): DayStatus {
  if (day > t0) return "future";
  if (d.entries.some((e) => e.habitId === habitId && e.day === day)) return "lapse";
  if (d.cleanDays.some((c) => c.habitId === habitId && c.day === day)) return "met";
  if (d.urges.some((u) => u.habitId === habitId && u.day === day && u.outcome === "rode_it_out")) return "urge";
  if (d.settings.restDays.includes(day)) return "rest";
  return "unrecorded";
}

/** Urges managed on a day, shown alongside its status (a goal-met day can have managed urges too). */
export const urgesManaged = (d: AppData, habitId: string, day: string) =>
  d.urges.filter((u) => u.habitId === habitId && u.day === day && u.outcome === "rode_it_out").length;

// ---------- strategies ----------

export interface Strategy { id: StrategyId; title: string; hint: string; steps: string[] }

/** Coping strategies for an urge. None promises the urge ends by a set time: urges vary. */
export const STRATEGIES: Strategy[] = [
  { id: "observe", title: "Pause and notice", hint: "Watch the urge without acting on it",
    steps: ["Stop for a moment. You don't have to do anything yet.", "Where do you feel it? Chest, hands, stomach?", "Rate it again in a minute. Urges tend to rise and fall, even if it doesn't feel that way now."] },
  { id: "name", title: "Name what's going on", hint: "Spot the trigger or feeling",
    steps: ["What happened just before this?", "Pick the feeling or situation below, or type your own.", "Naming it often takes a little heat out of it."] },
  { id: "move", title: "Change where you are", hint: "Step away from the cue",
    steps: ["Move to another room, step outside, or put the phone in another room.", "Changing what's in front of you changes what you're reminded of."] },
  { id: "friction", title: "Make it harder to act", hint: "Add a step between you and it",
    steps: ["Put one extra step in the way, right now.", "Even a small delay gives you time to choose."] },
  { id: "breathe", title: "Breathe slowly", hint: "Paced breathing with your companion",
    steps: ["Breathe in for 4, hold for 4, out for 6.", "Stop whenever you like."] },
  { id: "replace", title: "Do something else", hint: "A short swap for the next few minutes",
    steps: ["Pick something small you can start right now.", "It doesn't have to be fun. It just has to take your hands and attention."] },
  { id: "reach", title: "Reach out", hint: "Message or call someone",
    steps: ["Send a short message. It can be as simple as \"having a rough moment\".", "You don't have to explain everything."] },
];
export const strategy = (id: StrategyId) => STRATEGIES.find((s) => s.id === id)!;

/** The person's preferred strategies first, then the rest in the default order. */
export function strategyOrder(preferred: StrategyId[] | undefined): Strategy[] {
  const first = (preferred ?? []).map(strategy).filter(Boolean);
  return [...first, ...STRATEGIES.filter((s) => !first.includes(s))];
}

/** Ways to add friction, per kind of habit. Practical, reversible, and the person's own call. */
export function frictionIdeas(cls: HabitClass, what = ""): string[] {
  if (/bet|gambl|casino|lotter|poker|slots/i.test(what)) return ["Log out of the betting app and delete the saved password", "Turn on a self-exclusion or deposit limit", "Leave cards somewhere hard to reach"];
  return ({
    food_spending: ["Log out of the delivery app", "Remove the saved card from the app", "Move the app off your home screen"],
    impulse_buying: ["Empty the cart and wait 24 hours", "Remove saved cards from shopping sites", "Unsubscribe from one sale email"],
    doomscrolling: ["Put the phone in another room", "Log out of the app", "Turn on grayscale or a screen-time limit"],
    smoking: ["Put them out of sight, somewhere awkward", "Don't carry a lighter today", "Wait ten minutes before deciding"],
    alcohol: ["Don't keep drinks at home tonight", "Pour a non-alcoholic drink first", "Leave cards at home if you go out"],
    custom: ["Put it out of sight", "Add one extra step before you can start", "Wait ten minutes before deciding"],
  } as Record<HabitClass, string[]>)[cls];
}

export const REPLACEMENTS = ["Drink a glass of water", "Walk for five minutes", "Have a shower", "Make tea", "Text a friend", "Tidy one small thing", "Stretch", "Put on a song"];

// ---------- plan choices ----------

export const GOALS: { id: GoalKind; label: string; hint: string }[] = [
  { id: "stop", label: "Stop completely", hint: "Every day without it counts" },
  { id: "reduce", label: "Cut down", hint: "Fewer times than before" },
  { id: "understand", label: "Understand it first", hint: "Notice when and why, no pressure to change yet" },
];
export const REASONS = ["My health", "Money", "Sleep", "My relationships", "Feeling in control", "Time back", "Being there for someone", "How I feel after"];
export const SITUATIONS = ["Late at night", "Alone at home", "After work or college", "When I get paid", "With certain people", "In bed with my phone", "Weekends", "After an argument"];
export const FIRST_STEPS: Record<HabitClass, string[]> = {
  food_spending: ["Check in every evening this week", "Log out of one delivery app", "Plan tomorrow's dinner tonight"],
  impulse_buying: ["Wait 24 hours before any non-essential buy", "Remove one saved card", "Check in every evening this week"],
  doomscrolling: ["Charge the phone outside the bedroom", "Set one app limit", "Check in every evening this week"],
  smoking: ["Notice and log each urge this week", "Skip the first one of the day", "Talk to a doctor or pharmacist about support"],
  alcohol: ["Have two drink-free days this week", "Talk to a doctor before cutting down a lot", "Check in every evening this week"],
  custom: ["Check in every evening this week", "Notice and log each urge", "Tell one person what I'm working on"],
};

// ---------- what the records show ----------

export type Strength = "hint" | "pattern";
export interface Observation { id: string; title: string; detail: string; count: number; of: number; strength: Strength }

/** Below this many recorded events (slips plus urges), the app says it doesn't know yet instead of guessing. */
export const MIN_EVENTS = 5;

const BLOCKS = ["late night (12–4 AM)", "early morning (4–8 AM)", "morning (8 AM–12 PM)", "afternoon (12–4 PM)", "evening (4–8 PM)", "night (8 PM–12 AM)"];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Patterns in the person's own records, with how many records each rests on. A "hint" is something that came up
 * a few times; a "pattern" is something present in at least half of 6+ records. These describe what was going on,
 * not what caused anything, and the copy says so.
 */
export function observations(d: AppData, habit: Habit): { items: Observation[]; events: number; needed: number } {
  const slips = d.entries.filter((e) => e.habitId === habit.id);
  const urges = d.urges.filter((u) => u.habitId === habit.id);
  const events = slips.length + urges.length;
  if (events < MIN_EVENTS) return { items: [], events, needed: MIN_EVENTS - events };
  const items: Observation[] = [];
  const rate = (count: number, of: number): Strength | null => (of >= 6 && count / of >= 0.5 ? "pattern" : count >= 3 ? "hint" : null);
  const push = (id: string, title: string, detail: string, count: number, of: number) => { const s = rate(count, of); if (s) items.push({ id, title, detail, count, of, strength: s }); };

  // Feelings and situations: from slip answers and from what was named during urges.
  const tally = new Map<string, number>();
  const withContext = new Set<string>();
  const mood = habit.fields.find((f) => f.id === "mood");
  for (const e of slips) for (const l of mood ? pickedLabels(mood, e.values.mood) : []) { tally.set(l, (tally.get(l) ?? 0) + 1); withContext.add(e.id); }
  for (const u of urges) if (u.trigger) { tally.set(u.trigger, (tally.get(u.trigger) ?? 0) + 1); withContext.add(u.id); }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) push("feeling", top[0], `came up in ${top[1]} of ${withContext.size} slips and urges where you noted what was going on`, top[1], withContext.size);

  const timed = slips.map(slipHour).filter((h): h is number => h !== null);
  const blocks = BLOCKS.map((_, i) => timed.filter((h) => Math.floor(h / 4) === i).length);
  const b = blocks.indexOf(Math.max(...blocks));
  if (timed.length) push("time", `In the ${BLOCKS[b]}`, `${blocks[b]} of ${timed.length} slips with a time`, blocks[b], timed.length);

  const days = DOW.map((_, i) => slips.filter((e) => parse(e.day).getDay() === i).length);
  const w = days.indexOf(Math.max(...days));
  // A weekday is only worth mentioning with enough weeks behind it to tell it apart.
  if (slips.length >= 8) push("weekday", `On ${DOW[w]}s`, `${days[w]} of ${slips.length} slips`, days[w], slips.length);

  const where = habit.fields.find((f) => f.id === "where");
  if (where) {
    const answered = slips.filter((e) => pickedLabels(where, e.values.where).length);
    const counts = new Map<string, number>();
    for (const e of answered) for (const l of pickedLabels(where, e.values.where)) counts.set(l, (counts.get(l) ?? 0) + 1);
    const t = [...counts.entries()].sort((a, c) => c[1] - a[1])[0];
    if (t) push("where", `At: ${t[0].toLowerCase()}`, `${t[1]} of ${answered.length} slips where you said where you were`, t[1], answered.length);
  }
  return { items, events, needed: 0 };
}

export interface StrategyResult { id: StrategyId; managed: number; total: number }

/** How each strategy went, by the person's own account. Only strategies tried at least twice are shown. */
export function strategyResults(d: AppData, habitId: string, from?: string, to?: string): StrategyResult[] {
  const m = new Map<StrategyId, StrategyResult>();
  for (const u of d.urges) {
    if (u.habitId !== habitId || !u.strategy || (from && u.day < from) || (to && u.day > to)) continue;
    const r = m.get(u.strategy) ?? { id: u.strategy, managed: 0, total: 0 };
    r.total++; if (u.outcome === "rode_it_out") r.managed++;
    m.set(u.strategy, r);
  }
  return [...m.values()].sort((a, b) => b.managed - a.managed || b.total - a.total);
}

// ---------- weekly review ----------

export interface WeekReview {
  week: string;
  /** Days of this week that have happened and the companion was around for. */
  days: number;
  counts: Record<Exclude<DayStatus, "future">, number>;
  lapses: number;
  lapsesBefore: number;
  urges: { managed: number; total: number };
  strategies: StrategyResult[];
  /** The most common feelings or situations noted this week, with counts. */
  difficult: [string, number][];
  goalLine: string;
  focus: string | null;
  lastFocus: string | null;
}

export function weekReview(d: AppData, habit: Habit, bornOn: string, week: string, t0 = today()): WeekReview {
  const end = addDays(week, 6);
  const counts = { lapse: 0, met: 0, urge: 0, rest: 0, unrecorded: 0 };
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(week, i);
    if (day > t0 || daysBetween(bornOn, day) < 0) continue;
    days++;
    const s = dayStatus(d, habit.id, day, t0);
    if (s !== "future") counts[s]++;
  }
  const inWeek = (day: string, from = week, to = end) => day >= from && day <= to;
  const lapses = d.entries.filter((e) => e.habitId === habit.id && inWeek(e.day)).length;
  const lapsesBefore = d.entries.filter((e) => e.habitId === habit.id && inWeek(e.day, addDays(week, -7), addDays(week, -1))).length;
  const urgeRows = d.urges.filter((u) => u.habitId === habit.id && inWeek(u.day));
  const tally = new Map<string, number>();
  const mood = habit.fields.find((f) => f.id === "mood");
  for (const e of d.entries) if (e.habitId === habit.id && inWeek(e.day) && mood) for (const l of pickedLabels(mood, e.values.mood)) tally.set(l, (tally.get(l) ?? 0) + 1);
  for (const u of urgeRows) if (u.trigger) tally.set(u.trigger, (tally.get(u.trigger) ?? 0) + 1);
  const recorded = days - counts.unrecorded - counts.rest;
  const goal = d.settings.plan?.goal ?? null;
  const goalLine = recorded === 0
    ? "Nothing was recorded this week, so there's nothing to judge it by. That's fine: next week starts fresh."
    : goal === "stop" ? `${counts.met + counts.urge} of ${recorded} recorded ${recorded === 1 ? "day" : "days"} without a slip.`
      : goal === "understand" ? `${recorded} ${recorded === 1 ? "day" : "days"} recorded and ${urgeRows.length} ${urgeRows.length === 1 ? "urge" : "urges"} noticed. Every record adds to the picture.`
        : lapses < lapsesBefore ? `${lapses} ${lapses === 1 ? "slip" : "slips"}, down from ${lapsesBefore} the week before.`
          : lapses === lapsesBefore ? `${lapses} ${lapses === 1 ? "slip" : "slips"}, the same as the week before.`
            : `${lapses} ${lapses === 1 ? "slip" : "slips"}, up from ${lapsesBefore} the week before. One week doesn't undo the ones before it.`;
  const focusFor = (w: string) => d.settings.weekFocus.find((f) => f.week === w)?.text ?? null;
  return {
    week, days, counts, lapses, lapsesBefore,
    urges: { managed: urgeRows.filter((u) => u.outcome === "rode_it_out").length, total: urgeRows.length },
    strategies: strategyResults(d, habit.id, week, end),
    difficult: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    goalLine, focus: focusFor(addDays(week, 7)), lastFocus: focusFor(week),
  };
}

/** Realistic adjustments to pick from in a weekly review, led by what the week actually showed. */
export function adjustmentIdeas(r: WeekReview, habit: Habit, what: string): string[] {
  const ideas: string[] = [];
  const best = r.strategies.find((s) => s.managed > 0);
  if (best) ideas.push(`Reach for "${strategy(best.id).title.toLowerCase()}" first when an urge hits`);
  if (r.difficult[0]) ideas.push(`Plan one thing to do when I'm ${r.difficult[0][0].toLowerCase()}`);
  if (r.counts.unrecorded >= 3) ideas.push("Check in each evening, even on easy days");
  ideas.push(frictionIdeas(habit.cls, what)[0]);
  return [...new Set(ideas)].slice(0, 4);
}

// ---------- copy that depends on tone ----------

/** After a lapse: calm, factual, and pointing back to the plan. Never shaming in any tone. */
export function lapseHeadline(tone: Tone, name: string): string {
  if (tone === "gentle") return `Thanks for logging it. ${name} is still right here with you.`;
  if (tone === "brutal") return "Logged. A slip is information, not a verdict. Back to the plan.";
  return "Logged. A slip is something to learn from, not proof of anything about you.";
}

export function progressKept(tone: Tone, met: number, urges: number): string {
  const parts = [met ? `${met} ${met === 1 ? "day" : "days"} with your goal met` : "", urges ? `${urges} ${urges === 1 ? "urge" : "urges"} managed` : ""].filter(Boolean).join(" and ");
  if (!parts) return tone === "brutal" ? "Every day from here counts." : "Every day from here still counts.";
  if (tone === "gentle") return `Your ${parts} still count. Nothing takes them away.`;
  if (tone === "brutal") return `${parts[0].toUpperCase()}${parts.slice(1)}. Still yours. Build on them.`;
  return `Your ${parts} still stand. This doesn't erase them.`;
}

export function urgeManagedLine(tone: Tone, name: string): string {
  if (tone === "gentle") return `You got through that one. ${name} is proud of you.`;
  if (tone === "brutal") return "Managed. That's the skill, and you just used it.";
  return `That one passed without you acting on it. ${name} noticed.`;
}

export function urgeActedLine(tone: Tone): string {
  if (tone === "gentle") return "That's okay. You noticed it, and that matters. Logging it helps you see what happened.";
  if (tone === "brutal") return "Okay. Log it honestly and look at what came before it. That's how the next one goes differently.";
  return "Okay. Noticing it was still useful. Log it, and see what came before it.";
}

export function restLine(tone: Tone): string {
  if (tone === "gentle") return "Not tracking today. That's allowed. Nothing counts for or against you.";
  if (tone === "brutal") return "Not tracking today. It won't count either way. Pick it back up tomorrow.";
  return "Not tracking today. It won't count as progress or as a slip.";
}
