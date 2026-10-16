export type GateInput = {
  testMode: boolean;
  candidateCount: number;
  hasPaidPayment: boolean;
  maxCandidates: number;
  testModeMax: number;
  questionCount: number;
  jobStatus: "draft" | "active" | "closed";
};

export type GateResult = { ok: true } | { ok: false; reason: string; needsPayment?: boolean };

export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;

/**
 * May outreach start for this job? Messages go out only when this returns ok,
 * and only from the payment webhook or the free test-mode launch.
 */
export function outreachGate(g: GateInput): GateResult {
  if (g.jobStatus === "closed") return { ok: false, reason: "This job is closed." };
  if (g.questionCount < MIN_QUESTIONS || g.questionCount > MAX_QUESTIONS)
    return { ok: false, reason: `Add ${MIN_QUESTIONS} to ${MAX_QUESTIONS} screening questions first.` };
  if (g.candidateCount === 0) return { ok: false, reason: "Upload at least one candidate first." };
  if (g.testMode) {
    if (g.candidateCount > g.testModeMax)
      return { ok: false, reason: `Free test mode allows up to ${g.testModeMax} candidates.` };
    return { ok: true };
  }
  if (g.candidateCount > g.maxCandidates)
    return { ok: false, reason: `A job can screen up to ${g.maxCandidates} candidates.` };
  if (!g.hasPaidPayment) return { ok: false, reason: "Payment is required before messages are sent.", needsPayment: true };
  return { ok: true };
}

/** How many more candidates this job can take. */
export function remainingCapacity(testMode: boolean, current: number, maxCandidates: number, testModeMax: number) {
  return Math.max(0, (testMode ? testModeMax : maxCandidates) - current);
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
