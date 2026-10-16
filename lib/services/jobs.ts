import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "../db/tenant";
import type { Tx } from "../db/client";
import { candidates, jobs, payments, questions, rubricItems } from "../db/schema";
import { audit, track } from "../domain/audit";
import { MAX_QUESTIONS, MIN_QUESTIONS, outreachGate } from "../domain/billing";
import { config } from "../config";
import { enqueue } from "../jobs/queue";
import { randomToken } from "../crypto";

const line = (max: number) => z.string().trim().min(1).max(max);

export const jobInput = z.object({
  title: z.string().trim().min(2, "Title is too short").max(120),
  description: z.string().trim().min(10, "Add a short description").max(5000),
  location: z.string().trim().min(2, "Add a location").max(120),
  testMode: z.boolean().default(false),
  questions: z
    .array(line(500))
    .min(MIN_QUESTIONS, `Add at least ${MIN_QUESTIONS} questions`)
    .max(MAX_QUESTIONS, `At most ${MAX_QUESTIONS} questions`),
  knockouts: z.array(line(300)).max(5, "At most 5 must-haves"),
  niceToHaves: z.array(z.object({ text: line(300), weight: z.number().int().min(1).max(5) })).max(8, "At most 8 nice-to-haves"),
});
export type JobInput = z.infer<typeof jobInput>;

export class NotFound extends Error {}
export class Forbidden extends Error {}

export async function createJob(orgId: string, userId: string, input: JobInput) {
  return withOrg(orgId, async (tx) => {
    const [job] = await tx
      .insert(jobs)
      .values({
        orgId,
        title: input.title,
        description: input.description,
        location: input.location,
        testMode: input.testMode,
        priceInr: config().PRICE_PER_JOB_INR,
        createdBy: userId,
      })
      .returning();
    await writeQuestionsAndRubric(tx, orgId, job.id, input);
    await audit(tx, orgId, "job.created", "job", job.id, { userId });
    await track(tx, "job_created", { orgId, userId }, { testMode: input.testMode });
    return job;
  });
}

export async function updateJob(orgId: string, userId: string, jobId: string, input: JobInput) {
  return withOrg(orgId, async (tx) => {
    const job = await loadJob(tx, orgId, jobId);
    if (job.status !== "draft") throw new Forbidden("Questions and rubric are locked once screening starts.");
    await tx
      .update(jobs)
      .set({ title: input.title, description: input.description, location: input.location, testMode: input.testMode })
      .where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));
    await tx.delete(questions).where(and(eq(questions.jobId, jobId), eq(questions.orgId, orgId)));
    await tx.delete(rubricItems).where(and(eq(rubricItems.jobId, jobId), eq(rubricItems.orgId, orgId)));
    await writeQuestionsAndRubric(tx, orgId, jobId, input);
    await audit(tx, orgId, "job.updated", "job", jobId, { userId });
  });
}

async function writeQuestionsAndRubric(tx: Tx, orgId: string, jobId: string, input: JobInput) {
  await tx.insert(questions).values(input.questions.map((text, position) => ({ orgId, jobId, position, text })));
  const rubric = [
    ...input.knockouts.map((text) => ({ orgId, jobId, kind: "knockout" as const, text, weight: 1 })),
    ...input.niceToHaves.map((n) => ({ orgId, jobId, kind: "nice" as const, text: n.text, weight: n.weight })),
  ];
  if (rubric.length) await tx.insert(rubricItems).values(rubric);
}

export async function loadJob(tx: Tx, orgId: string, jobId: string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new NotFound();
  const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));
  if (!job) throw new NotFound();
  return job;
}

