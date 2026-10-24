import {
  BINGE_SCAR_RATIO, BINGE_SLIPS, CLEAN_DAY_HEAL_MONTHS, LIFE_BUDGET_MONTHS, NEGLECT_GRACE_DAYS, NEGLECT_MONTHS, RESERVE_GAIN_MONTHS,
  NO_DEATH_CEILING_MONTHS, RESERVE_MAX_ABSORB_PER_DAY, RESERVE_MAX_MONTHS, SCAR_FLOOR_RATIO,
} from "./constants";
import { stageForAge, type Stage } from "./stage";

/** One calendar day for one companion. Days with no slips and clean=true heal. */
export interface DayInput {
  /** ISO date, YYYY-MM-DD. Days must be passed in ascending order. */
  day: string;
  /** months_lost for each slip logged that day. */
  damage: number[];
  clean: boolean;
  /** Nothing was logged this day (no slip, no clean day). After a short grace, silence costs a little. */
  missed?: boolean;
}

export interface DayState {
  day: string;
  damageMonths: number;
  healedMonths: number;
  /** Months lost, net of healing. */
  netMonths: number;
  lifetimeDamage: number;
  visibleAge: number;
  stage: Stage;
  /** Hidden reserve left at the end of the day. Never shown as a number. */
  reserveMonths: number;
  /** Damage the reserve soaked up today (did not age the companion). */
  absorbedMonths: number;
  /** Permanent damage healing can never remove: the scar floor plus binge scars. */
  floorMonths: number;
  /** True on a day with BINGE_SLIPS or more slips. */
  binge: boolean;
  /** Damage from going silent (missed check-ins past the grace days). Included in damageMonths. */
  neglectMonths: number;
}

/**
 * Optional rules for one companion's fold. With neither set, the fold is exactly the PRD 5.3 engine.
 * - ceilingMonths: net damage never goes above this, so visible age stops short of 100 (no death). Damage past
 *   the ceiling isn't counted at all (not toward lifetime damage, the scar floor or binge scars), so good days
 *   always bring the companion back.
 * - scars: false turns off the permanent scar floor and binge scars, so full recovery is always possible.
 */
export interface SimOptions { ceilingMonths?: number; scars?: boolean }
/** Kept for callers written against the name used in the release-readiness work. */
export type SimulateOptions = SimOptions;

/** The continuity rules: the companion can get very frail but never dies, and every month can heal back. */
export const CONTINUITY: SimOptions = { ceilingMonths: NO_DEATH_CEILING_MONTHS, scars: false };

export function ageFromMonths(netMonths: number): number {
  return Math.min(100, Math.max(0, (netMonths / LIFE_BUDGET_MONTHS) * 100));
}


/**
 * Pure fold over the history. Visible age is always recomputable from the entries,
 * clean days and deductions, so any cache is disposable.
 */
export function simulate(days: DayInput[], opts: SimOptions = {}): DayState[] {
  const ceiling = opts.ceilingMonths ?? Infinity;
  const scars = opts.scars ?? true;
  let net = 0;
  let lifetime = 0;
  let reserve = 0;
  let bingeScar = 0;
  let silent = 0;
  const out: DayState[] = [];
  for (const d of days) {
    silent = d.missed && d.damage.length === 0 && !d.clean ? silent + 1 : 0;
    const neglect = silent > NEGLECT_GRACE_DAYS ? NEGLECT_MONTHS : 0;
    const raw = d.damage.reduce((a, b) => a + b, 0) + neglect;
    // A healthy companion's reserve takes the first hit, up to a daily cap.
    const absorbed = Math.min(reserve, raw, RESERVE_MAX_ABSORB_PER_DAY);
    reserve -= absorbed;
    // With a ceiling, damage past it never ages the companion, so it doesn't count toward scars either.
    // Without one (the standard rules) this is all of it.
    const damage = Math.min(raw - absorbed, Math.max(0, ceiling - net));
    const binge = d.damage.length >= BINGE_SLIPS;
    lifetime += damage;
    net = Math.min(ceiling, net + damage);
    if (binge && scars) bingeScar += damage * BINGE_SCAR_RATIO;
    const scarMonths = scars ? lifetime * SCAR_FLOOR_RATIO + bingeScar : 0;
    const floor = Math.min(net, scarMonths);
    let healed = 0;
    if (d.damage.length === 0 && d.clean) {
      healed = Math.max(0, Math.min(CLEAN_DAY_HEAL_MONTHS, net - floor));
      net -= healed;
      // Healing with nothing left to heal slowly builds the hidden reserve.
      if (healed < CLEAN_DAY_HEAL_MONTHS) reserve = Math.min(RESERVE_MAX_MONTHS, reserve + RESERVE_GAIN_MONTHS);
    }
    const visibleAge = ageFromMonths(net);
    out.push({
      day: d.day, damageMonths: damage, healedMonths: healed, netMonths: net,
      lifetimeDamage: lifetime, visibleAge, stage: stageForAge(visibleAge),
      reserveMonths: reserve, absorbedMonths: absorbed, floorMonths: scarMonths, binge, neglectMonths: neglect,
    });
  }
  return out;
}

/** The best visible age healing can ever bring back: 100 minus this is the companion's life expectancy. */
export const floorAge = (s: DayState): number => ageFromMonths(s.floorMonths);

/**
 * Clean days in a row needed to bring visible age down to `targetAge`.
 * Null when the scar floor sits above the target (that much can't come back).
 */
export function cleanDaysToAge(s: DayState, targetAge: number): number | null {
  const targetMonths = (Math.max(0, targetAge) / 100) * LIFE_BUDGET_MONTHS;
  if (s.floorMonths > targetMonths + 1e-9) return null;
  const toHeal = s.netMonths - targetMonths;
  return toHeal <= 0 ? 0 : Math.ceil(toHeal / CLEAN_DAY_HEAL_MONTHS - 1e-9);
}

/** Clean days needed to undo what a single day's damage did (bounded by the floor). */
export function cleanDaysToUndo(months: number): number {
  return months <= 0 ? 0 : Math.ceil(months / CLEAN_DAY_HEAL_MONTHS - 1e-9);
}

/** Days until a target age at the recent pace; null if the pace is flat or improving. */
export function projectDaysToAge(states: DayState[], targetAge: number, window = 14): number | null {
  if (states.length < 2) return null;
  const recent = states.slice(-window);
  const first = recent[0], last = recent[recent.length - 1];
  const perDay = (last.visibleAge - first.visibleAge) / Math.max(1, recent.length - 1);
  if (perDay <= 0) return null;
  if (last.visibleAge >= targetAge) return 0;
  return Math.ceil((targetAge - last.visibleAge) / perDay);
}
