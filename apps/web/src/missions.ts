import {
  MISSION_SET_VERSION, missionHealthCap, missionMilestoneToCelebrate, missionStates, newlyCompleted, overallProgress, petTraits, setbackState, visualStage,
  type AdoptionMode, type MissionLevel, type MissionState, type VisualStage, type VisualTrait,
} from "@detox/engine";
import { daysFrom, streaks, trackIndex } from "./progress";
import type { AppData, Companion, MissionMemory, Species } from "./types";

/**
 * Pet missions for one companion (PRD §23), worked out from its track's own records each time, like every other
 * recovery number (progress.ts). The engine (packages/engine/src/missions.ts) holds the rules; this file only reads
 * the app's data into it.
 *
 * - Progress: distinct goal-met days without a slip, from the day the pet arrived up to today. A set of days, so
 *   the same day never counts twice and the result is the same however often it's worked out.
 * - A slip only changes its own day: it never removes earlier days, levels or completions.
 * - Completions once reached are remembered (MissionMemory.done), so a later correction never takes one back.
 */

/** Species that can be adopted as a rescue. Others are always raised. */
export const RESCUE_SPECIES: readonly Species[] = ["dog"];

export const emptyMemory = (): MissionMemory => ({ v: MISSION_SET_VERSION, done: [], seen: [], petDays: 0, petOn: null });
export const memoryOf = (c: Companion | undefined): MissionMemory => ({ ...emptyMemory(), ...(c?.missions ?? {}) });
/** Every pet from before missions is raised. */
export const adoptionOf = (c: Companion | undefined): AdoptionMode => c?.adoption ?? "raise";

/** Unions two mission memories: completions and celebrations only ever grow, whichever phone saw them first. */
export function mergeMemory(a: MissionMemory | undefined, b: MissionMemory | undefined): MissionMemory | undefined {
  if (!a) return b;
  if (!b) return a;
  const pick = (a.petDays ?? 0) >= (b.petDays ?? 0) ? a : b;
  return {
    v: Math.max(a.v, b.v),
    done: [...new Set([...a.done, ...b.done])].sort(),
    seen: [...new Set([...a.seen, ...b.seen])].sort(),
    petDays: pick.petDays ?? 0,
    petOn: pick.petOn ?? null,
  };
}

/** The track a companion belongs to. */
function trackOf(d: AppData, c: Companion): string | undefined {
  return c.trackId ?? d.habits.find((h) => h.companionId === c.id)?.id;
}

export interface CompanionMissions {
  mode: AdoptionMode;
  goalMetDays: number;
  states: MissionState[];
  overall: ReturnType<typeof overallProgress>;
  setback: boolean;
  traits: Record<VisualTrait, number>;
  stage: VisualStage;
  memory: MissionMemory;
  /** How much of the health bar the missions allow, 0..100: a rescue starts at 10, a raised puppy is always 100. */
  healthCap: number;
  /** The next milestone over all missions: the lowest threshold still ahead, or null when everything is done. */
  next: { at: number; level: MissionLevel; toGo: number } | null;
}

/** Distinct goal-met days without a slip on a track, from `from` up to today. */
export function goalMetDaysSince(d: AppData, habitId: string, from: string, today: string, until?: string | null): number {
  const idx = trackIndex(d, habitId, today);
  let n = 0;
  for (const day of idx.met) if (day >= from && day <= today && (!until || day <= until) && !idx.slips.has(day)) n++;
  return n;
}

export function companionMissions(d: AppData, companionId: string, today: string): CompanionMissions | null {
  const c = d.companions.find((x) => x.id === companionId);
  if (!c) return null;
  const habitId = trackOf(d, c);
  const mode = adoptionOf(c);
  const memory = memoryOf(c);
  const goalMetDays = habitId ? goalMetDaysSince(d, habitId, c.bornOn, today, c.diedOn) : 0;
  const urgesManaged = habitId ? d.urges.filter((u) => u.habitId === habitId && u.outcome === "rode_it_out" && u.day >= c.bornOn && u.day <= today).length : 0;
  const states = missionStates(mode, { goalMetDays, completed: memory.done, extras: { urgesManaged, petDays: memory.petDays ?? 0 } });
  let setback = false;
  if (habitId && !c.diedOn) {
    const idx = trackIndex(d, habitId, today);
    const { lastSlip } = streaks(idx);
    let lastGoalMet: string | null = null;
    for (const day of idx.met) if (!idx.slips.has(day) && day <= today && (!lastGoalMet || day > lastGoalMet)) lastGoalMet = day;
    setback = setbackState({ lastSlip, lastGoalMet, today, daysSinceSlip: lastSlip ? daysFrom(lastSlip, today) : null }).active;
  }
  const ahead = states.filter((s) => s.nextAt !== null).sort((a, b) => a.nextAt! - b.nextAt!)[0];
  return {
    mode, goalMetDays, states, overall: overallProgress(states), setback,
    traits: petTraits(mode, states, { setback }), stage: visualStage(states), memory, healthCap: missionHealthCap(mode, states),
    next: ahead ? { at: ahead.nextAt!, level: ahead.nextLevel!, toGo: Math.max(0, ahead.nextAt! - goalMetDays) } : null,
  };
}

/**
 * What to remember after a change: completions reached now and the milestone to celebrate (one at most). Null when
 * nothing new happened, so callers don't write (and sync) an unchanged companion.
 */
export function missionUpdate(d: AppData, companionId: string, today: string): { memory: MissionMemory; celebrate: { id: string; level: MissionLevel } | null } | null {
  const m = companionMissions(d, companionId, today);
  if (!m) return null;
  const done = newlyCompleted(m.states, m.memory.done);
  const cel = missionMilestoneToCelebrate(m.states, m.memory.seen);
  if (!done.length && !cel) return null;
  return {
    memory: { ...m.memory, done: [...new Set([...m.memory.done, ...done])].sort(), seen: cel?.seen ?? m.memory.seen },
    celebrate: cel ? { id: cel.id, level: cel.level } : null,
  };
}

/** Counts today as a day with the pet, at most once a day. Null when today is already counted. */
export function withPetDay(c: Companion, today: string): MissionMemory | null {
  const m = memoryOf(c);
  if (m.petOn === today) return null;
  return { ...m, petDays: (m.petDays ?? 0) + 1, petOn: today };
}

/**
 * The health bar's percentage for a pet: its health from slips and goal-met days (100 - age), limited by how far its
 * missions have come. A rescued pet's bar starts mostly red and turns green as missions are completed.
 */
export function shownHealth(age: number, healthCap: number): number {
  return Math.max(0, Math.min(100, Math.round(((100 - age) * healthCap) / 100)));
}
