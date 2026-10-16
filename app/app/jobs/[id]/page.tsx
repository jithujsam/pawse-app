import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { providers } from "@/lib/adapters";
import { formatInr } from "@/lib/domain/billing";
import { config } from "@/lib/config";
import { Notice, PageHeader } from "@/components/app/Shell";
import { JobStatus, candidateStatusLabel } from "@/components/app/StatusBadge";
import { checkoutAction, closeJobAction, launchTestAction } from "../../actions";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string; launched?: string; closed?: string }>;
}) {
  const user = await requireOrg();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getJobDetail(user.orgId, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const { job, gate } = d;
  const paid = d.payments.find((p) => p.status === "paid");
  const simulator = user.isDemo || providers().whatsapp.name === "mock";
  const count = (s: string) => d.statusCounts.find((c) => c.status === s)?.n ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={<JobStatus status={job.status} testMode={job.testMode} />}
        title={job.title}
        actions={
          <>
            {simulator && job.status === "active" && (
              <Link href={`/app/jobs/${id}/simulator`} className="btn-base btn-ghost">
                Phone simulator
              </Link>
            )}
            <Link href={`/app/jobs/${id}/shortlist`} className="btn-base btn-primary">
              Shortlist
            </Link>
          </>
        }
      >
        {job.location}
      </PageHeader>

      <div className="space-y-3 mb-6">
        {sp.error && <Notice tone="warning">{sp.error}</Notice>}
        {sp.uploaded && <Notice tone="success">Candidates uploaded.{job.status === "active" ? " Invites are going out now." : ""}</Notice>}
        {sp.launched && <Notice tone="success">Screening started. Invites are going out now.</Notice>}
        {sp.closed && <Notice>Job closed. We&apos;ve emailed you a summary. Candidate data will be deleted on {job.retentionUntil?.toLocaleDateString("en-IN")}.</Notice>}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Step n={1} title="Role, questions and rubric" done>
            <ol className="list-decimal pl-5 text-sm space-y-1">
              {d.questions.map((q) => (
                <li key={q.id}>{q.text}</li>
              ))}
            </ol>
            <div className="text-sm mt-3 space-y-1" style={{ color: "var(--color-on-surface-variant)" }}>
              {d.rubric.filter((r) => r.kind === "knockout").map((r) => (
                <div key={r.id}>Must-have: {r.text}</div>
              ))}
              {d.rubric.filter((r) => r.kind === "nice").map((r) => (
                <div key={r.id}>
                  Nice-to-have (weight {r.weight}): {r.text}
                </div>
              ))}
            </div>
            {job.status === "draft" && (
              <Link href={`/app/jobs/${id}/edit`} className="text-sm underline mt-3 inline-block">
                Edit
              </Link>
            )}
          </Step>

          <Step n={2} title="Candidates" done={d.candidateCount > 0}>
            <p className="text-sm mb-3">
              {d.candidateCount} candidate{d.candidateCount === 1 ? "" : "s"} uploaded
              {job.testMode && ` (test mode: up to ${config().TEST_MODE_MAX_CANDIDATES})`}.
            </p>
            {user.isDemo ? (
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                Uploads are turned off in the shared demo workspace. <Link href="/login" className="underline">Sign up free</Link> to try your own list.
              </p>
            ) : (
              job.status !== "closed" && (
                <Link href={`/app/jobs/${id}/upload`} className="btn-base btn-ghost">
                  Upload CSV
                </Link>
              )
            )}
          </Step>

          <Step n={3} title="Start screening" done={job.status !== "draft"}>
            {job.status === "draft" ? (
              gate.ok ? (
                <form action={launchTestAction}>
                  <input type="hidden" name="jobId" value={id} />
                  <p className="text-sm mb-3">Free test: we&apos;ll message your {d.candidateCount} candidate(s) on WhatsApp now.</p>
                  <button className="btn-base btn-primary">Start free test</button>
                </form>
              ) : gate.needsPayment ? (
                <form action={checkoutAction}>
                  <input type="hidden" name="jobId" value={id} />
                  <p className="text-sm mb-1">
                    <span className="type-stat text-3xl mr-2">{formatInr(job.priceInr)}</span> for this job, up to {config().MAX_CANDIDATES_PER_JOB} candidates.
                  </p>
                  <p className="text-xs mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
                    Pay by UPI. Messages go out as soon as the payment is confirmed. No subscription.
                  </p>
                  <button className="btn-base btn-primary">Pay {formatInr(job.priceInr)} by UPI</button>
                </form>
              ) : (
                <p className="text-sm">{gate.reason}</p>
              )
            ) : (
              <div className="text-sm space-y-2">
                <p>
                  Started {job.launchedAt?.toLocaleString("en-IN")}.
                  {paid && (
                    <>
                      {" "}Paid {formatInr(paid.amountInr)} ·{" "}
                      <Link className="underline" href={`/app/jobs/${id}/receipt/${paid.id}`}>
                        Receipt
                      </Link>
                    </>
                  )}
                </p>
              </div>
            )}
          </Step>

          <Step n={4} title="Review the shortlist" done={Boolean(job.reviewedAt)}>
            <p className="text-sm mb-3">
              {count("completed")} candidate(s) finished. Check scores and transcripts, tag who to call, then export or share.
            </p>
            <Link href={`/app/jobs/${id}/shortlist`} className="btn-base btn-ghost">
              Open shortlist
            </Link>
          </Step>
        </div>

        <aside className="space-y-4">
          <div className="card">
            <h2 className="text-xl mb-3">Progress</h2>
            {d.statusCounts.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>No candidates yet.</p>
            ) : (
              <dl className="text-sm space-y-1">
                {d.statusCounts.map((c) => (
                  <div key={c.status} className="flex justify-between">
                    <dt>{candidateStatusLabel(c.status)}</dt>
                    <dd className="font-medium">{c.n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {job.status === "active" && (
            <form action={closeJobAction} className="card">
              <input type="hidden" name="jobId" value={id} />
              <h2 className="text-xl mb-2">Close job</h2>
              <p className="text-xs mb-3" style={{ color: "var(--color-on-surface-variant)" }}>
                Stops screening and starts the {config().RETENTION_DAYS}-day deletion timer. We email you a summary.
              </p>
              <button className="btn-base btn-ghost">Close job</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
          style={done ? { background: "var(--color-primary)", color: "#fff" } : { background: "var(--color-surface-container)", color: "var(--color-on-surface)" }}
          aria-hidden
        >
          {done ? "✓" : n}
        </span>
        <h2 className="text-xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}
