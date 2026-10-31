/**
 * Pet missions (PRD §23): the rescue's recovery journey. Pure: no I/O, no clock, no storage.
 *
 * The person picks a journey target (30, 60 or 120 days). The pet has six conditions, treated one at a time, mildest
 * first. Each needs a number of goal-met days in a row; together they add up to the recovery length, which is half the
 * target and never under 21 days (21, 30, 60). The split grows 1:2:3:4:5:6, so with 21 days it is 1, 2, 3, 4, 5, 6.
 *
 * - A goal-met day (no slip that day) adds a day to the condition being treated.
 * - Days with nothing recorded, rest days and paused days don't count either way.
 * - Rescue: a slip resets the condition being treated to 0 and brings back the last one healed. That's the cost.
 *   Raise: a slip resets the skill being learned, but nothing learned is forgotten.
 * - Once all six are healed the pet is recovered, and the rest of the journey is about staying consistent. Each slip
 *   then costs health (the damage engine, as before), and 5 slips within 30 days bring the last condition back.
 *
 * Everything is folded from the day-by-day records, so the same records always give the same journey and a day can
 * never count twice.
 */

export type AdoptionMode = "raise" | "rescue";

export const JOURNEY_TARGETS = [30, 60, 120] as const;
export type JourneyTarget = (typeof JOURNEY_TARGETS)[number];
export const DEFAULT_TARGET: JourneyTarget = 30;
export const isJourneyTarget = (n: unknown): n is JourneyTarget => JOURNEY_TARGETS.includes(n as JourneyTarget);

/** Full recovery never takes fewer than this many goal-met days. */
export const MIN_RECOVERY_DAYS = 21;
/** Recovery is done by half the target, and never in fewer than 21 days. */
export const recoveryDays = (target: number) => Math.max(MIN_RECOVERY_DAYS, Math.round(target / 2));

/** How the recovery length is split across the six conditions, mildest first. */
export const STEP_WEIGHTS: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Goal-met days in a row each condition needs, in treatment order. Sums to recoveryDays(target); each at least 1. */
export function stepDays(target: number): number[] {
  const total = recoveryDays(target);
  const sum = STEP_WEIGHTS.reduce((a, b) => a + b, 0);
  let acc = 0, prev = 0;
  return STEP_WEIGHTS.map((w, i) => {
    acc += w;
    const at = i === STEP_WEIGHTS.length - 1 ? total : Math.max(prev + 1, Math.round((total * acc) / sum));
    const step = at - prev;
    prev = at;
    return step;
  });
}

/** After recovery: this many slips within RELAPSE_WINDOW days bring the last condition back. */
export const RELAPSE_SLIPS = 5;
export const RELAPSE_WINDOW = 30;

/** Visible traits on the pet. Each is driven only by the conditions that name it. */
export type VisualTrait = "coat" | "posture" | "energy" | "trust" | "calm" | "curiosity" | "play" | "rest";
export const VISUAL_TRAITS: readonly VisualTrait[] = ["coat", "posture", "energy", "trust", "calm", "curiosity", "play", "rest"];

export interface MissionDef { id: string; mode: AdoptionMode; traits: VisualTrait[] }

/** Bumped when the mission set changes. */
export const MISSION_SET_VERSION = 2;

/** In treatment order: the mildest, quickest to heal, first; the deepest last. */
export const MISSIONS: readonly MissionDef[] = [
  { id: "rescue_coat", mode: "rescue", traits: ["coat"] },
  { id: "rescue_energy", mode: "rescue", traits: ["energy", "posture"] },
  { id: "rescue_noise", mode: "rescue", traits: ["calm"] },
  { id: "rescue_play", mode: "rescue", traits: ["play", "curiosity"] },
  { id: "rescue_alone", mode: "rescue", traits: ["rest"] },
  { id: "rescue_trust", mode: "rescue", traits: ["trust"] },
  { id: "raise_name", mode: "raise", traits: ["trust"] },
  { id: "raise_routine", mode: "raise", traits: ["rest"] },
  { id: "raise_fetch", mode: "raise", traits: ["play"] },
  { id: "raise_explore", mode: "raise", traits: ["curiosity", "posture"] },
  { id: "raise_calm", mode: "raise", traits: ["calm"] },
  { id: "raise_strong", mode: "raise", traits: ["coat", "energy"] },
];
export const missionsFor = (mode: AdoptionMode) => MISSIONS.filter((m) => m.mode === mode);

