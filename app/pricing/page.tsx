import Link from "next/link";
import { PublicPage } from "@/components/site/SiteChrome";
import { config } from "@/lib/config";
import { formatInr } from "@/lib/domain/billing";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Pricing · ${BRAND.name}` };

export default function PricingPage() {
  const c = config();
  return (
    <PublicPage>
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h1 className="text-4xl md:text-5xl mb-4">One price per job. Pay by UPI.</h1>
        <p className="text-lg mb-12" style={{ color: "var(--color-on-surface-variant)" }}>
          No subscription, no card, no seats. You pay when you have a role to fill.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="eyebrow mb-2">Free test</div>
            <div className="type-stat text-5xl mb-2">₹0</div>
            <p className="text-sm mb-6" style={{ color: "var(--color-on-surface-variant)" }}>
              Screen up to {c.TEST_MODE_MAX_CANDIDATES} candidates to see exactly what they receive and what you get back.
            </p>
            <Link href="/login" className="btn-base btn-ghost">
              Start free
            </Link>
          </div>
          <div className="card" style={{ borderColor: "var(--color-primary)" }}>
            <div className="eyebrow mb-2" style={{ color: "var(--color-primary)" }}>
              Per job
            </div>
            <div className="type-stat text-5xl mb-2">{formatInr(c.PRICE_PER_JOB_INR)}</div>
            <ul className="text-sm space-y-1 mb-6" style={{ color: "var(--color-on-surface-variant)" }}>
              <li>Up to {c.MAX_CANDIDATES_PER_JOB} candidates</li>
              <li>WhatsApp screening in English or Hindi, text and voice notes</li>
              <li>Scored, ranked shortlist with reasons and transcripts</li>
              <li>CSV export and a client share link</li>
              <li>Paid by UPI before any message is sent; receipt by email</li>
            </ul>
            <Link href="/login" className="btn-base btn-primary">
              Run my first role
            </Link>
          </div>
        </div>
        <p className="text-sm mt-8" style={{ color: "var(--color-on-surface-variant)" }}>
          Prices in Indian rupees. See our <Link href="/legal/refunds" className="underline">refund policy</Link>. Hiring for many roles a month?{" "}
          <a href={`mailto:${c.SUPPORT_EMAIL}`} className="underline">Talk to us</a>.
        </p>
      </section>
    </PublicPage>
  );
}
