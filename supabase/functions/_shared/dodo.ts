/**
 * Dodo Payments, the payment provider (docs/MONETISATION.md §7, docs/DEPLOY_MEMBERSHIP.md "Payments").
 * Not active: nothing here runs until the dodo-webhook and dodo-checkout functions are deployed with their secrets.
 *
 * Sources, checked 2026-11-03 against the provider's own packages (the docs site wasn't reachable from here):
 *  - dodopayments@2.61.1 (the official SDK): webhook envelope { business_id, type, timestamp, data }; subscription
 *    events carry the Subscription object (subscription_id, product_id, status, previous_billing_date,
 *    next_billing_date, metadata, customer, …); checkouts are created with POST /checkouts { product_cart, metadata,
 *    customer, return_url } and answer { session_id, checkout_url }; hosts https://test.dodopayments.com and
 *    https://live.dodopayments.com; the API key is a bearer token.
 *  - standardwebhooks@1.1.1 (what the SDK verifies with): headers webhook-id, webhook-timestamp, webhook-signature;
 *    signed text `${id}.${timestamp}.${raw body}`; HMAC-SHA256 with the base64 secret after its "whsec_" prefix;
 *    signatures are space-separated "v1,<base64>"; timestamps more than 5 minutes off are refused.
 * Re-check both against Dodo's current docs in test mode before taking real payments.
 *
 * No imports: runs in Deno (the functions) and Node (the tests).
 */
import type { PaymentVerifier, PlanId, VerifiedPaymentEvent } from "./payments.ts";

/** Everything Dodo-specific that is configured later, in one place. Nothing here has a default. */
export interface DodoConfig {
  /** The webhook's signing secret from Dodo's dashboard ("whsec_…"). Edge Function secret DODO_WEBHOOK_SECRET. */
  webhookSecret: string;
  /** Dodo product ids for the two annual plans. Secrets DODO_PRODUCT_BASIC and DODO_PRODUCT_AI. */
  products: Record<PlanId, string>;
}

/** The metadata key the checkout sets to the account's id, so a payment comes back to the right account. */
export const ACCOUNT_METADATA_KEY = "pawse_account_id";
const TOLERANCE_S = 5 * 60;

/** Decodes base64 into a plain ArrayBuffer (what Web Crypto takes as key material in every TypeScript version). */
function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}
const bytesToBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

/** Compares two strings in time that doesn't depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The Standard Webhooks check: true only if one of the request's v1 signatures is the HMAC of `id.timestamp.body` with
 * the secret, and the timestamp is within five minutes of `nowS` (seconds). `body` must be the raw text as received.
 */
export async function verifyStandardWebhook(secret: string, headers: Headers, body: string, nowS = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const id = headers.get("webhook-id"), ts = headers.get("webhook-timestamp"), sig = headers.get("webhook-signature");
  if (!id || !ts || !sig || !secret) return false;
  const t = Number(ts);
  if (!Number.isInteger(t) || Math.abs(nowS - t) > TOLERANCE_S) return false;
  let keyBytes: ArrayBuffer;
  try { keyBytes = base64ToBuffer(secret.startsWith("whsec_") ? secret.slice(6) : secret); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${t}.${body}`)));
  const expected = bytesToBase64(mac);
  return sig.split(" ").some((part) => {
    const [version, value] = [part.slice(0, part.indexOf(",")), part.slice(part.indexOf(",") + 1)];
    return version === "v1" && sameText(value, expected);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Data = Record<string, unknown> & { metadata?: Record<string, unknown> | null };

/**
 * One Dodo event in our terms, or `{ ignored }` for an event that changes nothing here (it is answered 200, so Dodo
 * doesn't retry it). Our account comes from the checkout's metadata, the plan from the product id.
 *
 *   subscription.active, subscription.plan_changed  → purchase (the paid period: previous → next billing date)
 *   subscription.renewed                           → renewal (Dodo's signal to extend access)
 *   subscription.on_hold, .past_due, .failed       → payment_failed (recorded; access runs to the end of the paid period)
 *   subscription.expired                           → expiry of that subscription
 *   refund.succeeded                               → refund (needs our account id in the refund's metadata; else kept for review)
 *   dispute.lost                                   → revocation (same)
 *   subscription.cancelled, payment.*, anything else → ignored (a cancelled plan simply runs to its end date)
 */
export function mapDodoEvent(envelope: unknown, eventId: string, config: DodoConfig): VerifiedPaymentEvent | { ignored: string } {
  const e = envelope as { type?: unknown; data?: Data } | null;
  const type = typeof e?.type === "string" ? e.type : "";
  const data: Data = e?.data && typeof e.data === "object" ? e.data : {};
  const meta = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const rawAccount = meta[ACCOUNT_METADATA_KEY];
  const accountId = typeof rawAccount === "string" && UUID.test(rawAccount) ? rawAccount.toLowerCase() : null;
  const str = (k: string) => (typeof data[k] === "string" && data[k] ? (data[k] as string) : null);
  const plan: PlanId | null = str("product_id") === config.products.ai ? "ai" : str("product_id") === config.products.basic ? "basic" : null;
  const base = { provider: "dodo", eventId, accountId, plan: null as PlanId | null, periodStart: null as string | null, periodEnd: null as string | null, providerRef: str("subscription_id") };

  switch (type) {
    case "subscription.active":
    case "subscription.plan_changed":
    case "subscription.renewed":
      if (!plan) return { ignored: `product ${str("product_id") ?? "(none)"} isn't a Pawse plan` };
      return { ...base, kind: type === "subscription.renewed" ? "renewal" : "purchase", plan, periodStart: str("previous_billing_date"), periodEnd: str("next_billing_date") };
    case "subscription.on_hold":
    case "subscription.past_due":
    case "subscription.failed":
      return { ...base, kind: "payment_failed", plan };
    case "subscription.expired":
      return { ...base, kind: "expiry" };
    case "refund.succeeded":
      return { ...base, kind: "refund", providerRef: null };
    case "dispute.lost":
      return { ...base, kind: "revocation", providerRef: null };
    default:
      return { ignored: type || "(no type)" };
  }
}

/** The PaymentVerifier for Dodo: signature first, then the event. Reads the raw body exactly as received. */
export function dodoVerifier(config: DodoConfig): PaymentVerifier {
  return {
    provider: "dodo",
    async verify(req: Request) {
      const body = await req.text();
      if (!(await verifyStandardWebhook(config.webhookSecret, req.headers, body))) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { return null; }
      return mapDodoEvent(parsed, req.headers.get("webhook-id")!, config);
    },
  };
}

/** What the checkout function sends Dodo to start a purchase of one plan for one account. */
export function checkoutRequest(plan: PlanId, accountId: string, email: string | null, products: Record<PlanId, string>, returnUrl: string) {
  return {
    product_cart: [{ product_id: products[plan], quantity: 1 }],
    metadata: { [ACCOUNT_METADATA_KEY]: accountId },
    ...(email ? { customer: { email } } : {}),
    return_url: returnUrl,
  };
}
