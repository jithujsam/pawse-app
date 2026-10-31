/**
 * Pet missions (PRD §23): the pet's 42-day journey. Pure: no I/O, no clock, no storage.
 *
 * 1. Recovery (strict): 21 goal-met days in a row. Six conditions heal along the way, on days 1, 3, 6, 10, 15 and 21.
 *    A slip starts recovery over at day 0.
 * 2. Consistency: 21 more goal-met days, with rewards at 7, 14 and 21. A slip no longer restarts anything: it gives
 *    the pet an issue, and goal-met days clear the issue before they count toward consistency again.
 * 3. Thriving: after day 42. The same slip rule; a reward every 30 well days.
 *
 * A slip after recovery scores points: 1, +1 for a 2nd slip within 7 days, +1 for a 3rd within 7 days, +1 for 3 or
 * more within 30 days, +1 for a heavy slip (high severity, or 3+ slips that day). Tier = min(3, points):
 * minor (3 days in a row to clear), moderate (7), serious (14). A slip while an issue is still active raises it at
 * least one tier (serious is the most) and restarts its count. Days with nothing recorded, rest days and paused days count neither way.
 *
 * Everything is folded from day records, so the same records always give the same journey.
 */

export type AdoptionMode = "raise" | "rescue";

/** Goal-met days in a row to recover. */
export const RECOVERY_DAYS = 21;
/** Goal-met days of consistency after recovery, while the pet is well. */
export const CONSISTENCY_DAYS = 21;
/** The day of the recovery run on which each condition heals, in order. */
export const HEAL_AT: readonly number[] = [1, 3, 6, 10, 15, 21];
/** Consistency rewards, in days of consistency. */
export const CONSISTENCY_REWARDS: readonly number[] = [7, 14, 21];
/** While thriving, a reward every this many well days. */
export const THRIVING_REWARD_EVERY = 30;

export type IssueTier = 1 | 2 | 3;
/** Goal-met days in a row that clear an issue of each tier. */
export const ISSUE_DAYS: Record<IssueTier, number> = { 1: 3, 2: 7, 3: 14 };
/** How far an issue lowers the health bar at its start, by tier. It comes back as the issue clears. */
export const ISSUE_HEALTH: Record<IssueTier, number> = { 1: 15, 2: 30, 3: 50 };
/** A slip counts as heavy at this severity or above (engine severity runs 0.5 to 3). */
export const HEAVY_SEVERITY = 2;

/** Visible traits on the pet. Each is driven only by the conditions or issues that name it. */
export type VisualTrait = "coat" | "posture" | "energy" | "trust" | "calm" | "curiosity" | "play" | "rest";
export const VISUAL_TRAITS: readonly VisualTrait[] = ["coat", "posture", "energy", "trust", "calm", "curiosity", "play", "rest"];

export interface MissionDef { id: string; mode: AdoptionMode; traits: VisualTrait[] }

/** Bumped when the mission set changes. */
export const MISSION_SET_VERSION = 3;

/** In healing order: the mildest first, the deepest last. */
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

/** Issues a slip can bring after recovery. Minor ones take turns so they don't feel repetitive. */
export const ISSUES: Record<IssueTier, readonly { id: string; traits: VisualTrait[] }[]> = {
  1: [{ id: "issue_stomach", traits: ["energy"] }, { id: "issue_restless", traits: ["rest"] }, { id: "issue_itch", traits: ["coat"] }],
  2: [{ id: "issue_fear", traits: ["calm", "posture"] }],
  3: [{ id: "issue_withdrawn", traits: ["trust", "play", "energy"] }],
};
export const ISSUE_IDS: readonly string[] = [...ISSUES[1], ...ISSUES[2], ...ISSUES[3]].map((x) => x.id);

/** One day since the pet arrived, in order. A slip wins over a goal-met mark on the same day. */
export interface DayRecord { day: string; met: boolean; slip: boolean; heavy?: boolean }

export type Phase = "recovery" | "consistency" | "thriving";
export type JourneyEventKind = "healed" | "recovered" | "restart" | "issue" | "cleared" | "reward";
export interface JourneyEvent { day: string; kind: JourneyEventKind; id: string | null; tier?: IssueTier; n?: number }

