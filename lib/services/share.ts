import { and, eq } from "drizzle-orm";
import { asSystem } from "../db/tenant";
import { candidates, jobs, organizations, scores } from "../db/schema";

/**
 * Public, no-login view of a job's shortlist for the agency's client.
 * Shows only candidates tagged Shortlist, and never phone numbers.
 */
export async function getSharedShortlist(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return asSystem(async (tx) => {
    const [job] = await tx
      .select({ id: jobs.id, title: jobs.title, location: jobs.location, orgName: organizations.name, status: jobs.status })
      .from(jobs)
      .innerJoin(organizations, eq(organizations.id, jobs.orgId))
      .where(eq(jobs.shareToken, token));
    if (!job || job.status === "closed") return null;
    const rows = await tx
      .select({
        name: candidates.name,
        total: scores.total,
        editedTotal: scores.editedTotal,
        summary: scores.summary,
        reason: scores.reason,
      })
      .from(candidates)
      .leftJoin(scores, eq(scores.candidateId, candidates.id))
      .where(and(eq(candidates.jobId, job.id), eq(candidates.tag, "shortlist")));
    return {
      job,
      candidates: rows
        .map((r) => ({ name: r.name, score: r.editedTotal ?? r.total, summary: r.summary, reason: r.reason }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    };
  });
}
