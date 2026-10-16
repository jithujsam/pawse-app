"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireOrg } from "@/lib/auth/session";
import { withOrg } from "@/lib/db/tenant";
import { payments } from "@/lib/db/schema";
import { MockPayments, signMockPayment } from "@/lib/adapters/payments";
import { handlePaymentWebhook } from "@/lib/services/payments";
import { kickQueue } from "@/lib/jobs";

/** Simulate the provider calling our webhook after a successful UPI payment. */
export async function confirmMockPayment(form: FormData) {
  const user = await requireOrg();
  const ref = String(form.get("ref") ?? "");
  const [p] = await withOrg(user.orgId, (tx) =>
    tx
      .select()
      .from(payments)
      .where(and(eq(payments.providerRef, ref), eq(payments.orgId, user.orgId), eq(payments.provider, "mock"))),
  );
  if (!p) redirect("/app");
  const body = JSON.stringify({ id: `evt_${ref}`, event: "paid", ref });
  await handlePaymentWebhook(body, new Headers({ "x-mock-signature": signMockPayment(body) }), new MockPayments());
  after(() => kickQueue());
  redirect(`/app/jobs/${p.jobId}?launched=1`);
}
