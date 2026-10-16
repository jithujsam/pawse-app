import { and, eq } from "drizzle-orm";
import { asSystem, withOrg } from "../db/tenant";
import { organizations, payments, users, webhookEvents } from "../db/schema";
import { paymentsFor, providers } from "../adapters";
import type { PaymentProvider } from "../adapters/payments";
import { audit, track } from "../domain/audit";
import { randomToken } from "../crypto";
import { Forbidden, activateJob, getJobDetail } from "./jobs";
import { log } from "../log";
import { BRAND } from "../brand";

function receiptNumber() {
  const d = new Date();
  return `PR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
}

/** Create (or reuse) a UPI payment link for a job. */
export async function createCheckout(orgId: string, userId: string, jobId: string) {
  const detail = await getJobDetail(orgId, jobId);
  if (detail.gate.ok) throw new Forbidden("This job doesn't need payment.");
  if (!detail.gate.needsPayment) throw new Forbidden(detail.gate.reason);
  const open = detail.payments.find((p) => p.status === "created");
  if (open) return open;

  const [user] = await asSystem((tx) => tx.select({ email: users.email }).from(users).where(eq(users.id, userId)));
  const [org] = await asSystem((tx) => tx.select({ isDemo: organizations.isDemo }).from(organizations).where(eq(organizations.id, orgId)));
  const provider = paymentsFor(org.isDemo);
  const receipt = receiptNumber();
  const link = await provider.createLink({
    amountInr: detail.job.priceInr,
    receiptNumber: receipt,
    description: `${BRAND.name}: screening for "${detail.job.title}"`,
    email: user.email,
  });
  return withOrg(orgId, async (tx) => {
    const [p] = await tx
      .insert(payments)
      .values({
        orgId,
        jobId,
        amountInr: detail.job.priceInr,
        provider: provider.name,
        providerRef: link.providerRef,
        linkUrl: link.url,
        receiptNumber: receipt,
      })
      .returning();
    await audit(tx, orgId, "payment.link_created", "payment", p.id, { userId }, { amountInr: p.amountInr });
    return p;
  });
}

export type WebhookOutcome = "invalid" | "duplicate" | "ignored" | "processed";

/**
 * Payment webhook. Idempotent: each provider event id is processed once,
 * and a payment moves to paid only from created.
 */
export async function handlePaymentWebhook(
  rawBody: string,
  headers: Headers,
  provider: PaymentProvider = providers().payments,
): Promise<WebhookOutcome> {
  let event;
  try {
    event = provider.parseWebhook(rawBody, headers);
  } catch {
    return "invalid";
  }
  if (!event) return "invalid";

  const result = await asSystem(async (tx) => {
    const inserted = await tx
      .insert(webhookEvents)
      .values({ provider: `payments:${provider.name}`, eventId: event.eventId })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (!inserted.length) return { outcome: "duplicate" as const };
    if (event.type === "other") return { outcome: "ignored" as const };
    const [p] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.providerRef, event.providerRef), eq(payments.provider, provider.name)));
    if (!p) {
      log.warn("payment.unknown_ref", { provider: provider.name });
      return { outcome: "ignored" as const };
    }
    return { outcome: "processed" as const, payment: p };
  });
  if (result.outcome !== "processed") return result.outcome;
  const p = result.payment;

  await withOrg(p.orgId, async (tx) => {
    if (event.type === "paid") {
      const updated = await tx
        .update(payments)
        .set({ status: "paid", paidAt: new Date() })
        .where(and(eq(payments.id, p.id), eq(payments.status, "created")))
        .returning({ id: payments.id });
      if (!updated.length) return;
      await audit(tx, p.orgId, "payment.paid", "payment", p.id, { kind: "system" }, { amountInr: p.amountInr });
      await track(tx, "paid", { orgId: p.orgId }, { amountInr: p.amountInr });
      await activateJob(tx, p.orgId, p.jobId, {});
    } else {
      await tx.update(payments).set({ status: "failed" }).where(and(eq(payments.id, p.id), eq(payments.status, "created")));
      await audit(tx, p.orgId, "payment.failed", "payment", p.id, { kind: "system" });
    }
  });
  return "processed";
}
