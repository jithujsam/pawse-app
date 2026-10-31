/**
 * Pet missions (PRD §23): one progression engine for both adoption modes. Pure: no I/O, no clock, no storage.
 *
 * A mission runs Level 6 → Level 1 → done. Its level comes only from cumulative goal-met days since the pet
 * arrived, read against cumulative thresholds (3, 7, 12, 18, 24, 30 by default). Counting a set of days makes the
 * result idempotent: the same records always give the same levels, and a day can never count twice. A slip only
 * changes its own day, so it never takes earlier days away.
 *
 * Rescue missions show a condition from -10 to 0; Raise missions a development score from 0 to 100. Same levels,
 * same thresholds, different scale.
 */

export type AdoptionMode = "raise" | "rescue";
export type MissionScale = "rehab" | "growth";
/** 6 is where a mission starts, 1 the last active level, 0 completed (Recovered or Mastered). */
export type MissionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Visible traits on the pet. Each is driven only by the missions that name it, never by one overall number. */
export type VisualTrait = "coat" | "posture" | "energy" | "trust" | "calm" | "curiosity" | "play" | "rest";
export const VISUAL_TRAITS: readonly VisualTrait[] = ["coat", "posture", "energy", "trust", "calm", "curiosity", "play", "rest"];

/** Optional extras that make a mission feel its own. They never gate a level. */
export type SecondaryKind = "urgesManaged" | "petDays";
export interface SecondaryDef { kind: SecondaryKind; target: number }

export interface MissionDef {
  /** Stable id, also the text id under `missions.<id>` in apps/web/src/text. */
  id: string;
  mode: AdoptionMode;
  scale: MissionScale;
  traits: VisualTrait[];
  /** Cumulative goal-met days to leave Level 6, 5, 4, 3, 2 and 1. Defaults to MISSION_THRESHOLDS. */
  thresholds?: readonly number[];
  secondary?: SecondaryDef;
}

/** Bumped when the mission set changes, so stored completions can be read against the set they were earned in. */
export const MISSION_SET_VERSION = 1;

/** Cumulative goal-met days since adoption to leave Level 6, 5, 4, 3, 2 and 1 (the last one completes it). */
export const MISSION_THRESHOLDS: readonly number[] = [3, 7, 12, 18, 24, 30];

/** Shown value per level, index 0 = Level 6 ... index 5 = Level 1, index 6 = completed. */
export const SCALE_VALUES: Record<MissionScale, readonly number[]> = {
  rehab: [-10, -8, -6, -4, -2, -1, 0],
  growth: [0, 20, 40, 60, 80, 90, 100],
};
export const SCALE_RANGE: Record<MissionScale, { start: number; target: number }> = {
  rehab: { start: -10, target: 0 },
  growth: { start: 0, target: 100 },
};

/** A short status for each level, as a stable id (the words live in the text catalogue). */
export type MissionStatus = "starting" | "first_steps" | "stabilizing" | "recovering" | "strong" | "final" | "done";
const STATUS_BY_LEVEL: Record<MissionLevel, MissionStatus> = { 6: "starting", 5: "first_steps", 4: "stabilizing", 3: "recovering", 2: "strong", 1: "final", 0: "done" };

export const MISSIONS: readonly MissionDef[] = [
  // Rescue & Rebuild: rehabilitation, -10 to 0.
  { id: "rescue_trust", mode: "rescue", scale: "rehab", traits: ["trust"], secondary: { kind: "petDays", target: 20 } },
  { id: "rescue_physical", mode: "rescue", scale: "rehab", traits: ["coat", "posture", "energy"] },
  { id: "rescue_fear", mode: "rescue", scale: "rehab", traits: ["calm"], secondary: { kind: "urgesManaged", target: 5 } },
  { id: "rescue_confidence", mode: "rescue", scale: "rehab", traits: ["curiosity", "posture"] },
  { id: "rescue_play", mode: "rescue", scale: "rehab", traits: ["play"], secondary: { kind: "petDays", target: 10 } },
  { id: "rescue_safe", mode: "rescue", scale: "rehab", traits: ["rest"] },
  // Raise a Puppy: development, 0 to 100.
  { id: "raise_bond", mode: "raise", scale: "growth", traits: ["trust"], secondary: { kind: "petDays", target: 20 } },
  { id: "raise_play", mode: "raise", scale: "growth", traits: ["play"], secondary: { kind: "petDays", target: 10 } },
  { id: "raise_explore", mode: "raise", scale: "growth", traits: ["curiosity"] },
  { id: "raise_strong", mode: "raise", scale: "growth", traits: ["coat", "posture", "energy"] },
  { id: "raise_confidence", mode: "raise", scale: "growth", traits: ["calm"], secondary: { kind: "urgesManaged", target: 5 } },
  { id: "raise_routines", mode: "raise", scale: "growth", traits: ["rest"] },
];

