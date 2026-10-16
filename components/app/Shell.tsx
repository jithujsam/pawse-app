import Link from "next/link";
import { BRAND } from "@/lib/brand";
import type { CurrentUser } from "@/lib/auth/session";

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface)" }}>
      {user.isDemo && (
        <div className="text-center text-xs py-2 px-4" style={{ background: "var(--color-primary)", color: "#fff" }}>
          Demo workspace with sample data. Messages are simulated; nothing is sent to real phones.
        </div>
      )}
      <header className="border-b bg-white" style={{ borderColor: "var(--color-outline-variant)" }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/app" className="heading-serif text-xl shrink-0" style={{ color: "var(--color-primary)" }}>
              {BRAND.name}
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
              <Link href="/app" className="hover:underline">Jobs</Link>
              <Link href="/app/attention" className="hover:underline">Needs attention</Link>
              <Link href="/help" className="hover:underline">Help</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm min-w-0">
            <span className="truncate hidden md:inline" style={{ color: "var(--color-on-surface-variant)" }}>
              {user.orgName ?? user.email}
            </span>
            <form action="/auth/signout" method="post">
              <button className="btn-base btn-ghost" style={{ padding: "8px 14px" }}>Sign out</button>
            </form>
          </div>
        </div>
        <nav className="sm:hidden flex gap-5 px-5 pb-3 text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
          <Link href="/app">Jobs</Link>
          <Link href="/app/attention">Needs attention</Link>
          <Link href="/help">Help</Link>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <div className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl break-words" style={{ color: "var(--color-on-surface)" }}>
          {title}
        </h1>
        {children && <div className="mt-2 text-sm" style={{ color: "var(--color-on-surface-variant)" }}>{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    neutral: { background: "var(--color-surface-container-low)", color: "var(--color-on-surface)" },
    warning: { background: "var(--color-error-container)", color: "var(--color-on-error-container)" },
    success: { background: "rgba(173,241,207,0.4)", color: "var(--color-primary)" },
  }[tone];
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={styles} role={tone === "warning" ? "alert" : undefined}>
      {children}
    </div>
  );
}
