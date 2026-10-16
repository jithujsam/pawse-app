import type { Scorer, ScoreRequest, ScoreResponse } from "./types";

const STOP = new Set(["with", "have", "from", "that", "this", "your", "years", "year", "must", "able", "work", "good", "will", "should"]);
const NEGATIVE = /\b(no|not|never|don't|dont|nahi|nahin|नहीं)\b/i;

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/**
 * Deterministic keyword-overlap scorer so the whole flow runs without an API key.
 * It is a stand-in for demos and tests, not a real assessment.
 */
export class MockScorer implements Scorer {
  readonly name = "mock";

  async score(req: ScoreRequest): Promise<ScoreResponse> {
    const all = req.answers.map((a) => a.answer).join(" \n ");
    const lower = all.toLowerCase();
    const evidenceFor = (kw: string[]) => {
      const hit = req.answers.find((a) => kw.some((k) => a.answer.toLowerCase().includes(k)));
      return hit ? hit.answer.slice(0, 160) : "";
    };
    const knockouts = req.rubric
      .filter((r) => r.kind === "knockout")
      .map((r) => {
        const kw = keywords(r.text);
        const ev = evidenceFor(kw);
        const met = ev ? (NEGATIVE.test(ev) ? "no" : "yes") : /\b(yes|haan|ha)\b/.test(lower) ? "unclear" : "no";
        return { id: r.id, met: met as "yes" | "no" | "unclear", evidence: ev || "No matching answer found." };
      });
    const nice = req.rubric
      .filter((r) => r.kind === "nice")
      .map((r) => {
        const kw = keywords(r.text);
        const hits = kw.filter((k) => lower.includes(k)).length;
        const rating = kw.length === 0 ? 0 : Math.min(3, Math.round((hits / kw.length) * 3 + (hits > 0 ? 1 : 0)));
        return { id: r.id, rating, evidence: evidenceFor(kw) || "Not mentioned." };
      });
    const failed = knockouts.filter((k) => k.met !== "yes");
    return {
      model: "mock-keyword-v1",
      raw: {
        knockouts,
        nice_to_haves: nice,
        summary: `Answered ${req.answers.length} question(s). ${all.slice(0, 140)}${all.length > 140 ? "…" : ""}`,
        reason: failed.length
          ? `Knockout not clearly met: ${failed.map((f) => req.rubric.find((r) => r.id === f.id)?.text).join("; ")}.`
          : `Meets all must-haves; matched ${nice.filter((n) => n.rating >= 2).length} of ${nice.length} nice-to-haves.`,
      },
    };
  }

  async suggestQuestions(job: { title: string; location: string }) {
    return [
      `How many years of experience do you have as a ${job.title}? Please describe your last role.`,
      `Are you currently based in or willing to relocate to ${job.location}?`,
      `What is your current monthly salary and your expected salary?`,
      `How soon can you join if selected (notice period)?`,
      `Tell us about one achievement in your work that you are proud of.`,
    ];
  }
}
