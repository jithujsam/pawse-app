import { z } from "zod";

export type RubricItem = { id: string; kind: "knockout" | "nice"; text: string; weight: number };
export type QA = { question: string; answer: string };

/** What the model must return. The total is computed in code, never by the model. */
export const ScoreOutputSchema = z.object({
  knockouts: z.array(
    z.object({
      id: z.string(),
      met: z.enum(["yes", "no", "unclear"]),
      evidence: z.string(),
    }),
  ),
  nice_to_haves: z.array(
    z.object({
      id: z.string(),
      rating: z.number().int().min(0).max(3),
      evidence: z.string(),
    }),
  ),
  summary: z.string(),
  reason: z.string(),
});
export type ScoreOutput = z.infer<typeof ScoreOutputSchema>;

export type Breakdown = {
  knockouts: { id: string; text: string; met: "yes" | "no" | "unclear"; evidence: string }[];
  niceToHaves: { id: string; text: string; weight: number; rating: number; evidence: string }[];
};

export type ComputedScore = { total: number; knockoutPassed: boolean; breakdown: Breakdown; summary: string; reason: string };

export class ScoreParseError extends Error {}

/**
 * Validate raw model output against the job's rubric and compute the score.
 * Every rubric item must be answered exactly once; unknown ids are rejected.
 */
export function parseAndComputeScore(raw: unknown, rubric: RubricItem[]): ComputedScore {
  const parsed = ScoreOutputSchema.safeParse(raw);
  if (!parsed.success) throw new ScoreParseError(`Invalid score JSON: ${parsed.error.issues[0]?.message}`);
  const out = parsed.data;

  const knockouts = rubric.filter((r) => r.kind === "knockout");
  const nice = rubric.filter((r) => r.kind === "nice");
  checkCoverage("knockout", knockouts, out.knockouts.map((k) => k.id));
  checkCoverage("nice-to-have", nice, out.nice_to_haves.map((n) => n.id));

  const breakdown: Breakdown = {
    knockouts: knockouts.map((k) => {
      const r = out.knockouts.find((x) => x.id === k.id)!;
      return { id: k.id, text: k.text, met: r.met, evidence: r.evidence.slice(0, 500) };
    }),
    niceToHaves: nice.map((n) => {
      const r = out.nice_to_haves.find((x) => x.id === n.id)!;
      return { id: n.id, text: n.text, weight: n.weight, rating: r.rating, evidence: r.evidence.slice(0, 500) };
    }),
  };
  return {
    ...computeTotals(breakdown),
    breakdown,
    summary: out.summary.slice(0, 1000),
    reason: out.reason.slice(0, 1000),
  };
}

export function computeTotals(b: Breakdown): { total: number; knockoutPassed: boolean } {
  const knockoutPassed = b.knockouts.every((k) => k.met === "yes");
  const weightSum = b.niceToHaves.reduce((s, n) => s + n.weight, 0);
  const total =
    weightSum === 0
      ? knockoutPassed
        ? 100
        : 0
      : Math.round((b.niceToHaves.reduce((s, n) => s + (n.rating / 3) * n.weight, 0) / weightSum) * 100);
  return { total, knockoutPassed };
}

function checkCoverage(label: string, items: RubricItem[], ids: string[]) {
  const expected = new Set(items.map((i) => i.id));
  const got = new Set(ids);
  if (ids.length !== got.size) throw new ScoreParseError(`Duplicate ${label} ids`);
  for (const id of got) if (!expected.has(id)) throw new ScoreParseError(`Unknown ${label} id ${id}`);
  for (const id of expected) if (!got.has(id)) throw new ScoreParseError(`Missing ${label} ${id}`);
}

/** Shortlist order: knockouts passed first, then by (edited) score, then incomplete. */
export function rankKey(c: { status: string; score?: { total: number; editedTotal: number | null; knockoutPassed: boolean } | null }) {
  if (!c.score) return c.status === "completed" ? 1 : 0;
  const total = c.score.editedTotal ?? c.score.total;
  return (c.score.knockoutPassed ? 1000 : 500) + total;
}
