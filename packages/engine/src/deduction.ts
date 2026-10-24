import {
  BASE_MONTHS, MAX_REPEAT_MULTIPLIER, MAX_SEVERITY, MAX_SLIP_MONTHS, MAX_TRIGGER_BONUS,
  MAX_AI_ADJUST_PCT, MIN_SEVERITY, MIN_SLIP_MONTHS, TRIGGER_BONUS,
} from "./constants";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface SeverityInput {
  /** Spend, count or minutes for this slip. Omit for habits with no amount. */
  amount?: number;
  /** The user's own 30-day median for this habit. Omit if there is no history yet. */
  median?: number;
  classWeight: number;
  /** Number of trigger flags answered yes (late night, stress, alone, extra beyond planned). */
  triggers: number;
}

export function computeSeverity({ amount, median, classWeight, triggers }: SeverityInput): number {
  const ratio = amount !== undefined && median !== undefined && median > 0
    ? clamp(amount / median, 0.5, 2)
    : 1;
  const bonus = Math.min(MAX_TRIGGER_BONUS, Math.max(0, triggers) * TRIGGER_BONUS);
  return clamp(classWeight * ratio + bonus, MIN_SEVERITY, MAX_SEVERITY);
}

/** 1.0, 1.25, 1.5, 1.75, 2.0 (capped) for the nth slip of the day (1-based). */
export function repeatMultiplier(nthSlipToday: number): number {
  return Math.min(MAX_REPEAT_MULTIPLIER, 1 + 0.25 * (Math.max(1, nthSlipToday) - 1));
}

export function baselineMonths(severity: number, nthSlipToday: number): number {
  return BASE_MONTHS * severity * repeatMultiplier(nthSlipToday);
}

/**
 * AI may nudge the baseline by at most +/-30%, and keeps to 0.5 to 12 months per slip. It never pulls a slip
 * past the baseline itself: a baseline above 12 months (heavy repeat slips) can only move down by up to 30%,
 * never be cut to 12 just because the AI answered.
 */
export function applyAiAdjustment(baseline: number, adjustPct: number): number {
  const pct = clamp(adjustPct, -MAX_AI_ADJUST_PCT, MAX_AI_ADJUST_PCT);
  return clamp(baseline * (1 + pct / 100), Math.min(MIN_SLIP_MONTHS, baseline), Math.max(MAX_SLIP_MONTHS, baseline));
}

export function clampSlipMonths(months: number): number {
  return clamp(months, MIN_SLIP_MONTHS, MAX_SLIP_MONTHS);
}
