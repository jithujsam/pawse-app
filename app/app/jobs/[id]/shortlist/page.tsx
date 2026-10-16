import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { getShortlist } from "@/lib/services/candidates";
import { withOrg } from "@/lib/db/tenant";
import { track } from "@/lib/domain/audit";
import { config } from "@/lib/config";
import { Notice, PageHeader } from "@/components/app/Shell";
import { CandidateStatus } from "@/components/app/StatusBadge";
import { markReviewedAction, shareLinkAction, tagAction } from "../../../actions";

export default async function ShortlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; error?: string }>;
}) {
  const user = await requireOrg();
  const { id } = await params;
  const { filter, error } = await searchParams;
  const d = await getJobDetail(user.orgId, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const all = await getShortlist(user.orgId, id);
  await withOrg(user.orgId, (tx) => track(tx, "shortlist_viewed", { orgId: user.orgId, userId: user.userId }));

  const rows = all.filter((r) =>
    filter === "shortlist" ? r.tag === "shortlist" : filter === "scored" ? r.score : filter === "attention" ? r.status === "needs_human" : true,
  );
  const back = `/app/jobs/${id}/shortlist`;
  const shareUrl = d.job.shareToken ? `${config().APP_URL}/share/${d.job.shareToken}` : null;
  const reviewed = Boolean(d.job.reviewedAt);

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/app/jobs/${id}`}>{d.job.title}</Link>}
        title="Shortlist"
        actions={
          <>
            {reviewed ? (
              <a href={`/app/jobs/${id}/export`} className="btn-base btn-ghost">
                Export CSV
              </a>
            ) : (
              <form action={markReviewedAction}>
                <input type="hidden" name="jobId" value={id} />
                <button className="btn-base btn-primary">Mark as reviewed</button>
              </form>
            )}
          </>
        }
      >
        Ranked by must-haves first, then score. AI scores are suggestions: check the transcript before you decide.
      </PageHeader>

      <div className="space-y-3 mb-4">
        {error && <Notice tone="warning">{error}</Notice>}
        {!reviewed && (
          <Notice>
            Review the scores and transcripts, then mark the shortlist as reviewed to unlock export and client sharing.
          </Notice>
        )}
        {reviewed && d.job.status !== "closed" && (
          <div className="card card-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-sm min-w-0">
              <div className="font-medium">Client share link</div>
              {shareUrl ? (
                <div className="break-all" style={{ color: "var(--color-on-surface-variant)" }}>
                  {shareUrl} · shows candidates tagged Shortlist, without phone numbers
                </div>
              ) : (
                <div style={{ color: "var(--color-on-surface-variant)" }}>A read-only page for your client with the candidates you tag Shortlist. No login needed.</div>
              )}
            </div>
            <form action={shareLinkAction}>
              <input type="hidden" name="jobId" value={id} />
              <input type="hidden" name="enable" value={shareUrl ? "0" : "1"} />
              <button className="btn-base btn-ghost">{shareUrl ? "Turn off link" : "Create link"}</button>
            </form>
          </div>
        )}
      </div>

      <nav className="flex gap-4 text-sm mb-4" aria-label="Filter">
        {[
          ["all", "All"],
          ["scored", "Scored"],
          ["shortlist", "Tagged shortlist"],
          ["attention", "Needs you"],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={k === "all" ? back : `${back}?filter=${k}`}
            className={(filter ?? "all") === k ? "font-semibold underline" : ""}
            style={{ color: "var(--color-primary)" }}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card text-sm">No candidates here yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const total = r.score ? (r.score.editedTotal ?? r.score.total) : null;
            return (
              <div key={r.id} className="card card-sm flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-8 text-sm shrink-0" style={{ color: "var(--color-on-surface-variant)" }}>
                    {i + 1}
                  </div>
                  <div className="w-14 shrink-0 text-center">
                    {total !== null ? (
                      <div className="type-stat text-3xl" style={{ color: r.score!.knockoutPassed ? "var(--color-primary)" : "var(--color-outline)" }}>
                        {total}
                      </div>
                    ) : (
                      <div className="text-sm" style={{ color: "var(--color-outline)" }}>–</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/app/jobs/${id}/candidates/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <CandidateStatus status={r.status} />
                      {r.score && !r.score.knockoutPassed && <span className="badge badge-warning">Must-have not met</span>}
                      {r.score?.editedTotal != null && <span className="badge badge-neutral">Edited</span>}
                      {r.tag === "shortlist" && <span className="badge badge-success">Shortlist</span>}
                      {r.tag === "reject" && <span className="badge badge-neutral">Rejected</span>}
                    </div>
                    {r.score && (
                      <p className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                        {r.score.reason}
                      </p>
                    )}
                  </div>
                </div>
                {r.status !== "deleted" && (
                  <div className="flex gap-2 shrink-0">
                    <TagButton id={r.id} back={back} tag={r.tag === "shortlist" ? "" : "shortlist"} label={r.tag === "shortlist" ? "Untag" : "Shortlist"} />
                    <TagButton id={r.id} back={back} tag={r.tag === "reject" ? "" : "reject"} label={r.tag === "reject" ? "Undo reject" : "Reject"} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function TagButton({ id, back, tag, label }: { id: string; back: string; tag: string; label: string }) {
  return (
    <form action={tagAction}>
      <input type="hidden" name="candidateId" value={id} />
      <input type="hidden" name="tag" value={tag} />
      <input type="hidden" name="back" value={back} />
      <button className="btn-base btn-ghost" style={{ padding: "8px 14px" }}>
        {label}
      </button>
    </form>
  );
}