export const missionsFor = (mode: AdoptionMode, defs: readonly MissionDef[] = MISSIONS) => defs.filter((m) => m.mode === mode);

export interface MissionInput {
  /** Distinct goal-met days without a slip, from the day the pet arrived up to today. */
  goalMetDays: number;
  /** Mission ids already completed once. A completion is kept even if a later correction lowers the count. */
  completed?: readonly string[];
  /** Counts for the optional extras. */
  extras?: Partial<Record<SecondaryKind, number>>;
}

export interface MissionState {
  id: string;
  mode: AdoptionMode;
  scale: MissionScale;
  level: MissionLevel;
  completed: boolean;
  status: MissionStatus;
  /** Condition (rehab, -10..0) or development score (growth, 0..100). */
  value: number;
  start: number;
  target: number;
  /** How far the value has come, 0..1. */
  pct: number;
  /** Goal-met days counted, never more than the final threshold. */
  days: number;
  /** Goal-met days still needed to complete the mission (0 when completed). */
  remaining: number;
  /** The threshold for the next level, or null when completed. */
  nextAt: number | null;
  /** The level reached at nextAt (0 = completed), or null when completed. */
  nextLevel: MissionLevel | null;
  /** The previous threshold (0 at Level 6), for a per-step progress bar. */
  prevAt: number;
  /** Levels already reached past the start, highest number first (5, 4, ...; 0 = completed). */
  reached: MissionLevel[];
  extra: { kind: SecondaryKind; have: number; target: number; done: boolean } | null;
}

const clampInt = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Validates thresholds: six strictly rising positive whole numbers. Anything else falls back to the default. */
export function thresholdsOf(def: Pick<MissionDef, "thresholds">): readonly number[] {
  const t = def.thresholds;
  if (!t || t.length !== 6 || t.some((x, i) => !Number.isInteger(x) || x <= 0 || (i > 0 && x <= t[i - 1]))) return MISSION_THRESHOLDS;
  return t;
}

/** Level for a count of goal-met days: 6 below the first threshold, 0 at or past the last. */
export function levelForDays(days: number, thresholds: readonly number[] = MISSION_THRESHOLDS): MissionLevel {
  const n = clampInt(days);
  const passed = thresholds.filter((t) => n >= t).length;
  return (6 - passed) as MissionLevel;
}

/** The shown value for a level on a scale. */
export const valueForLevel = (scale: MissionScale, level: MissionLevel) => SCALE_VALUES[scale][6 - level];

export function missionState(def: MissionDef, input: MissionInput): MissionState {
  const th = thresholdsOf(def);
  const latched = !!input.completed?.includes(def.id);
  const days = Math.min(clampInt(input.goalMetDays), th[5]);
  const level: MissionLevel = latched ? 0 : levelForDays(days, th);
  const passed = 6 - level;
  const { start, target } = SCALE_RANGE[def.scale];
  const value = valueForLevel(def.scale, level);
  const reached = Array.from({ length: passed }, (_, i) => (5 - i) as MissionLevel);
  const have = clampInt(input.extras?.[def.secondary?.kind ?? "urgesManaged"] ?? 0);
  return {
    id: def.id, mode: def.mode, scale: def.scale, level, completed: level === 0, status: STATUS_BY_LEVEL[level],
    value, start, target, pct: (value - start) / (target - start),
    days: latched ? th[5] : days,
    remaining: level === 0 ? 0 : th[5] - days,
    nextAt: level === 0 ? null : th[passed], nextLevel: level === 0 ? null : ((level - 1) as MissionLevel),
    prevAt: passed === 0 ? 0 : th[passed - 1],
    reached,
    extra: def.secondary ? { kind: def.secondary.kind, have: Math.min(have, def.secondary.target), target: def.secondary.target, done: have >= def.secondary.target } : null,
  };
}

export function missionStates(mode: AdoptionMode, input: MissionInput, defs: readonly MissionDef[] = MISSIONS): MissionState[] {
  return missionsFor(mode, defs).map((d) => missionState(d, input));
}

/** Overall progress across a set: levels passed out of all levels, 0..1. */
export function overallProgress(states: readonly MissionState[]): { passed: number; total: number; pct: number; completed: number; active: number } {
  const passed = states.reduce((a, s) => a + (6 - s.level), 0);
  const total = states.length * 6;
  const completed = states.filter((s) => s.completed).length;
  return { passed, total, pct: total ? passed / total : 0, completed, active: states.length - completed };
}