export interface Issue { id: string; tier: IssueTier; need: number; have: number }

export interface MissionState {
  id: string;
  status: "healed" | "current" | "waiting";
  /** The day of the recovery run it heals on. */
  at: number;
}

export interface Journey {
  mode: AdoptionMode;
  phase: Phase;
  /** Goal-met days in a row in recovery, 0..21 (21 once recovered). */
  run: number;
  /** Days of consistency so far, 0..21. */
  consistency: number;
  /** Well days since thriving began. */
  thriving: number;
  issue: Issue | null;
  /** Recovery so far, 0..100. */
  pct: number;
  recoveredOn: string | null;
  missions: MissionState[];
  /** Rewards earned, in order (consistency 7, 14, 21, then thriving every 30). */
  rewards: number;
  events: JourneyEvent[];
  lastSlip: string | null;
  lastMet: string | null;
  /** Distinct goal-met days since the pet arrived. */
  goalMetDays: number;
}

const dayNum = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);

/** The tier a slip earns, from the slip days since recovery (this one included). */
export function slipTier(slipDays: readonly string[], day: string, heavy: boolean): IssueTier {
  const n = dayNum(day);
  const within = (w: number) => slipDays.filter((d) => d <= day && n - dayNum(d) < w).length;
  const s7 = within(7), s30 = within(30);
  const points = 1 + (s7 >= 2 ? 1 : 0) + (s7 >= 3 ? 1 : 0) + (s30 >= 3 ? 1 : 0) + (heavy ? 1 : 0);
  return Math.min(3, points) as IssueTier;
}

export function journey(mode: AdoptionMode, days: readonly DayRecord[]): Journey {
  const defs = missionsFor(mode);
  const events: JourneyEvent[] = [];
  let phase: Phase = "recovery";
  let run = 0, consistency = 0, thriving = 0, rewards = 0, goalMetDays = 0, minorCount = 0;
  let issue: Issue | null = null;
  let recoveredOn: string | null = null, lastSlip: string | null = null, lastMet: string | null = null;
  const slipsSince: string[] = [];
  for (const r of days) {
    if (r.slip) {
      lastSlip = r.day;
      if (phase === "recovery") {
        if (run > 0) events.push({ day: r.day, kind: "restart", id: null, n: run });
        run = 0;
        continue;
      }
      slipsSince.push(r.day);
      // A slip while the pet is still clearing an issue makes it worse: at least one tier up.
      const tier = Math.min(3, Math.max(slipTier(slipsSince, r.day, !!r.heavy), issue ? issue.tier + 1 : 1)) as IssueTier;
      const id: string = issue && issue.tier === tier ? issue.id : tier === 1 ? ISSUES[1][minorCount++ % ISSUES[1].length].id : ISSUES[tier][0].id;
      issue = { id, tier, need: ISSUE_DAYS[tier], have: 0 };
      events.push({ day: r.day, kind: "issue", id, tier });
      continue;
    }
    if (!r.met) continue;
    lastMet = r.day;
    goalMetDays++;
    if (phase === "recovery") {
      run++;
      const healed = HEAL_AT.indexOf(run);
      if (healed >= 0) events.push({ day: r.day, kind: "healed", id: defs[healed].id });
      if (run === RECOVERY_DAYS) { phase = "consistency"; recoveredOn = r.day; events.push({ day: r.day, kind: "recovered", id: null }); }
    } else if (issue) {
      issue = { ...issue, have: issue.have + 1 };
      if (issue.have >= issue.need) { events.push({ day: r.day, kind: "cleared", id: issue.id, tier: issue.tier }); issue = null; }
    } else if (phase === "consistency") {
      consistency++;
      if (CONSISTENCY_REWARDS.includes(consistency)) { rewards++; events.push({ day: r.day, kind: "reward", id: null, n: rewards }); }
      if (consistency === CONSISTENCY_DAYS) phase = "thriving";
    } else {
      thriving++;
      if (thriving % THRIVING_REWARD_EVERY === 0) { rewards++; events.push({ day: r.day, kind: "reward", id: null, n: rewards }); }
    }
  }
  return {
    mode, phase, run, consistency, thriving, issue, recoveredOn, rewards, events, lastSlip, lastMet, goalMetDays,
    pct: Math.round((run / RECOVERY_DAYS) * 100),
    missions: defs.map((d, i) => ({ id: d.id, at: HEAL_AT[i], status: run >= HEAL_AT[i] ? "healed" : (i === 0 ? 0 : HEAL_AT[i - 1]) <= run ? "current" : "waiting" })),
  };
}

