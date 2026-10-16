import { randomUUID } from "node:crypto";
import { config } from "../../config";
import { hmacHex, safeEqual } from "../../crypto";

export type PaymentEvent = {
  eventId: string;
  type: "paid" | "failed" | "other";
  providerRef: string;
};

export interface PaymentProvider {
  readonly name: "mock" | "razorpay";
  createLink(input: { amountInr: number; receiptNumber: string; description: string; email: string }): Promise<{
    providerRef: string;
    url: string;
  }>;
  /** Verify signature and parse. null = bad signature (reject with 400). */
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent | null;
}

/** Simulated UPI checkout at /pay/mock/<ref>. Only active when PAYMENT_PROVIDER=mock. */
export class MockPayments implements PaymentProvider {
  readonly name = "mock" as const;
  async createLink() {
    const ref = `mock_plink_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return { providerRef: ref, url: `${config().APP_URL}/pay/mock/${ref}` };
  }
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent | null {
    const sig = headers.get("x-mock-signature") ?? "";
    if (!safeEqual(sig, hmacHex(config().MOCK_PAYMENT_SECRET, rawBody))) return null;
    const body = JSON.parse(rawBody) as { id: string; event: string; ref: string };
    return { eventId: body.id, type: body.event === "paid" ? "paid" : "failed", providerRef: body.ref };
  }
}

export function signMockPayment(body: string) {
  return hmacHex(config().MOCK_PAYMENT_SECRET, body);
}

/**
 * Razorpay Payment Links with UPI. NOT yet tested against live keys: see TODO.md.
 * Configure a webhook in the Razorpay dashboard for payment_link.paid.
 */
export class RazorpayPayments implements PaymentProvider {
  readonly name = "razorpay" as const;
  async createLink(input: { amountInr: number; receiptNumber: string; description: string; email: string }) {
    const c = config();
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.RAZORPAY_KEY_ID}:${c.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountInr * 100, // paise
        currency: "INR",
        reference_id: input.receiptNumber,
        description: input.description.slice(0, 2048),
        customer: { email: input.email },
        notify: { email: true },
        callback_url: `${c.APP_URL}/app`,
        callback_method: "get",
      }),
    });
    const json = (await res.json()) as { id?: string; short_url?: string; error?: { description?: string } };
    if (!res.ok || !json.id || !json.short_url) throw new Error(`Razorpay link failed: ${json.error?.description ?? res.status}`);
    return { providerRef: json.id, url: json.short_url };
  }
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent | null {
    const secret = config().RAZORPAY_WEBHOOK_SECRET;
    const sig = headers.get("x-razorpay-signature") ?? "";
    if (!secret || !safeEqual(sig, hmacHex(secret, rawBody))) return null;
    const body = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment_link?: { entity?: { id: string } } };
    };
    const ref = body.payload?.payment_link?.entity?.id ?? "";
    const eventId = headers.get("x-razorpay-event-id") ?? `${body.event}:${ref}`;
    const type = body.event === "payment_link.paid" ? "paid" : body.event === "payment_link.cancelled" ? "failed" : "other";
    return { eventId, type, providerRef: ref };
  }
}
