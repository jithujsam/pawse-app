import Link from "next/link";
import { requireOrg } from "@/lib/auth/session";
import { needsAttention } from "@/lib/services/attention";
import { PageHeader } from "@/components/app/Shell";
import { CandidateStatus } from "@/components/app/StatusBadge";

const KIND: Record<string, string> = {
  send_invite: "Invite not sent",
  send_message: "Message not sent",
  score_candidate: "Scoring failed",
};

export default async function AttentionPage() {
  const user = await requireOrg();
  const { conversations, failed } = await needsAttention(user.orgId);
  return (
    <>
      <PageHeader title="Needs attention">Candidates waiting on you, conversations that went quiet, and anything that failed to send or score.</PageHeader>
      <section className="mb-8">
        <h2 className="text-2xl mb-3">Conversations</h2>
        {conversations.length === 0 ? (
          <div className="card text-sm">Nothing waiting. 🎉</div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <Link key={c.candidateId} href={`/app/jobs/${c.jobId}/candidates/${c.candidateId}`} className="card card-sm flex flex-col sm:flex-row justify-between gap-2 hover:shadow-sm">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
                    {c.jobTitle} · {c.state === "needs_human" ? "replied off-script twice" : `no reply since ${c.lastOutboundAt?.toLocaleString("en-IN")}`}
                  </div>
                </div>
                <CandidateStatus status={c.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="text-2xl mb-3">Failed background work</h2>
        {failed.length === 0 ? (
          <div className="card text-sm">No failures.</div>
        ) : (
          <div className="space-y-2">
            {failed.map((f) => (
              <div key={f.id} className="card card-sm text-sm">
                <div className="font-medium">{KIND[f.kind] ?? f.kind}</div>
                <div style={{ color: "var(--color-on-surface-variant)" }}>
                  After {f.attempts} attempts · {f.createdAt.toLocaleString("en-IN")} · {f.lastError}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
