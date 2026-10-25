// Not dates.ts: dates.ts reads progress.ts at load time and progress.ts reads this module, so importing dates here
// would make a cycle that can fail on load. Only functions cross the progress <-> tracks link, which is safe.
import { localDay, pausedOn } from "./progress";
import type { Accessory, AppData, Baseline, Companion, GoalKind, Habit, Pause, RecoveryPlan, SavingsGoal, TrackState, TrackStatus, WeekFocus } from "./types";

/**
 * Recovery tracks: one per behaviour the person wants to change. A track is a Habit row plus its TrackState,
 * and it owns its companions, slips, goal-met days, urges and weekly summaries. Progress is never stored: it is
 * always recomputed from one track's own events. Pure functions only; writes go through actions in store.ts.
 * See docs/MULTI_TRACK_ARCHITECTURE.md.
 */

/** Today's local calendar day (the same value as dates.today()). */
const today = () => localDay(new Date());

export const defaultTrackState = (startedOn: string, createdAt = 0): TrackState => ({
  description: "", startedOn, status: "active", pauses: [], archivedOn: null, createdAt,
  baseline: null, plan: null, restDays: [], weekFocus: [], celebrated: [], wear: null, treatsGiven: 0, fedOn: null, savingsGoal: null,
});

/**
 * Settings keys that held per-track state before tracks had their own (local data v1 and the account profile).
 * Two shapes exist: single-track data, where they applied to the one habit, and the interim multi-track shape
 * (trackRest, pauses and celebratedBy maps keyed by habit id, next to the still-shared ones).
 */
export const PER_TRACK_KEYS = ["goal", "baseline", "plan", "restDays", "weekFocus", "celebrated", "wear", "treatsGiven", "fedOn", "savingsGoal", "trackRest", "pauses", "celebratedBy"] as const;
export interface LegacyTrackSettings {
  goal?: string; baseline?: Baseline | null; plan?: RecoveryPlan | null; restDays?: string[]; weekFocus?: WeekFocus[]; celebrated?: number[];
  wear?: Accessory | null; treatsGiven?: number; fedOn?: string | null; savingsGoal?: SavingsGoal | null;
  trackRest?: Record<string, string[]>; pauses?: Record<string, Pause[]>; celebratedBy?: Record<string, number[]>;
}

/**
 * One track's state from the old shared settings, so each track keeps showing exactly what it showed before:
 * - Shared settings (plan, starting pace, weekly focus, accessory, treats, last fed, savings goal) were shown on
 *   every track, so every track gets a copy. Shared rest days applied to every track, so each track gets them plus
 *   its own. Pauses and celebrated milestones come from the per-habit maps; the one shared milestone list belonged
 *   to the first habit. The old "goal" text was the first habit's own words, so only it gets it as a description.
 * - Nothing is invented: a value that wasn't there stays at its default.
 */
export function trackFromLegacy(s: LegacyTrackSettings, habit: Habit, index: number, startedOn: string): TrackState {
  const pauses = s.pauses?.[habit.id] ?? [];
  const goal = index === 0 ? s.goal?.trim() ?? "" : "";
  return {
    ...defaultTrackState(startedOn),
    description: goal && goal !== habit.name.trim() ? goal.slice(0, 280) : "",
    status: pauses.some((p) => p.to === null) ? "paused" : "active",
    pauses,
    baseline: s.baseline ?? null, plan: s.plan ?? null, weekFocus: s.weekFocus ?? [],
    restDays: [...new Set([...(s.restDays ?? []), ...(s.trackRest?.[habit.id] ?? [])])].sort().slice(-4000),
    celebrated: s.celebratedBy?.[habit.id] ?? (index === 0 ? s.celebrated ?? [] : []),
    wear: s.wear ?? null, treatsGiven: s.treatsGiven ?? 0, fedOn: s.fedOn ?? null, savingsGoal: s.savingsGoal ?? null,
  };
}

/** The first day anything was recorded for a track, or null if nothing has been. */
export function firstEventDay(d: AppData, habitId: string): string | null {
  let first: string | null = null;
  const see = (day: string) => { if (first === null || day < first) first = day; };
  for (const e of d.entries) if (e.habitId === habitId) see(e.day);
  for (const c of d.cleanDays) if (c.habitId === habitId) see(c.day);
  for (const u of d.urges) if (u.habitId === habitId) see(u.day);
  return first;
}

/** The track's companions, current and past. */
export const companionsOf = (d: AppData, habitId: string): Companion[] => {
  const h = d.habits.find((x) => x.id === habitId);
  return d.companions.filter((c) => c.trackId === habitId || (!c.trackId && h?.companionId === c.id));
};

/**
 * A start date for a track that has none (older data): its current companion's birth or its first record,
 * whichever is earlier, the rule in docs/RECOVERY_RULES.md. Nothing is backdated past the track's own data.
 */
export function inferStartedOn(d: AppData, habit: Habit): string {
  const days = [d.companions.find((c) => c.id === habit.companionId)?.bornOn, firstEventDay(d, habit.id)].filter((x): x is string => !!x).sort();
  return days[0] ?? today();
}

/** A track's state with every default filled in. */
export function trackState(d: AppData, habitId: string): TrackState {
  const h = d.habits.find((x) => x.id === habitId);
  if (!h) return defaultTrackState(today());
  return h.track ?? defaultTrackState(inferStartedOn(d, h));
}

/** A day inside one of the track's pauses (from its first day, up to but not including the day it ended). */
export const isPausedOn = (s: TrackState, day: string): boolean => pausedOn(s.pauses, day);

