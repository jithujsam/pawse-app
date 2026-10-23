import { CLEAN_DAY_HEAL_MONTHS, LIFE_BUDGET_MONTHS, SCAR_FLOOR_RATIO } from "./constants";
import { stageForAge, type Stage } from "./stage";

/** One calendar day for one companion. Days with no slips and clean=true heal. */
export interface DayInput {
  /** ISO date, YYYY-MM-DD. Days must be passed in ascending order. */
  day: string;
  /** months_lost for each slip logged that day. */
  damage: number[];
  clean: boolean;
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
}

export function ageFromMonths(netMonths: number): number {
  return Math.min(100, Math.max(0, (netMonths / LIFE_BUDGET_MONTHS) * 100));
}

/**
 * Pure fold over the history. Visible age is always recomputable from the entries,
 * clean days and deductions, so any cache is disposable.
 */
export function simulate(days: DayInput[]): DayState[] {
  let net = 0;
  let lifetime = 0;
  const out: DayState[] = [];
  for (const d of days) {
    const damage = d.damage.reduce((a, b) => a + b, 0);
    lifetime += damage;
    net += damage;
    let healed = 0;
    if (d.damage.length === 0 && d.clean) {
      const floor = lifetime * SCAR_FLOOR_RATIO;
      healed = Math.max(0, Math.min(CLEAN_DAY_HEAL_MONTHS, net - floor));
      net -= healed;
    }
    const visibleAge = ageFromMonths(net);
    out.push({
      day: d.day, damageMonths: damage, healedMonths: healed, netMonths: net,
      lifetimeDamage: lifetime, visibleAge, stage: stageForAge(visibleAge),
    });
  }
  return out;
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
