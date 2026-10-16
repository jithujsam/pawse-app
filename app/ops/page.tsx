import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isOpsEmail } from "@/lib/config";
import { opsOverview } from "@/lib/services/ops";
import { getSystemStatus } from "@/lib/services/status";
import { AppShell, PageHeader } from "@/components/app/Shell";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  signup: "Signed up",
  org_created: "Created workspace",
  job_created: "Created a job",
  csv_uploaded: "Uploaded a CSV",
  paid: "Paid",
  shortlist_viewed: "Viewed a shortlist",
};

export default async function OpsPage() {
  const user = await requireUser();
  if (!isOpsEmail(user.email)) notFound();
  const [data, status] = await Promise.all([opsOverview(30), getSystemStatus()]);
  return (
    <AppShell user={user}>
      <PageHeader eyebrow="Operator" title="Funnel and cost to serve">Last 30 days, all workspaces. Counts only.</PageHeader>
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {data.funnel.map((f) => (
          <div key={f.name} className="card card-sm">
            <div className="type-stat text-3xl" style={{ color: "var(--color-primary)" }}>{f.actors}</div>
            <div className="text-xs">{LABELS[f.name]}</div>
            <div className="text-[10px]" style={{ color: "var(--color-on-surface-variant)" }}>{f.events} events</div>
          </div>
        ))}
      </section>
      <section className="card card-sm mb-8 text-sm">
        Queue: {status.queue ? `${status.queue.ready} ready, ${status.queue.delayed} delayed over 10 min, ${status.queue.failed24h} failed in 24h` : "database unreachable"} · Providers:{" "}
        {Object.entries(status.modes).map(([k, v]) => `${k}=${v}`).join(", ")}
      </section>
      <section className="card overflow-x-auto">
        <h2 className="text-xl mb-3">Jobs: usage for cost to serve</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--color-on-surface-variant)" }}>
              {["Job", "Workspace", "Candidates", "Response rate", "Templates", "Session msgs", "Voice sec", "LLM tokens in/out"].map((h) => (
                <th key={h} className="py-1 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((j) => (
              <tr key={String(j.id)} className="border-t" style={{ borderColor: "var(--color-outline-variant)" }}>
                <td className="py-1 pr-4">{String(j.title)}</td>
                <td className="py-1 pr-4">{String(j.org)}{j.is_demo ? " (demo)" : ""}</td>
                <td className="py-1 pr-4">{Number(j.candidates)}</td>
                <td className="py-1 pr-4">{Number(j.candidates) ? `${Math.round((Number(j.responded) / Number(j.candidates)) * 100)}%` : "–"}</td>
                <td className="py-1 pr-4">{Number(j.templates)}</td>
                <td className="py-1 pr-4">{Number(j.session_msgs)}</td>
                <td className="py-1 pr-4">{Number(j.stt_seconds)}</td>
                <td className="py-1 pr-4">{Number(j.llm_in)}/{Number(j.llm_out)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs mt-3" style={{ color: "var(--color-on-surface-variant)" }}>
          Multiply by current provider rates to get rupee cost per job. Rates are not hard-coded because they change; see TODO.md.
        </p>
      </section>
    </AppShell>
  );
}
