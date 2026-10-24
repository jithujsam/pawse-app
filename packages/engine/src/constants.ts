export const LIFE_BUDGET_MONTHS = 1200;
/** When pets can't pass away, net damage stops here: visible age 99, the frail stage, never death. */
export const NO_DEATH_CEILING_MONTHS = 1188;
export const BASE_MONTHS = 4;
export const CLEAN_DAY_HEAL_MONTHS = 1.5;
export const SCAR_FLOOR_RATIO = 0.2;
/** Hidden reserve: a long-healthy companion shrugs off a one-off slip. Built only once healing has nothing left to heal. */
export const RESERVE_GAIN_MONTHS = 0.2;
export const RESERVE_MAX_MONTHS = 12;
/** The most the reserve can soak up in one day, so a binge still lands. */
export const RESERVE_MAX_ABSORB_PER_DAY = 6;
/** A day with this many slips is a binge: part of its damage becomes a permanent scar (lower life expectancy). */
export const BINGE_SLIPS = 3;
export const BINGE_SCAR_RATIO = 0.25;
/** Missed check-ins: after a grace of 2 silent days, each further silent day costs this much (loneliness). */
export const NEGLECT_GRACE_DAYS = 2;
export const NEGLECT_MONTHS = 1.5;
export const MIN_SEVERITY = 0.5;
export const MAX_SEVERITY = 3.0;
export const MAX_REPEAT_MULTIPLIER = 2.0;
export const MIN_SLIP_MONTHS = 0.5;
export const MAX_SLIP_MONTHS = 12;
export const MAX_AI_ADJUST_PCT = 30;
export const TRIGGER_BONUS = 0.25;
export const MAX_TRIGGER_BONUS = 0.5;

export type HabitClass =
  | "food_spending"
  | "impulse_buying"
  | "doomscrolling"
  | "smoking"
  | "alcohol"
  | "custom";

/** Product choices, not medical claims. Editable per habit. */
export const DEFAULT_CLASS_WEIGHTS: Record<HabitClass, number> = {
  smoking: 1.4,
  alcohol: 1.3,
  impulse_buying: 0.9,
  doomscrolling: 0.8,
  food_spending: 0.7,
  custom: 1.0,
};
