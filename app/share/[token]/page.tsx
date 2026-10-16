import { notFound } from "next/navigation";
import { getSharedShortlist } from "@/lib/services/share";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Shortlist" };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedShortlist(token);
  if (!data) notFound();
  return (
    <main className="min-h-screen px-5 py-12" style={{ background: "var(--color-surface)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>
          Shortlist from {data.job.orgName}
        </div>
        <h1 className="text-4xl mb-1">{data.job.title}</h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-on-surface-variant)" }}>
          {data.job.location} · {data.candidates.length} candidate(s). Contact {data.job.orgName} to arrange interviews.
        </p>
        <div className="space-y-3">
          {data.candidates.map((c, i) => (
            <div key={i} className="card card-sm flex gap-4">
              <div className="type-stat text-3xl w-12 shrink-0 text-center" style={{ color: "var(--color-primary)" }}>
                {c.score ?? "–"}
              </div>
              <div>
                <div className="font-medium">{c.name}</div>
                {c.summary && <p className="text-sm mt-1">{c.summary}</p>}
                {c.reason && (
                  <p className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
                    {c.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
          {data.candidates.length === 0 && <div className="card text-sm">No candidates shortlisted yet.</div>}
        </div>
        <p className="text-xs mt-10" style={{ color: "var(--color-on-surface-variant)" }}>
          Screened over WhatsApp with {BRAND.name}. Scores are a guide prepared for {data.job.orgName}; please don&apos;t forward this page.
        </p>
      </div>
    </main>
  );
}
