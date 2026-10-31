import {
  HEAVY_SEVERITY, journey, MISSION_SET_VERSION, missionHealthCap, petTraits, setbackState,
  type AdoptionMode, type DayRecord, type Journey, type JourneyEvent, type VisualTrait,
} from "@detox/engine";
import { daysFrom, trackIndex } from "./progress";
import type { AppData, Companion, MissionMemory, Species } from "./types";

/**
 * Pet missions for one companion (PRD §23), worked out from its track's own records each time, like every other
 * recovery number (progress.ts). The engine (packages/engine/src/missions.ts) holds the rules; this file only reads
 * the app's data into it. Only the pop-ups already shown are stored.
 */

/** Species that can be adopted as a rescue: every pet, whatever its model or breed. */
export const RESCUE_SPECIES: readonly Species[] = ["dog", "cat", "fox"];

export const emptyMemory = (): MissionMemory => ({ v: MISSION_SET_VERSION, done: [], seen: [] });
export const memoryOf = (c: Companion | undefined): MissionMemory => ({ ...emptyMemory(), ...(c?.missions ?? {}) });
/** Every pet from before missions is raised. */
export const adoptionOf = (c: Companion | undefined): AdoptionMode => c?.adoption ?? "raise";

/** Keeps the most recent celebration keys only, so the list stays small. */
const SEEN_MAX = 200;

/** Merges two mission memories (sync, backups): pop-ups seen on either side stay seen. */
export function mergeMemory(a: MissionMemory | undefined, b: MissionMemory | undefined): MissionMemory | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    v: Math.max(a.v, b.v),
    done: [...new Set([...a.done, ...b.done])].sort(),
    seen: [...new Set([...a.seen, ...b.seen])].sort().slice(-SEEN_MAX),
  };
}

/** The track a companion belongs to. */
const trackOf = (d: AppData, c: Companion) => c.trackId ?? d.habits.find((h) => h.companionId === c.id)?.id;

/**
 * One record per day with a goal-met mark or a slip, from the pet's arrival to today (or its passing). A slip day is
 * heavy when a slip that day was severe (HEAVY_SEVERITY) or there were 3 or more slips.
 */
export function dayRecords(d: AppData, companionId: string, today: string): DayRecord[] {
  const c = d.companions.find((x) => x.id === companionId);
  const habitId = c && trackOf(d, c);
  if (!c || !habitId) return [];
  const idx = trackIndex(d, habitId, today);
  const last = c.diedOn && c.diedOn < today ? c.diedOn : today;
  const days = [...new Set([...idx.met, ...idx.slips.keys()])].filter((x) => x >= c.bornOn && x <= last).sort();
  const severe = new Set(d.entries.filter((e) => e.habitId === habitId && e.severity >= HEAVY_SEVERITY).map((e) => e.day));
  return days.map((day) => ({ day, met: idx.met.has(day), slip: idx.slips.has(day), heavy: severe.has(day) || (idx.slips.get(day) ?? 0) >= 3 }));
}

export interface CompanionMissions {
  mode: AdoptionMode;
  journey: Journey;
  setback: boolean;
  traits: Record<VisualTrait, number>;
  memory: MissionMemory;
  /** How much of the health bar the journey allows, 0..100: a rescue starts at 10; an issue lowers it. */
  healthCap: number;
}

export function companionMissions(d: AppData, companionId: string, today: string): CompanionMissions | null {
  const c = d.companions.find((x) => x.id === companionId);
  if (!c) return null;
  const mode = adoptionOf(c);
  const memory = memoryOf(c);
  const records = dayRecords(d, companionId, today);
  const j = journey(mode, records);
  const setback = !c.diedOn && setbackState({ lastSlip: j.lastSlip, lastGoalMet: j.lastMet, today, daysSinceSlip: j.lastSlip ? daysFrom(j.lastSlip, today) : null }).active;
  return {
    mode, journey: j, setback, traits: petTraits(j, { setback }), memory, healthCap: missionHealthCap(j),
  };
}

const PRIORITY: JourneyEvent["kind"][] = ["recovered", "reward", "cleared", "healed", "issue", "restart"];
export const eventKey = (e: JourneyEvent) => `${e.kind}:${e.id ?? "all"}:${e.day}`;

/**
 * Today's most important journey event not shown yet (a condition healed, recovery, a reward, an issue from a slip
 * or one cleared, or recovery starting over), with the memory that marks it shown. Null when there's nothing new, so callers don't write
 * (and sync) an unchanged companion.
 */
export function missionUpdate(d: AppData, companionId: string, today: string): { memory: MissionMemory; event: JourneyEvent } | null {
  const m = companionMissions(d, companionId, today);
  if (!m) return null;
  const fresh = m.journey.events.filter((e) => e.day === today && !m.memory.seen.includes(eventKey(e)));
  if (!fresh.length) return null;
  const event = [...fresh].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0];
  const done = event.kind === "recovered" ? [...new Set([...m.memory.done, event.kind])].sort() : m.memory.done;
  return { event, memory: { ...m.memory, done, seen: [...m.memory.seen, ...fresh.map(eventKey)].slice(-SEEN_MAX) } };
}

/**
 * The health bar's percentage for a pet: its health from slips and goal-met days (100 - age), limited by how far its
 * recovery has come. A rescued pet's bar starts mostly red and turns green as it recovers.
 */
export function shownHealth(age: number, healthCap: number): number {
  return Math.max(0, Math.min(100, Math.round(((100 - age) * healthCap) / 100)));
}
