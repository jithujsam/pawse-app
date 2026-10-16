import { PublicPage } from "@/components/site/SiteChrome";
import { getSystemStatus } from "@/lib/services/status";
import { config } from "@/lib/config";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: `Status · ${BRAND.name}` };

export default async function StatusPage() {
  const s = await getSystemStatus();
  const healthy = s.database && (s.queue?.delayed ?? 0) === 0;
  const rows: [string, boolean, string][] = [
    ["App and database", s.database, s.database ? "Operational" : "Unreachable"],
    ["Message processing", s.database && (s.queue?.delayed ?? 0) === 0, s.queue ? (s.queue.delayed ? `${s.queue.delayed} messages delayed` : "Operational") : "Unknown"],
  ];
  return (
    <PublicPage>
      <section className="max-w-2xl mx-auto px-5 py-16">
        <h1 className="text-4xl mb-6">Status</h1>
        <div className="card mb-6" style={{ borderColor: healthy ? "var(--color-primary)" : "var(--color-error)" }}>
          <div className="flex items-center gap-3">
            <span className="status-dot" style={{ background: healthy ? "var(--color-primary)" : "var(--color-error)" }} />
            <span className="font-medium">{healthy ? "All systems operational" : "Some systems are having problems"}</span>
          </div>
        </div>
        <div className="card space-y-3">
          {rows.map(([name, ok, label]) => (
            <div key={name} className="flex justify-between text-sm">
              <span>{name}</span>
              <span style={{ color: ok ? "var(--color-primary)" : "var(--color-error)" }}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm mt-6" style={{ color: "var(--color-on-surface-variant)" }}>
          Problem not shown here? Email <a className="underline" href={`mailto:${config().SUPPORT_EMAIL}`}>{config().SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </PublicPage>
  );
}
