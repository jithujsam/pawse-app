import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getCandidateDetail } from "@/lib/services/candidates";
import { NotFound } from "@/lib/services/jobs";
import { Notice, PageHeader } from "@/components/app/Shell";
import { CandidateStatus } from "@/components/app/StatusBadge";
import { deleteCandidateAction, tagAction } from "../../../../actions";
import { DirectMessageForm, EditScoreForm } from "./forms";

export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cid: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireOrg();
  const { id, cid } = await params;
  const { error } = await searchParams;
  const d = await getCandidateDetail(user.orgId, id, cid).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const { candidate: c, score } = d;
  const deleted = c.status === "deleted";
  const back = `/app/jobs/${id}/candidates/${cid}`;

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/app/jobs/${id}/shortlist`}>← {d.job.title}</Link>}
        title={c.name}
        actions={
          !deleted && (
            <>
              <form action={tagAction}>
                <input type="hidden" name="candidateId" value={cid} />
                <input type="hidden" name="tag" value={c.tag === "shortlist" ? "" : "shortlist"} />
                <input type="hidden" name="back" value={back} />
                <button className="btn-base btn-primary">{c.tag === "shortlist" ? "Remove from shortlist" : "Shortlist"}</button>
              </form>
              <form action={tagAction}>
                <input type="hidden" name="candidateId" value={cid} />
                <input type="hidden" name="tag" value={c.tag === "reject" ? "" : "reject"} />
                <input type="hidden" name="back" value={back} />
                <button className="btn-base btn-ghost">{c.tag === "reject" ? "Undo reject" : "Reject"}</button>
              </form>
            </>
          )
        }
      >
        <span className="inline-flex flex-wrap items-center gap-2">
          <CandidateStatus status={c.status} />
          {!deleted && (
            <>
              <a href={`tel:${c.phone}`} className="underline">{c.phone}</a>
              <a href={`https://wa.me/${c.phone.replace("+", "")}`} className="underline" target="_blank" rel="noreferrer">
                Open in WhatsApp
              </a>
            </>
          )}
          <span>{c.language === "hi" ? "Hindi" : "English"}</span>
        </span>
      </PageHeader>

      {error && <div className="mb-4"><Notice tone="warning">{error}</Notice></div>}
      {c.status === "needs_human" && (
        <div className="mb-4">
          <Notice tone="warning">This candidate replied off-script twice, so automatic messages stopped. Message them below or call them.</Notice>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {score && !deleted && (
            <section className="card">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-xl">Score</h2>
                  <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>{score.summary}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="type-stat text-5xl" style={{ color: "var(--color-primary)" }}>
                    {score.editedTotal ?? score.total}
                  </div>
                  {score.editedTotal != null && (
                    <div className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                      AI score {score.total}, edited
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm mb-4"><strong>Why:</strong> {score.reason}</p>
              <div className="space-y-2 text-sm">
                {score.breakdown.knockouts.map((k) => (
                  <div key={k.id} className="flex gap-3">
                    <span className={`badge ${k.met === "yes" ? "badge-success" : "badge-warning"} shrink-0`}>{k.met === "yes" ? "Met" : k.met === "no" ? "Not met" : "Unclear"}</span>
                    <div>
                      <div className="font-medium">Must-have: {k.text}</div>
                      <div style={{ color: "var(--color-on-surface-variant)" }}>{k.evidence}</div>
                    </div>
                  </div>
                ))}
                {score.breakdown.niceToHaves.map((n) => (
                  <div key={n.id} className="flex gap-3">
                    <span className="badge badge-neutral shrink-0">{n.rating}/3</span>
                    <div>
                      <div className="font-medium">
                        {n.text} <span className="font-normal">(weight {n.weight})</span>
                      </div>
                      <div style={{ color: "var(--color-on-surface-variant)" }}>{n.evidence}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-4" style={{ color: "var(--color-on-surface-variant)" }}>
                Scored by {score.model}. {score.editNote && `Edit note: ${score.editNote}`}
              </p>
              <EditScoreForm jobId={id} candidateId={cid} current={score.editedTotal ?? score.total} />
            </section>
          )}

          <section className="card">
            <h2 className="text-xl mb-3">Answers</h2>
            {d.answers.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>No answers yet.</p>
            ) : (
              <dl className="space-y-3 text-sm">
                {d.answers.map((a) => (
                  <div key={a.pos}>
                    <dt className="font-medium">
                      {a.pos + 1}. {a.q}
                    </dt>
                    <dd className="mt-1">
                      {a.source === "voice" && <span className="badge badge-neutral mr-2">Voice note</span>}
                      {a.text}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <section className="card">
            <h2 className="text-xl mb-3">WhatsApp transcript</h2>
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {d.messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                  <div
                    className="rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words"
                    style={m.direction === "in" ? { background: "var(--color-surface-container-low)" } : { background: "rgba(173,241,207,0.45)" }}
                  >
                    {m.kind === "voice" && <div className="eyebrow mb-1">Voice note · transcript</div>}
                    {m.sentBy === "recruiter" && <div className="eyebrow mb-1">You</div>}
                    {m.body ?? m.transcript ?? <em>[deleted]</em>}
                    <div className="text-[10px] mt-1 opacity-60">
                      {m.createdAt.toLocaleString("en-IN")}
                      {m.status === "failed" && " · failed"}
                      {m.status === "queued" && " · sending"}
                    </div>
                  </div>
                </div>
              ))}
              {d.messages.length === 0 && <p className="text-sm">No messages yet.</p>}
            </div>
            {!deleted && d.conversation && c.status !== "opted_out" && <DirectMessageForm jobId={id} candidateId={cid} />}
          </section>

          <section className="card text-sm space-y-2">
            <h2 className="text-xl">Consent and data</h2>
            {d.consent ? (
              <p>
                Consent recorded {d.consent.grantedAt.toLocaleDateString("en-IN")} via CSV upload (notice {d.consent.noticeVersion}).
                {d.consent.withdrawnAt && ` Withdrawn ${d.consent.withdrawnAt.toLocaleDateString("en-IN")}.`}
              </p>
            ) : (
              <p>No consent record.</p>
            )}
            {!deleted && (
              <form action={deleteCandidateAction} className="pt-2 space-y-2">
                <input type="hidden" name="jobId" value={id} />
                <input type="hidden" name="candidateId" value={cid} />
                <label className="block text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                  Delete this candidate&apos;s personal data (name, number, messages, answers). Type DELETE to confirm. This can&apos;t be undone.
                  <input name="confirm" className="input mt-1" autoComplete="off" />
                </label>
                <button className="btn-base btn-ghost" style={{ color: "var(--color-error)" }}>
                  Delete data
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