/**
 * Whether a slip, goal-met mark, urge or rest day may be recorded on this track. Only an archived (read-only)
 * or missing track refuses. A pause never does: records always win over a pause (docs/RECOVERY_RULES.md), so
 * something that happened is never lost because tracking was paused.
 */
export function canRecord(d: AppData, habitId: string): boolean {
  return d.habits.some((h) => h.id === habitId) && trackState(d, habitId).status !== "archived";
}

export interface Track {
  id: string;
  habit: Habit;
  state: TrackState;
  name: string;
  description: string;
  /** The person's goal for this track (from its plan), if they set one. */
  goal: GoalKind | null;
  startedOn: string;
  status: TrackStatus;
  /** The current companion. Undefined only in damaged data. */
  companion: Companion | undefined;
}

export function getTrack(d: AppData, habitId: string): Track | undefined {
  const habit = d.habits.find((h) => h.id === habitId);
  if (!habit) return undefined;
  const state = trackState(d, habitId);
  return {
    id: habit.id, habit, state, name: habit.name, description: state.description, goal: state.plan?.goal ?? null,
    startedOn: state.startedOn, status: state.status, companion: d.companions.find((c) => c.id === habit.companionId),
  };
}

/** Tracks in the person's order, optionally only those with the given statuses. */
export function listTracks(d: AppData, statuses?: TrackStatus[]): Track[] {
  return d.habits.map((h) => getTrack(d, h.id)!).filter((t) => !statuses || statuses.includes(t.status));
}

/**
 * The track the single-pet screens show: the one focused on this phone if it still exists and isn't archived,
 * else the first active, then the first paused, then the first archived. With one track this is habits[0].
 */
export function focusedTrackId(d: AppData): string | undefined {
  const status = (h: Habit) => trackState(d, h.id).status;
  const f = d.settings.activeHabit && d.habits.find((h) => h.id === d.settings.activeHabit);
  if (f && status(f) !== "archived") return f.id;
  return (d.habits.find((h) => status(h) === "active") ?? d.habits.find((h) => status(h) === "paused") ?? d.habits[0])?.id;
}

export type TrackIssue =
  | { kind: "missing_companion"; habitId: string }
  | { kind: "companion_shared"; companionId: string; habitIds: string[] }
  | { kind: "companion_owner"; companionId: string; habitId: string }
  | { kind: "entry_cross_track"; entryId: string; habitId: string; companionId: string }
  | { kind: "pause_state"; habitId: string };

/** Every reference that would let one track's data reach another. Empty for healthy data. */
export function checkTracks(d: AppData): TrackIssue[] {
  const out: TrackIssue[] = [];
  const companions = new Map(d.companions.map((c) => [c.id, c]));
  const byCompanion = new Map<string, string[]>();
  for (const h of d.habits) {
    if (!companions.has(h.companionId)) out.push({ kind: "missing_companion", habitId: h.id });
    byCompanion.set(h.companionId, [...(byCompanion.get(h.companionId) ?? []), h.id]);
    const c = companions.get(h.companionId);
    if (c?.trackId && c.trackId !== h.id) out.push({ kind: "companion_owner", companionId: c.id, habitId: h.id });
    const s = h.track;
    if (s) {
      const open = s.pauses.filter((p) => p.to === null).length;
      if (open > 1 || (s.status === "paused") !== (open === 1)) out.push({ kind: "pause_state", habitId: h.id });
    }
  }
  for (const [companionId, habitIds] of byCompanion) if (habitIds.length > 1) out.push({ kind: "companion_shared", companionId, habitIds });
  for (const e of d.entries) {
    const owner = companions.get(e.companionId)?.trackId;
    if (owner && owner !== e.habitId) out.push({ kind: "entry_cross_track", entryId: e.id, habitId: e.habitId, companionId: e.companionId });
  }
  return out;
}

/**
 * Fills what older or partial data lacks, without inventing history: a state for every track (start date from
 * its own data), an owner for every companion, and a status that agrees with the pause history. Never drops an
 * event. Returns the same object when nothing needed fixing.
 */
export function repairTracks(d: AppData): AppData {
  let changed = false;
  const owner = new Map<string, string>();
  for (const h of d.habits) if (!owner.has(h.companionId)) owner.set(h.companionId, h.id);
  for (const e of d.entries) if (!owner.has(e.companionId)) owner.set(e.companionId, e.habitId);
  const companions = d.companions.map((c) => {
    if (c.trackId || !owner.has(c.id)) return c;
    changed = true;
    return { ...c, trackId: owner.get(c.id)! };
  });
  const withOwners = changed ? { ...d, companions } : d;
  const habits = d.habits.map((h) => {
    let s = h.track ?? defaultTrackState(inferStartedOn(withOwners, h));
    const open = s.pauses.filter((p) => p.to === null);
    if (s.status === "archived" && open.length) s = { ...s, pauses: s.pauses.map((p) => (p.to === null ? { ...p, to: s.archivedOn ?? today() } : p)) };
    else if (open.length > 1) s = { ...s, status: "paused", pauses: [...s.pauses.filter((p) => p.to !== null), open[open.length - 1]] };
    else if (open.length === 1 && s.status !== "paused") s = { ...s, status: "paused" };
    else if (!open.length && s.status === "paused") s = { ...s, status: "active" };
    if (s.status !== "archived" && s.archivedOn) s = { ...s, archivedOn: null };
    if (s === h.track) return h;
    changed = true;
    return { ...h, track: s };
  });
  return changed ? { ...withOwners, habits } : d;
}

/** Whether a track screen should say which track it shows: when there is more than one open track, or this one is paused. */
export function needsTrackContext(d: AppData, habitId: string): boolean {
  return listTracks(d, ["active", "paused"]).length > 1 || trackState(d, habitId).status === "paused";
}
