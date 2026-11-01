import { addDays, weekStart } from "./dates";
import { trackIndex } from "./progress";
import { BASELINE_PER_WEEK } from "./store";
import { trackState } from "./tracks";
import type { AppData, RecoveryPlan } from "./types";

/**
 * Goal progress: the person's own target, held against the data they log every day.
 * Pure: it only reads AppData, so it is tested directly. It never touches the companion's age or health.
 *
 * Counting rules (docs/RECOVERY_RULES.md): a day with no check-in is unknown, never a failure, so a week is only
 * judged once it has enough checked-in days. "Slips" are logged slips (times), not amounts.
 */
export type GoalTarget = { kind: "quit" } | { kind: "limit"; perWeek: number } | { kind: "learn" };

/** The target a plan describes, or null when no goal was chosen. A "cut down" goal without a number counts as understanding first. */
export function goalTarget(plan: RecoveryPlan | null | undefined): GoalTarget | null {
  if (!plan?.goal) return null;
  if (plan.goal === "stop") return { kind: "quit" };
  if (plan.goal === "reduce") return plan.limitPerWeek && plan.limitPerWeek >= 1 ? { kind: "limit", perWeek: plan.limitPerWeek } : { kind: "learn" };
  return { kind: "learn" };
}

/**
 * building: not enough check-ins this week to say. on_target: at or under the target. closing: over it, but closer than last week.
 * away: over it, and not closer. learn: no target, just noticing.
 */
export type GoalStatus = "building" | "on_target" | "closing" | "away" | "learn";

export interface GoalProgress {
  target: GoalTarget;
  identity: string;
  status: GoalStatus;
  /** Slips this week and last week (Monday to Sunday). */
  thisWeek: number;
  lastWeek: number;
  /** Days with a check-in in each of those weeks. */
  checkedThis: number;
  checkedLast: number;
  /** Slips in each of the last 8 weeks, oldest first, for the small chart. */
  weeks: number[];
  /** Times a week when they started, from onboarding; null if not known. */
  startedPerWeek: number | null;
  /** Times a week over the last 14 checked-in days; null with no check-ins. */
  nowPerWeek: number | null;
  /** How much lower (positive) or higher (negative) now is than at the start, in percent; null if either is unknown. */
  changePct: number | null;
}

/** Check-ins a week needs before it is judged. Fewer, and the honest answer is "not enough yet". */
export const MIN_CHECKED_DAYS = 2;

const slipsIn = (d: AppData, habitId: string, from: string, to: string) =>
  d.entries.filter((e) => e.habitId === habitId && e.day >= from && e.day <= to).length;

export function goalProgress(d: AppData, habitId: string, t0: string): GoalProgress | null {
  const state = trackState(d, habitId);
  const target = goalTarget(state.plan);
  if (!target) return null;
  const idx = trackIndex(d, habitId, t0);
  const ws = weekStart(t0), lastWs = addDays(ws, -7);
  const checkedIn = (from: string, to: string) => [...idx.checkedIn].filter((x) => x >= from && x <= to).length;
  const thisWeek = slipsIn(d, habitId, ws, t0), lastWeek = slipsIn(d, habitId, lastWs, addDays(ws, -1));
  const checkedThis = checkedIn(ws, t0), checkedLast = checkedIn(lastWs, addDays(ws, -1));
  const weeks = Array.from({ length: 8 }, (_, i) => { const s = addDays(ws, -7 * (7 - i)); return slipsIn(d, habitId, s, addDays(s, 6)); });

  const startedPerWeek = state.baseline ? BASELINE_PER_WEEK[state.baseline] : null;
  const from14 = addDays(t0, -13);
  const days14 = checkedIn(from14, t0);
  const nowPerWeek = days14 ? (slipsIn(d, habitId, from14, t0) / days14) * 7 : null;
  const changePct = startedPerWeek && nowPerWeek !== null ? Math.round(((startedPerWeek - nowPerWeek) / startedPerWeek) * 100) : null;

  let status: GoalStatus;
  if (target.kind === "learn") status = "learn";
  else if (checkedThis < MIN_CHECKED_DAYS) status = "building";
  else {
    const limit = target.kind === "quit" ? 0 : target.perWeek;
    if (thisWeek <= limit) status = "on_target";
    else status = checkedLast >= MIN_CHECKED_DAYS && thisWeek < lastWeek ? "closing" : "away";
  }
  return { target, identity: (state.plan?.identity ?? "").trim(), status, thisWeek, lastWeek, checkedThis, checkedLast, weeks, startedPerWeek, nowPerWeek, changePct };
}

/** One thing the person did instead of acting on an urge, and how often it worked. */
export interface Helper { what: string; total: number; managed: number; avgStrength: number; photo: string | null }

/** What helps, by the person's own account: each "what I did instead" with how many of those urges eased, most successful first. */
export function whatHelps(d: AppData, habitId: string, limit = 4): { helpers: Helper[]; noted: number } {
  const groups = new Map<string, Helper & { sum: number; label: string }>();
  let noted = 0;
  for (const u of d.urges) {
    const what = u.instead?.trim();
    if (u.habitId !== habitId || !what) continue;
    noted++;
    const key = what.toLowerCase();
    const g = groups.get(key) ?? { what, label: what, total: 0, managed: 0, avgStrength: 0, photo: null, sum: 0 };
    g.total++; g.sum += u.strength; if (u.outcome === "rode_it_out") g.managed++;
    if (u.photo) g.photo = u.photo;
    groups.set(key, g);
  }
  const helpers = [...groups.values()]
    .map(({ sum, label: _l, ...g }) => ({ ...g, avgStrength: Math.round((sum / g.total) * 10) / 10 }))
    .sort((a, b) => b.managed - a.managed || b.total - a.total || a.what.localeCompare(b.what))
    .slice(0, limit);
  return { helpers, noted };
}

/** The photos kept with urges, newest first. They stay on the phone. */
export function urgePhotos(d: AppData, habitId: string, limit = 4): { src: string; what: string }[] {
  return [...d.urges].filter((u) => u.habitId === habitId && u.photo).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((u) => ({ src: u.photo as string, what: u.instead ?? "" }));
}