// ---------- the health bar ----------

/** Where a rescued pet's health bar starts: 2 of 20 boxes green. */
export const RESCUE_HEALTH_START = 10;

/**
 * How much of the health bar a pet's missions allow, 0..100. A rescued pet arrives in poor shape, so its bar starts
 * at 10% and every level its missions pass turns more of it green, up to 100% when all are recovered: 25, 40, 55, 70,
 * 85, 100 on the default schedule. Rounded to whole boxes (5%). A raised puppy is healthy from the start: 100.
 */
export function missionHealthCap(mode: AdoptionMode, states: readonly MissionState[]): number {
  if (mode !== "rescue" || !states.length) return 100;
  const raw = RESCUE_HEALTH_START + (100 - RESCUE_HEALTH_START) * overallProgress(states).pct;
  return Math.min(100, Math.round(raw / 5) * 5);
}

// ---------- celebrations ----------

/** A milestone key: "<mission id>:<level reached>", with 0 for completion. */
export const milestoneKey = (id: string, level: MissionLevel) => `${id}:${level}`;

/**
 * The milestone to celebrate now: the furthest one reached and not yet seen, so a person with a long history (or
 * an upgrade that counts past days) sees one celebration, not a backlog. Everything reached is marked as seen with
 * it, and the same milestone never fires twice.
 */
export function missionMilestoneToCelebrate(states: readonly MissionState[], seen: readonly string[]): { id: string; level: MissionLevel; seen: string[] } | null {
  const reached = states.flatMap((s) => s.reached.map((level) => ({ id: s.id, level })));
  const fresh = reached.filter((r) => !seen.includes(milestoneKey(r.id, r.level)));
  if (!fresh.length) return null;
  const best = fresh.reduce((a, b) => (b.level < a.level ? b : a));
  return { ...best, seen: [...new Set([...seen, ...reached.map((r) => milestoneKey(r.id, r.level))])].sort() };
}

/** Mission ids that are complete now and not yet latched. */
export const newlyCompleted = (states: readonly MissionState[], completed: readonly string[]) => states.filter((s) => s.completed && !completed.includes(s.id)).map((s) => s.id);

// ---------- setbacks ----------

/** How long a setback lasts at most, in days counted from the slip day (the slip day and the next). */
export const SETBACK_DAYS = 2;

/**
 * A temporary setback after a slip: the pet is quieter and the missions sheet offers reassurance. It is active on
 * the slip day and the day after, and ends early with the next goal-met day. It never changes a level, a value or a
 * completion. Day keys are YYYY-MM-DD, so they compare as strings.
 */
export function setbackState(input: { lastSlip: string | null; lastGoalMet: string | null; today: string; daysSinceSlip: number | null }): { active: boolean } {
  const { lastSlip, lastGoalMet, today, daysSinceSlip } = input;
  if (!lastSlip || daysSinceSlip === null || lastSlip > today) return { active: false };
  if (daysSinceSlip < 0 || daysSinceSlip >= SETBACK_DAYS) return { active: false };
  if (lastGoalMet && lastGoalMet > lastSlip) return { active: false };
  return { active: true };
}

// ---------- the pet's look ----------

export type VisualStage = "initial" | "early" | "mid" | "late" | "recovered";

/**
 * Visible traits, each 0..1, from the missions that drive them. A rescued pet starts low on every trait; a raised
 * puppy starts healthy (0.7) and grows to 1. During a setback the pet is quieter: energy and play dip a little, and
 * nothing else changes.
 */
export function petTraits(mode: AdoptionMode, states: readonly MissionState[], opts: { setback?: boolean } = {}): Record<VisualTrait, number> {
  const base = mode === "rescue" ? 0 : 0.7;
  const out = {} as Record<VisualTrait, number>;
  for (const trait of VISUAL_TRAITS) {
    const driving = states.filter((s) => MISSIONS.find((m) => m.id === s.id)?.traits.includes(trait));
    const pct = driving.length ? driving.reduce((a, s) => a + s.pct, 0) / driving.length : 1;
    out[trait] = base + (1 - base) * pct;
  }
  if (opts.setback) { out.energy = Math.max(0, out.energy - 0.2); out.play = Math.max(0, out.play - 0.25); }
  return out;
}

/** A coarse stage for labels and art switches, from overall progress. */
export function visualStage(states: readonly MissionState[]): VisualStage {
  const { pct } = overallProgress(states);
  if (states.length && states.every((s) => s.completed)) return "recovered";
  if (pct >= 0.66) return "late";
  if (pct >= 0.33) return "mid";
  if (pct > 0) return "early";
  return "initial";
}