/** One day since the pet arrived, in order. A slip wins over a goal-met mark on the same day. */
export interface DayRecord { day: string; met: boolean; slip: boolean }

export type JourneyEventKind = "healed" | "recovered" | "relapse" | "reset" | "complete";
export interface JourneyEvent { day: string; kind: JourneyEventKind; mission: string | null; lost?: number }

export interface MissionState {
  id: string;
  /** healed: done. current: being treated now. waiting: comes after the current one. */
  status: "healed" | "current" | "waiting";
  /** Goal-met days in a row it needs. */
  need: number;
  /** Goal-met days in a row so far (need when healed, 0 when waiting). */
  have: number;
}

export interface Journey {
  mode: AdoptionMode;
  target: JourneyTarget;
  recoveryDays: number;
  steps: number[];
  /** How many conditions are healed, 0..6. */
  healed: number;
  /** Goal-met days in a row on the condition being treated. */
  progress: number;
  recovered: boolean;
  recoveredOn: string | null;
  /** Recovery so far, 0..100 (whole numbers). 100 when recovered. */
  pct: number;
  /** Distinct goal-met days since the pet arrived (slip days excluded). */
  goalMetDays: number;
  /** The whole journey is done: recovered and goal-met days reached the target. */
  complete: boolean;
  /** After recovery: slips in the current 30-day window, toward RELAPSE_SLIPS. */
  slipsInWindow: number;
  missions: MissionState[];
  events: JourneyEvent[];
  lastSlip: string | null;
  lastMet: string | null;
}

const dayNum = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);

export function journey(mode: AdoptionMode, target: number, days: readonly DayRecord[]): Journey {
  const t: JourneyTarget = isJourneyTarget(target) ? target : DEFAULT_TARGET;
  const steps = stepDays(t);
  const defs = missionsFor(mode);
  const events: JourneyEvent[] = [];
  let healed = 0, progress = 0, recoveredOn: string | null = null, goalMetDays = 0, completeOn: string | null = null;
  let windowSlips: string[] = [];
  let lastSlip: string | null = null, lastMet: string | null = null;
  for (const r of days) {
    if (r.slip) {
      lastSlip = r.day;
      if (healed < 6) {
        const lost = progress;
        progress = 0;
        if (mode === "rescue" && healed > 0) { healed--; events.push({ day: r.day, kind: "relapse", mission: defs[healed].id, lost }); }
        else if (lost > 0) events.push({ day: r.day, kind: "reset", mission: defs[healed].id, lost });
      } else {
        windowSlips = [...windowSlips.filter((d) => dayNum(r.day) - dayNum(d) < RELAPSE_WINDOW), r.day];
        if (windowSlips.length >= RELAPSE_SLIPS) {
          healed = 5; progress = 0; recoveredOn = null; windowSlips = [];
          events.push({ day: r.day, kind: "relapse", mission: defs[5].id });
        }
      }
    } else if (r.met) {
      lastMet = r.day;
      goalMetDays++;
      if (healed < 6) {
        progress++;
        if (progress >= steps[healed]) {
          events.push({ day: r.day, kind: "healed", mission: defs[healed].id });
          healed++; progress = 0;
          if (healed === 6) { recoveredOn = r.day; windowSlips = []; events.push({ day: r.day, kind: "recovered", mission: null }); }
        }
      }
      if (!completeOn && healed === 6 && goalMetDays >= t) { completeOn = r.day; events.push({ day: r.day, kind: "complete", mission: null }); }
    }
  }
  const recovered = healed === 6;
  const done = steps.slice(0, healed).reduce((a, b) => a + b, 0);
  const total = recoveryDays(t);
  return {
    mode, target: t, recoveryDays: total, steps, healed, progress, recovered, recoveredOn,
    pct: recovered ? 100 : Math.min(99, Math.floor(((done + progress) / total) * 100)),
    goalMetDays, complete: recovered && goalMetDays >= t,
    slipsInWindow: recovered ? windowSlips.length : 0,
    missions: defs.map((d, i) => ({
      id: d.id, need: steps[i],
      status: i < healed ? "healed" : i === healed ? "current" : "waiting",
      have: i < healed ? steps[i] : i === healed ? progress : 0,
    })),
    events, lastSlip, lastMet,
  };
}

