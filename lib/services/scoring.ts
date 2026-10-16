import { and, asc, eq } from "drizzle-orm";
import { withOrg } from "../db/tenant";
import { answers, candidates, conversations, costEvents, jobs, questions, rubricItems, scores } from "../db/schema";
import { providers } from "../adapters";
import { parseAndComputeScore } from "../domain/scoring";
import { audit } from "../domain/audit";

/** Job handler: score a candidate who has answered every question. */
export async function scoreCandidate(payload: { orgId: string; candidateId: string }) {
  const { orgId, candidateId } = payload;
  const input = await withOrg(orgId, async (tx) => {
    const [row] = await tx
      .select({ c: candidates, job: jobs, conv: conversations })
      .from(candidates)
      .innerJoin(jobs, eq(jobs.id, candidates.jobId))
      .innerJoin(conversations, eq(conversations.candidateId, candidates.id))
      .where(and(eq(candidates.id, candidateId), eq(candidates.orgId, orgId)));
    if (!row || row.c.status !== "completed") return null;
    const rubric = await tx.select().from(rubricItems).where(eq(rubricItems.jobId, row.job.id));
    const qa = await tx
      .select({ question: questions.text, answer: answers.text })
      .from(answers)
      .innerJoin(questions, eq(questions.id, answers.questionId))
      .where(eq(answers.conversationId, row.conv.id))
      .orderBy(asc(questions.position));
    return { row, rubric, qa };
  });
  if (!input) return;

  const rubric = input.rubric.map((r) => ({ id: r.id, kind: r.kind, text: r.text, weight: r.weight }));
  // The model call happens outside any transaction.
  const res = await providers().scorer.score({
    jobTitle: input.row.job.title,
    jobDescription: input.row.job.description,
    rubric,
    answers: input.qa,
  });
  if (res.refused) throw new Error("Scoring declined by the model; needs manual review");
  const computed = parseAndComputeScore(res.raw, rubric); // throws -> job retries, then fails visibly

  await withOrg(orgId, async (tx) => {
    const values = {
      orgId,
      jobId: input.row.job.id,
      candidateId,
      total: computed.total,
      knockoutPassed: computed.knockoutPassed,
      breakdown: computed.breakdown,
      summary: computed.summary,
      reason: computed.reason,
      model: res.model,
      updatedAt: new Date(),
    };
    // Re-scoring keeps any recruiter override.
    await tx.insert(scores).values(values).onConflictDoUpdate({ target: scores.candidateId, set: values });
    if (res.usage) {
      await tx.insert(costEvents).values([
        { orgId, jobId: input.row.job.id, kind: "llm_input_tokens", quantity: res.usage.inputTokens },
        { orgId, jobId: input.row.job.id, kind: "llm_output_tokens", quantity: res.usage.outputTokens },
      ]);
    }
    await audit(tx, orgId, "score.created", "candidate", candidateId, { kind: "system" }, { model: res.model, total: computed.total });
  });
}
