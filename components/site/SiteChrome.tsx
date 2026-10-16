import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur" style={{ background: "rgba(248,249,255,0.85)", borderColor: "rgba(191,201,193,0.5)" }}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="heading-serif text-2xl" style={{ color: "var(--color-primary)" }}>
          {BRAND.name}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/#how-it-works" className="hidden sm:inline" style={{ color: "var(--color-on-surface-variant)" }}>
            How it works
          </Link>
          <Link href="/pricing" className="hidden sm:inline" style={{ color: "var(--color-on-surface-variant)" }}>
            Pricing
          </Link>
          <Link href="/login" style={{ color: "var(--color-on-surface-variant)" }}>
            Sign in
          </Link>
          <Link href="/login" className="btn-base btn-primary" style={{ padding: "10px 16px" }}>
            Run my first role
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ borderColor: "rgba(191,201,193,0.5)", background: "var(--color-surface)" }}>
      <div className="max-w-6xl mx-auto px-5 py-10 grid sm:grid-cols-4 gap-6 text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
        <div>
          <div className="heading-serif text-xl mb-2" style={{ color: "var(--color-primary)" }}>
            {BRAND.name}
          </div>
          <p>{BRAND.tagline}.</p>
        </div>
        <div className="space-y-1">
          <div className="eyebrow mb-2">Product</div>
          <Link href="/pricing" className="block">Pricing</Link>
          <Link href="/help" className="block">Help</Link>
          <Link href="/status" className="block">Status</Link>
        </div>
        <div className="space-y-1">
          <div className="eyebrow mb-2">Legal</div>
          <Link href="/legal/terms" className="block">Terms</Link>
          <Link href="/legal/privacy" className="block">Privacy</Link>
          <Link href="/legal/dpa" className="block">Data processing</Link>
          <Link href="/legal/refunds" className="block">Refunds</Link>
          <Link href="/legal/candidate-privacy" className="block">Candidate privacy notice</Link>
        </div>
        <div className="space-y-1">
          <div className="eyebrow mb-2">Contact</div>
          <a href={`mailto:${config().SUPPORT_EMAIL}`} className="block">{config().SUPPORT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main style={{ background: "var(--color-surface)" }}>{children}</main>
      <SiteFooter />
    </>
  );
}

/** Wrapper for legal drafts: always shows the review banner. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <PublicPage>
      <article className="max-w-3xl mx-auto px-5 py-14 prose-legal">
        <div className="rounded-lg px-4 py-3 text-sm mb-8" style={{ background: "var(--color-error-container)", color: "var(--color-on-error-container)" }}>
          Draft for legal review. This page has not yet been reviewed by a lawyer and may change.
        </div>
        <h1 className="text-4xl mb-2">{title}</h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-on-surface-variant)" }}>
          Last updated {updated}
        </p>
        {children}
      </article>
    </PublicPage>
  );
}