/** Slips in the window as of `today`, after recovery (older ones age out). */
export function slipsInWindowOn(j: Journey, today: string, slipDays: readonly string[]): number {
  if (!j.recovered || !j.recoveredOn) return 0;
  return slipDays.filter((d) => d > j.recoveredOn! && d <= today && dayNum(today) - dayNum(d) < RELAPSE_WINDOW).length;
}

// ---------- the health bar ----------

/** Where a rescued pet's health bar starts: 2 of 20 boxes green. */
export const RESCUE_HEALTH_START = 10;

/**
 * How much of the health bar the journey allows, 0..100. A rescued pet arrives in poor shape, so its bar starts at 10%
 * and turns green with recovery, in whole boxes (5%): 100% once recovered. A raised puppy is healthy from the start.
 */
export function missionHealthCap(j: Pick<Journey, "mode" | "recovered" | "pct">): number {
  if (j.mode !== "rescue" || j.recovered) return 100;
  return Math.min(100, Math.round((RESCUE_HEALTH_START + ((100 - RESCUE_HEALTH_START) * j.pct) / 100) / 5) * 5);
}

// ---------- setbacks ----------

export const SETBACK_DAYS = 2;

/**
 * A short setback after a slip: the pet is quieter and Missions offers reassurance. Active on the slip day and the day
 * after, ending early with the next goal-met day. It changes nothing in the journey.
 */
export function setbackState(input: { lastSlip: string | null; lastGoalMet: string | null; today: string; daysSinceSlip: number | null }): { active: boolean } {
  const { lastSlip, lastGoalMet, today, daysSinceSlip } = input;
  if (!lastSlip || daysSinceSlip === null || lastSlip > today) return { active: false };
  if (daysSinceSlip < 0 || daysSinceSlip >= SETBACK_DAYS) return { active: false };
  if (lastGoalMet && lastGoalMet > lastSlip) return { active: false };
  return { active: true };
}

// ---------- the pet's look ----------

/**
 * Visible traits, each 0..1, from the conditions that drive them: healed is 1, the one being treated is part way, and
 * one still waiting is 0 for a rescue. A raised puppy starts healthy (0.7) and grows to 1. During a setback the pet is
 * quieter: energy and play dip a little.
 */
export function petTraits(j: Pick<Journey, "mode" | "missions">, opts: { setback?: boolean } = {}): Record<VisualTrait, number> {
  const base = j.mode === "rescue" ? 0 : 0.7;
  const out = {} as Record<VisualTrait, number>;
  for (const trait of VISUAL_TRAITS) {
    const driving = j.missions.filter((m) => MISSIONS.find((d) => d.id === m.id)?.traits.includes(trait));
    const pct = driving.length ? driving.reduce((a, m) => a + m.have / m.need, 0) / driving.length : 1;
    out[trait] = base + (1 - base) * pct;
  }
  if (opts.setback) { out.energy = Math.max(0, out.energy - 0.2); out.play = Math.max(0, out.play - 0.25); }
  return out;
}
