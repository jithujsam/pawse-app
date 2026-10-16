import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { asSystem, withOrg } from "../db/tenant";
import { candidates, conversations, jobs, queue } from "../db/schema";

const STUCK_AFTER_H = 24;

/** Conversations a recruiter should look at, and background work that failed. Org-scoped. */
export async function needsAttention(orgId: string) {
  const stuckBefore = new Date(Date.now() - STUCK_AFTER_H * 3600_000);
  const convs = await withOrg(orgId, (tx) =>
    tx
      .select({
        candidateId: candidates.id,
        name: candidates.name,
        status: candidates.status,
        jobId: jobs.id,
        jobTitle: jobs.title,
        state: conversations.state,
        lastInboundAt: conversations.lastInboundAt,
        lastOutboundAt: conversations.lastOutboundAt,
      })
      .from(conversations)
      .innerJoin(candidates, eq(candidates.id, conversations.candidateId))
      .innerJoin(jobs, eq(jobs.id, conversations.jobId))
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(jobs.status, "active"),
          or(
            eq(conversations.state, "needs_human"),
            and(eq(conversations.state, "asking"), lt(conversations.lastOutboundAt, stuckBefore)),
          ),
        ),
      )
      .orderBy(desc(conversations.lastOutboundAt))
      .limit(200),
  );
  // The queue is a system table, so filter by this org's id inside the payload.
  const failed = await asSystem((tx) =>
    tx
      .select({ id: queue.id, kind: queue.kind, lastError: queue.lastError, attempts: queue.attempts, createdAt: queue.createdAt, payload: queue.payload })
      .from(queue)
      .where(and(eq(queue.status, "failed"), sql`${queue.payload}->>'orgId' = ${orgId}`, inArray(queue.kind, ["send_invite", "send_message", "score_candidate"])))
      .orderBy(desc(queue.createdAt))
      .limit(50),
  );
  return {
    conversations: convs,
    failed: failed.map((f) => ({ ...f, candidateId: (f.payload as { candidateId?: string }).candidateId ?? null, payload: undefined })),
  };
}
