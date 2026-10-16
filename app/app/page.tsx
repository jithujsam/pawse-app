import Link from "next/link";
import { requireOrg } from "@/lib/auth/session";
import { listJobs } from "@/lib/services/jobs";
import { PageHeader } from "@/components/app/Shell";
import { JobStatus } from "@/components/app/StatusBadge";

export default async function JobsPage() {
  const user = await requireOrg();
  const jobs = await listJobs(user.orgId);
  return (
    <>
      <PageHeader
        eyebrow={user.orgName}
        title="Jobs"
        actions={
          <Link href="/app/jobs/new" className="btn-base btn-primary">
            New job
          </Link>
        }
      />
      {jobs.length === 0 ? (
        <div className="card text-center py-12">
          <h2 className="text-2xl mb-2">Run your first role</h2>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--color-on-surface-variant)" }}>
            Describe the job, add 5 questions, upload a CSV of candidates and try it free with up to 5 people. It takes about 10 minutes.
          </p>
          <Link href="/app/jobs/new?first=1" className="btn-base btn-primary">
            Create a job
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((j) => (
            <Link key={j.id} href={`/app/jobs/${j.id}`} className="card card-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{j.title}</div>
                <div className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                  {j.location} · created {j.createdAt.toLocaleDateString("en-IN")}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <span style={{ color: "var(--color-on-surface-variant)" }}>
                  {j.counts.completed}/{j.counts.total} screened
                </span>
                <JobStatus status={j.status} testMode={j.testMode} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
