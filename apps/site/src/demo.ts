import { journey, petTraits, wellness, type AdoptionMode, type DayRecord, type Journey, type VisualTrait } from "@detox/engine";

/**
 * The "Try the 21 days" panel. Every number comes from the app's own mission engine (packages/engine/src/missions.ts):
 * this file only turns the visitor's taps into day records, the way the app reads a track's goal-met days and slips.
 */
export type Mark = "met" | "slip";

export interface DemoView {
  j: Journey;
  wellness: number;
  traits: Record<VisualTrait, number>;
  /** The visitor's last tap, for the dog's reaction. */
  last: Mark | null;
  day: number;
}

const START = Date.UTC(2026, 0, 1);
const dayKey = (i: number) => new Date(START + i * 86_400_000).toISOString().slice(0, 10);

/** One record per tap, on consecutive days. */
export const toRecords = (marks: readonly Mark[]): DayRecord[] => marks.map((m, i) => ({ day: dayKey(i), met: m === "met", slip: m === "slip" }));

export function view(mode: AdoptionMode, marks: readonly Mark[]): DemoView {
  const j = journey(mode, toRecords(marks));
  return { j, wellness: wellness(j), traits: petTraits(j), last: marks.at(-1) ?? null, day: marks.length };
}

/** Jump to a day: goal-met days in a row up to it, keeping any slips the visitor already made before it. */
export function jumpTo(marks: readonly Mark[], n: number): Mark[] {
  const kept = marks.slice(0, n);
  while (kept.length < n) kept.push("met");
  return kept;
}

/** The dog's mood and gesture for a view, as the app's Home picks them (Companion.tsx moodFor). */
export function dogState(v: DemoView, justTapped: boolean): { mood: "happy" | "sad" | "waiting" | "idle"; gesture: "hop" | "none" } {
  if (justTapped && v.last === "met") return { mood: "happy", gesture: "hop" };
  if (v.last === "slip") return { mood: "sad", gesture: "none" };
  if (v.last === "met") return { mood: "happy", gesture: "none" };
  return { mood: "waiting", gesture: "none" };
}
