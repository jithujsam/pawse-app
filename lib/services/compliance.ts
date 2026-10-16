import { and, eq, isNull, lt } from "drizzle-orm";
import { asSystem, withOrg } from "../db/tenant";
import type { Tx } from "../db/client";
import { answers, candidates, conversations, deletionRequests, jobs, messages, scores } from "../db/schema";
import { encrypt } from "../crypto";
import { audit } from "../domain/audit";
import { NotFound } from "./jobs";

/**
 * Remove a candidate's personal data but keep the row skeleton so counts,
 * costs and the audit trail stay intact. Irreversible.
 */
export async function purgeCandidate(tx: Tx, orgId: string, candidateId: string) {
  await tx
    .update(candidates)
    .set({ name: "Deleted candidate", phoneEnc: encrypt(""), phoneHash: `deleted:${candidateId}`, status: "deleted", tag: null })
    .where(and(eq(candidates.id, candidateId), eq(candidates.orgId, orgId)));
  const [conv] = await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.candidateId, candidateId));
  if (conv) {
    await tx.update(messages).set({ body: null, transcript: null }).where(eq(messages.conversationId, conv.id));
    await tx.update(answers).set({ text: "[deleted]" }).where(eq(answers.conversationId, conv.id));
  }
  await tx
    .update(scores)
    .set({ summary: "[deleted]", reason: "[deleted]", breakdown: { knockouts: [], niceToHaves: [] }, editNote: null })
    .where(eq(scores.candidateId, candidateId));
}

/** Job handler: complete a deletion request (from WhatsApp DELETE). */
export async function deleteCandidateJob(payload: { orgId: string; candidateId: string; requestId: string }) {
  await withOrg(payload.orgId, async (tx) => {
    await purgeCandidate(tx, payload.orgId, payload.candidateId);
    await tx
      .update(deletionRequests)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(deletionRequests.id, payload.requestId));
    await audit(tx, payload.orgId, "deletion.completed", "candidate", payload.candidateId, { kind: "system" });
  });
}

/** Recruiter deletes a candidate's data from the transcript screen. */
export async function deleteCandidateByRecruiter(orgId: string, userId: string, candidateId: string) {
  await withOrg(orgId, async (tx) => {
    const [c] = await tx.select({ id: candidates.id }).from(candidates).where(and(eq(candidates.id, candidateId), eq(candidates.orgId, orgId)));
    if (!c) throw new NotFound();
    await tx.insert(deletionRequests).values({ orgId, candidateId, requestedVia: "recruiter", status: "completed", completedAt: new Date() });
    await purgeCandidate(tx, orgId, candidateId);
    await audit(tx, orgId, "deletion.completed", "candidate", candidateId, { userId });
  });
}

/** Sweep step: purge every candidate of jobs whose retention period has ended. */
export async function purgeExpiredJobs(now = new Date()) {
  const due = await asSystem((tx) =>
    tx
      .select({ id: jobs.id, orgId: jobs.orgId })
      .from(jobs)
      .where(and(eq(jobs.status, "closed"), lt(jobs.retentionUntil, now), isNull(jobs.purgedAt))),
  );
  for (const job of due) {
    await withOrg(job.orgId, async (tx) => {
      const cs = await tx.select({ id: candidates.id }).from(candidates).where(eq(candidates.jobId, job.id));
      for (const c of cs) await purgeCandidate(tx, job.orgId, c.id);
      await tx.update(jobs).set({ purgedAt: now }).where(eq(jobs.id, job.id));
      await tx.insert(deletionRequests).values({ orgId: job.orgId, requestedVia: "retention", status: "completed", completedAt: now });
      await audit(tx, job.orgId, "retention.purged", "job", job.id, { kind: "system" }, { candidates: cs.length });
    });
  }
  return due.length;
}
