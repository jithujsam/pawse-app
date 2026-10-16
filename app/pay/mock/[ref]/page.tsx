import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireOrg } from "@/lib/auth/session";
import { withOrg } from "@/lib/db/tenant";
import { jobs, payments } from "@/lib/db/schema";
import { formatInr } from "@/lib/domain/billing";
import { BRAND } from "@/lib/brand";
import { confirmMockPayment } from "./actions";

export const dynamic = "force-dynamic";

/** Simulated UPI checkout, used in local mode and in the demo workspace. */
export default async function MockPayPage({ params }: { params: Promise<{ ref: string }> }) {
  const user = await requireOrg();
  const { ref } = await params;
  const [row] = await withOrg(user.orgId, (tx) =>
    tx
      .select({ p: payments, title: jobs.title })
      .from(payments)
      .innerJoin(jobs, eq(jobs.id, payments.jobId))
      .where(and(eq(payments.providerRef, ref), eq(payments.orgId, user.orgId), eq(payments.provider, "mock"))),
  );
  if (!row) notFound();
  if (row.p.status === "paid") redirect(`/app/jobs/${row.p.jobId}`);
  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--color-surface)" }}>
      <div className="card w-full max-w-sm text-center">
        <div className="badge badge-warning mb-4">Simulated payment</div>
        <div className="heading-serif text-xl" style={{ color: "var(--color-primary)" }}>{BRAND.name}</div>
        <p className="text-sm mt-1" style={{ color: "var(--color-on-surface-variant)" }}>Screening for “{row.title}”</p>
        <div className="type-stat text-5xl my-6">{formatInr(row.p.amountInr)}</div>
        <div className="mx-auto w-40 h-40 rounded-lg grid grid-cols-6 gap-1 p-2 mb-6" style={{ background: "var(--color-surface-container-low)" }} aria-hidden>
          {Array.from({ length: 36 }, (_, i) => (
            <span key={i} style={{ background: (i * 7) % 5 < 2 ? "var(--color-on-surface)" : "transparent" }} />
          ))}
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--color-on-surface-variant)" }}>
          In live mode this is a Razorpay UPI page: scan with any UPI app or pay with your UPI ID. Here, the button below simulates a successful payment and its
          webhook.
        </p>
        <form action={confirmMockPayment}>
          <input type="hidden" name="ref" value={ref} />
          <button className="btn-base btn-primary w-full">Pay {formatInr(row.p.amountInr)} (simulated)</button>
        </form>
        <Link href={`/app/jobs/${row.p.jobId}`} className="text-sm underline mt-4 inline-block">
          Cancel
        </Link>
      </div>
    </main>
  );
}