export async function listJobs(orgId: string) {
  return withOrg(orgId, async (tx) => {
    const rows = await tx.select().from(jobs).where(eq(jobs.orgId, orgId)).orderBy(desc(jobs.createdAt));
    const counts = await tx
      .select({
        jobId: candidates.jobId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${candidates.status} = 'completed')::int`,
      })
      .from(candidates)
      .where(eq(candidates.orgId, orgId))
      .groupBy(candidates.jobId);
    return rows.map((j) => ({ ...j, counts: counts.find((c) => c.jobId === j.id) ?? { total: 0, completed: 0 } }));
  });
}

export async function getJobDetail(orgId: string, jobId: string) {
  return withOrg(orgId, async (tx) => {
    const job = await loadJob(tx, orgId, jobId);
    const qs = await tx.select().from(questions).where(eq(questions.jobId, jobId)).orderBy(asc(questions.position));
    const rubric = await tx.select().from(rubricItems).where(eq(rubricItems.jobId, jobId)).orderBy(asc(rubricItems.createdAt));
    const statusCounts = await tx
      .select({ status: candidates.status, n: sql<number>`count(*)::int` })
      .from(candidates)
      .where(eq(candidates.jobId, jobId))
      .groupBy(candidates.status);
    const pays = await tx.select().from(payments).where(eq(payments.jobId, jobId)).orderBy(desc(payments.createdAt));
    const candidateCount = statusCounts.reduce((s, c) => s + c.n, 0);
    const gate = outreachGate({
      testMode: job.testMode,
      candidateCount,
      hasPaidPayment: pays.some((p) => p.status === "paid"),
      maxCandidates: config().MAX_CANDIDATES_PER_JOB,
      testModeMax: config().TEST_MODE_MAX_CANDIDATES,
      questionCount: qs.length,
      jobStatus: job.status,
    });
    return { job, questions: qs, rubric, statusCounts, candidateCount, payments: pays, gate };
  });
}

/**
 * Move a job to active and queue invites for every pending candidate.
 * Called by the payment webhook (paid jobs) or the free test-mode launch.
 * Idempotent: invites are deduped per candidate.
 */
export async function activateJob(tx: Tx, orgId: string, jobId: string, actor: { userId?: string | null }) {
  const job = await loadJob(tx, orgId, jobId);
  if (job.status === "closed") return;
  if (job.status === "draft") {
    await tx.update(jobs).set({ status: "active", launchedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));
    await audit(tx, orgId, "job.launched", "job", jobId, actor, { testMode: job.testMode });
  }
  await queueInvites(tx, orgId, jobId);
}

export async function queueInvites(tx: Tx, orgId: string, jobId: string) {
  const pending = await tx
    .select({ id: candidates.id })
    .from(candidates)
    .where(and(eq(candidates.jobId, jobId), eq(candidates.orgId, orgId), eq(candidates.status, "pending")));
  for (const c of pending) {
    await enqueue(tx, "send_invite", { orgId, candidateId: c.id }, { dedupeKey: `invite:${c.id}` });
  }
  return pending.length;
}

/** Free launch for test-mode jobs (no payment, max 5 candidates). */
export async function launchTestJob(orgId: string, userId: string, jobId: string) {
  const detail = await getJobDetail(orgId, jobId);
  if (!detail.job.testMode) throw new Forbidden("This job needs payment before launch.");
  if (!detail.gate.ok) throw new Forbidden(detail.gate.reason);
  await withOrg(orgId, (tx) => activateJob(tx, orgId, jobId, { userId }));
}

export async function markReviewed(orgId: string, userId: string, jobId: string) {
  await withOrg(orgId, async (tx) => {
    await loadJob(tx, orgId, jobId);
    await tx.update(jobs).set({ reviewedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));
    await audit(tx, orgId, "job.reviewed", "job", jobId, { userId });
  });
}

export async function setShareLink(orgId: string, userId: string, jobId: string, enabled: boolean) {
  return withOrg(orgId, async (tx) => {
    const job = await loadJob(tx, orgId, jobId);
    if (enabled && !job.reviewedAt) throw new Forbidden("Mark the shortlist as reviewed before sharing it.");
    const token = enabled ? randomToken(24) : null;
    await tx.update(jobs).set({ shareToken: token }).where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));
    await audit(tx, orgId, enabled ? "share.enabled" : "share.disabled", "job", jobId, { userId });
    return token;
  });
}

export async function closeJob(orgId: string, userId: string, jobId: string) {
  await withOrg(orgId, async (tx) => {
    const job = await loadJob(tx, orgId, jobId);
    if (job.status === "closed") return;
    const now = new Date();
    const retentionUntil = new Date(now.getTime() + config().RETENTION_DAYS * 86_400_000);
    await tx
      .update(jobs)
      .set({ status: "closed", closedAt: now, retentionUntil, shareToken: null })
      .where(and(eq(jobs.id, jobId), eq(jobs.orgId, orgId)));
    await audit(tx, orgId, "job.closed", "job", jobId, { userId }, { retentionUntil: retentionUntil.toISOString() });
    await track(tx, "job_closed", { orgId, userId });
    await enqueue(tx, "close_summary", { orgId, jobId, userId }, { dedupeKey: `close:${jobId}` });
  });
}