// ---------- the health bar ----------

/** Where a rescued pet's health bar starts: 2 of 20 boxes green. */
export const RESCUE_HEALTH_START = 10;

/**
 * How much of the health bar the journey allows, 0..100, in whole boxes (5%). A rescue in recovery starts at 10% and
 * turns green day by day to 100% at day 21. After recovery an issue lowers it (15, 30 or 50 points by tier), coming
 * back as the issue clears. A raised puppy in training is never limited, but issues apply to it too.
 */
export function missionHealthCap(j: Pick<Journey, "mode" | "phase" | "run" | "issue">): number {
  const round5 = (x: number) => Math.min(100, Math.max(0, Math.round(x / 5) * 5));
  if (j.phase === "recovery") return j.mode === "rescue" ? round5(RESCUE_HEALTH_START + ((100 - RESCUE_HEALTH_START) * j.run) / RECOVERY_DAYS) : 100;
  if (!j.issue) return 100;
  return round5(100 - ISSUE_HEALTH[j.issue.tier] * (1 - j.issue.have / j.issue.need));
}

// ---------- setbacks ----------

export const SETBACK_DAYS = 2;

/** A short setback after a slip: the pet is quieter for the slip day and the next, ending with a goal-met day. */
export function setbackState(input: { lastSlip: string | null; lastGoalMet: string | null; today: string; daysSinceSlip: number | null }): { active: boolean } {
  const { lastSlip, lastGoalMet, today, daysSinceSlip } = input;
  if (!lastSlip || daysSinceSlip === null || lastSlip > today) return { active: false };
  if (daysSinceSlip < 0 || daysSinceSlip >= SETBACK_DAYS) return { active: false };
  if (lastGoalMet && lastGoalMet > lastSlip) return { active: false };
  return { active: true };
}

// ---------- the pet's look ----------

/**
 * Visible traits, each 0..1. In recovery, each condition drives its own traits: healed is 1, the one healing next is
 * part way, and later ones are 0 for a rescue (a raised puppy starts at 0.7). After recovery the pet is well, except
 * for the traits an active issue touches, which come back as it clears.
 */
export function petTraits(j: Pick<Journey, "mode" | "phase" | "run" | "issue">, opts: { setback?: boolean } = {}): Record<VisualTrait, number> {
  const base = j.mode === "rescue" ? 0 : 0.7;
  const out = {} as Record<VisualTrait, number>;
  const defs = missionsFor(j.mode);
  for (const trait of VISUAL_TRAITS) {
    if (j.phase !== "recovery") { out[trait] = 1; continue; }
    const idx = defs.map((d, i) => (d.traits.includes(trait) ? i : -1)).filter((i) => i >= 0);
    const part = (i: number) => { const from = i === 0 ? 0 : HEAL_AT[i - 1]; return Math.max(0, Math.min(1, (j.run - from) / (HEAL_AT[i] - from))); };
    const pct = idx.length ? idx.reduce((a, i) => a + part(i), 0) / idx.length : 1;
    out[trait] = base + (1 - base) * pct;
  }
  if (j.issue) {
    const def = ISSUES[j.issue.tier].find((x) => x.id === j.issue!.id);
    for (const trait of def?.traits ?? []) out[trait] = Math.min(out[trait], 0.3 + 0.7 * (j.issue.have / j.issue.need));
  }
  if (opts.setback) { out.energy = Math.max(0, out.energy - 0.2); out.play = Math.max(0, out.play - 0.25); }
  return out;
}
