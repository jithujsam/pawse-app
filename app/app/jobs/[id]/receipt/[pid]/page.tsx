import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/session";
import { getJobDetail, NotFound } from "@/lib/services/jobs";
import { formatInr } from "@/lib/domain/billing";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";
import { PrintButton } from "./PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const user = await requireOrg();
  const { id, pid } = await params;
  const d = await getJobDetail(user.orgId, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  const p = d.payments.find((x) => x.id === pid && x.status === "paid");
  if (!p) notFound();
  return (
    <div className="max-w-xl mx-auto card print:border-0">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="heading-serif text-2xl" style={{ color: "var(--color-primary)" }}>{BRAND.name}</div>
          <div className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>{config().SUPPORT_EMAIL}</div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl">Payment receipt</h1>
          <div className="text-sm">{p.receiptNumber}</div>
        </div>
      </div>
      <dl className="text-sm space-y-2 mb-8">
        <Row k="Billed to" v={user.orgName} />
        <Row k="Paid on" v={p.paidAt?.toLocaleString("en-IN") ?? ""} />
        <Row k="Description" v={`Candidate screening for "${d.job.title}" (${d.job.location})`} />
        <Row k="Payment method" v={p.provider === "mock" ? "UPI (simulated in demo)" : "UPI via Razorpay"} />
        <Row k="Payment reference" v={p.providerRef} />
      </dl>
      <div className="flex justify-between border-t pt-4 text-lg" style={{ borderColor: "var(--color-outline-variant)" }}>
        <span>Total paid</span>
        <span className="font-semibold">{formatInr(p.amountInr)}</span>
      </div>
      <p className="text-xs mt-6" style={{ color: "var(--color-on-surface-variant)" }}>
        This is a payment receipt, not a tax invoice. See our refund policy at {config().APP_URL}/legal/refunds.
      </p>
      <div className="mt-6 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt style={{ color: "var(--color-on-surface-variant)" }}>{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
