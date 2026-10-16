import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { asSystem, withOrg } from "../db/tenant";
import { candidates, conversations, jobs, memberships, queue, users } from "../db/schema";
import { mailer } from "../adapters/mailer";
import { config } from "../config";
import { BRAND } from "../brand";
import { purgeExpiredJobs } from "./compliance";
import { sendReminder } from "./outreach";

const HOUR = 3600_000;
export const REMIND_AFTER_H = 24;
export const GIVE_UP_AFTER_H = 72;

/**
 * Periodic housekeeping, run from the cron route:
 * reminders, no-response timeouts, retention purge and queue cleanup.
 */
export async function sweep(now = new Date()) {
  const remindBefore = new Date(now.getTime() - REMIND_AFTER_H * HOUR);
  const giveUpBefore = new Date(now.getTime() - GIVE_UP_AFTER_H * HOUR);

  const quiet = await asSystem((tx) =>
    tx
      .select({ id: conversations.id, orgId: conversations.orgId })
      .from(conversations)
      .innerJoin(jobs, eq(jobs.id, conversations.jobId))
      .where(
        and(
          eq(jobs.status, "active"),
          inArray(conversations.state, ["awaiting_optin", "asking"]),
          isNull(conversations.reminderSentAt),
          lt(conversations.lastOutboundAt, remindBefore),
          or(isNull(conversations.lastInboundAt), lt(conversations.lastInboundAt, remindBefore)),
        ),
      )
      .limit(200),
  );
  for (const c of quiet) await sendReminder(c.orgId, c.id);

  const gone = await asSystem((tx) =>
    tx
      .select({ id: conversations.id, orgId: conversations.orgId, candidateId: conversations.candidateId })
      .from(conversations)
      .where(
        and(
          inArray(conversations.state, ["awaiting_optin", "asking"]),
          isNotNull(conversations.reminderSentAt),
          lt(conversations.reminderSentAt, new Date(now.getTime() - (GIVE_UP_AFTER_H - REMIND_AFTER_H) * HOUR)),
          lt(conversations.lastOutboundAt, giveUpBefore),
          or(isNull(conversations.lastInboundAt), lt(conversations.lastInboundAt, giveUpBefore)),
        ),
      )
      .limit(500),
  );
  for (const c of gone) {
    await withOrg(c.orgId, async (tx) => {
      await tx.update(conversations).set({ state: "no_response" }).where(eq(conversations.id, c.id));
      await tx
        .update(candidates)
        .set({ status: "no_response" })
        .where(and(eq(candidates.id, c.candidateId), inArray(candidates.status, ["invited", "in_progress"])));
    });
  }

  const purged = await purgeExpiredJobs(now);
  // Queue payloads can contain message text: don't keep finished jobs around.
  await asSystem((tx) =>
    tx.delete(queue).where(and(eq(queue.status, "done"), lt(queue.createdAt, sql`now() - interval '7 days'`))),
  );
  return { reminded: quiet.length, timedOut: gone.length, purged };
}

/** Job handler: email the recruiter a summary when a job closes. */
export async function closeSummary(payload: { orgId: string; jobId: string; userId: string }) {
  const data = await withOrg(payload.orgId, async (tx) => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, payload.jobId));
    const counts = await tx
      .select({ status: candidates.status, tag: candidates.tag, n: sql<number>`count(*)::int` })
      .from(candidates)
      .where(eq(candidates.jobId, payload.jobId))
      .groupBy(candidates.status, candidates.tag);
    const [m] = await tx.select().from(memberships).where(eq(memberships.userId, payload.userId));
    return { job, counts, isMember: Boolean(m) };
  });
  if (!data.job || !data.isMember) return;
  const [user] = await asSystem((tx) => tx.select({ email: users.email }).from(users).where(eq(users.id, payload.userId)));
  const sum = (f: (c: (typeof data.counts)[number]) => boolean) => data.counts.filter(f).reduce((s, c) => s + c.n, 0);
  const text = [
    `"${data.job.title}" is closed.`,
    ``,
    `Candidates: ${sum(() => true)}`,
    `Completed screening: ${sum((c) => c.status === "completed")}`,
    `Shortlisted: ${sum((c) => c.tag === "shortlist")}`,
    `Opted out: ${sum((c) => c.status === "opted_out")}`,
    `No response: ${sum((c) => c.status === "no_response")}`,
    ``,
    `Candidate data for this job will be deleted on ${data.job.retentionUntil?.toDateString()}. Export anything you need before then.`,
    `${config().APP_URL}/app/jobs/${data.job.id}`,
  ].join("\n");
  await mailer().send({ to: user.email, subject: `${BRAND.name}: summary for ${data.job.title}`, text });
}
