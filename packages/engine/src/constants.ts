export const LIFE_BUDGET_MONTHS = 1200;
export const BASE_MONTHS = 4;
export const CLEAN_DAY_HEAL_MONTHS = 1.5;
export const SCAR_FLOOR_RATIO = 0.2;
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
