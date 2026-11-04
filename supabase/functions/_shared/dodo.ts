/**
 * Dodo Payments, the payment provider (docs/MONETISATION.md §7, docs/DEPLOY_MEMBERSHIP.md "Payments").
 * Used by the dodo-webhook and dodo-checkout functions; nothing runs until they are deployed with their secrets.
 *
 * Sources, checked 2026-11-04 against Dodo's official SDK, dodopayments@2.61.1 (the docs site isn't reachable from the
 * build machine; re-check in test mode):
 *  - environments: test_mode → https://test.dodopayments.com, live_mode → https://live.dodopayments.com; the API key
 *    is a bearer token. The SDK's own variables are DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_KEY.
 *  - checkout: POST /checkouts { product_cart, customer, metadata, return_url, cancel_url } → { session_id,
 *    checkout_url }. The checkout's metadata is copied to the payment (and the subscription).
 *  - plan change: POST /subscriptions/{id}/change-plan { product_id, quantity, proration_billing_mode,
 *    on_payment_failure }.
 *  - webhook envelope { business_id, type, timestamp, data }. Subscription: subscription_id, product_id, status,
 *    previous_billing_date, next_billing_date, cancel_at_next_billing_date, metadata, customer.customer_id.
 *    Payment: payment_id, subscription_id, metadata, customer. Refund: refund_id, payment_id, is_partial, metadata (the
 *    refund's own), customer; no subscription id, so a refund finds its account through its payment (migration 0016).
 *    Dispute: dispute_id, payment_id.
 *  - signatures (standardwebhooks@1.1.1, what the SDK verifies with): headers webhook-id, webhook-timestamp,
 *    webhook-signature; signed text `${id}.${timestamp}.${raw body}`; HMAC-SHA256 with the base64 secret after its
 *    "whsec_" prefix; signatures are space-separated "v1,<base64>"; timestamps more than 5 minutes off are refused.
 *
 * No imports: runs in Deno (the functions) and Node (the tests).
 */
import type { PaymentVerifier, PlanId, VerifiedPaymentEvent } from "./payments.ts";

/** Everything Dodo-specific that the webhook needs, from Edge Function secrets. Nothing here has a default. */
export interface DodoConfig {
  /** The webhook's signing secret from Dodo's dashboard ("whsec_…"). Secret DODO_PAYMENTS_WEBHOOK_KEY. */
  webhookSecret: string;
  /** Dodo product ids for the two annual plans. Secrets DODO_BASIC_PRODUCT_ID and DODO_AI_PRODUCT_ID. */
  products: Record<PlanId, string>;
}

/** The two hosts the API key may ever be sent to, by DODO_PAYMENTS_ENVIRONMENT. Nothing else is accepted. */
export const DODO_HOSTS = { test_mode: "https://test.dodopayments.com", live_mode: "https://live.dodopayments.com" } as const;
export type DodoEnvironment = keyof typeof DODO_HOSTS;

/**
 * The API host for the configured environment, or null when the setting is anything else. live_mode also needs
 * DODO_PAYMENTS_LIVE_ENABLED=true, a second, deliberate switch, so a mistyped environment can't take real money.
 */
export function dodoApiBase(environment: string | undefined, liveEnabled: string | undefined): string | null {
  if (environment === "test_mode") return DODO_HOSTS.test_mode;
  if (environment === "live_mode" && liveEnabled === "true") return DODO_HOSTS.live_mode;
  return null;
}

/** The metadata key the checkout sets to the account's id, so a payment comes back to the right account. */
export const ACCOUNT_METADATA_KEY = "pawse_account_id";
/** The metadata key for the plan chosen in the app (informational; the plan is always read from the product id). */
export const PLAN_METADATA_KEY = "pawse_plan";
/** The query parameter the checkout's cancel address carries, so the app can tell a cancelled checkout apart. */
export const CANCEL_PARAM = "pawse_checkout";
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
type Data = Record<string, unknown> & { metadata?: Record<string, unknown> | null; customer?: Record<string, unknown> | null };

/**
 * One Dodo event in our terms, or `{ ignored }` for an event that changes nothing here (answered 200, so Dodo doesn't
 * retry it). The account comes from the metadata the checkout set, or, for events without it (renewals, refunds),
 * from what the database already knows about the subscription or payment. The plan comes only from the product id.
 *
 *   subscription.active, .plan_changed, .updated (active)  → purchase (the paid period: previous → next billing date)
 *   subscription.renewed                                  → renewal
 *   subscription.on_hold, .past_due, .failed              → payment_failed (recorded; access runs to the paid end)
 *   subscription.cancelled                                → cancellation (renewal off; access runs to the paid end)
 *   subscription.expired                                  → expiry
 *   payment.succeeded                                     → payment (recorded: maps the payment to its account)
 *   payment.failed                                        → payment_failed
 *   refund.succeeded                                      → refund, or partial_refund (held for review)
 *   dispute.lost                                          → revocation
 *   anything else (payment.processing, refund.failed, dispute.opened, …) → ignored
 */
export function mapDodoEvent(envelope: unknown, eventId: string, config: DodoConfig): VerifiedPaymentEvent | { ignored: string } {
  const e = envelope as { type?: unknown; timestamp?: unknown; data?: Data } | null;
  const type = typeof e?.type === "string" ? e.type : "";
  const data: Data = e?.data && typeof e.data === "object" ? e.data : {};
  const meta = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const rawAccount = meta[ACCOUNT_METADATA_KEY];
  const accountId = typeof rawAccount === "string" && UUID.test(rawAccount) ? rawAccount.toLowerCase() : null;
  const str = (k: string) => (typeof data[k] === "string" && data[k] ? (data[k] as string) : null);
  const customer = data.customer && typeof data.customer === "object" && typeof data.customer.customer_id === "string" ? data.customer.customer_id : null;
  const eventAt = typeof e?.timestamp === "string" && !Number.isNaN(Date.parse(e.timestamp)) ? e.timestamp : null;
  const product = str("product_id");
  const plan: PlanId | null = product && product === config.products.ai ? "ai" : product && product === config.products.basic ? "basic" : null;
  const renews = typeof data.cancel_at_next_billing_date === "boolean" ? !data.cancel_at_next_billing_date : null;
  const base = {
    provider: "dodo", eventId, accountId, plan: null as PlanId | null, periodStart: null as string | null, periodEnd: null as string | null,
    providerRef: str("subscription_id"), paymentRef: null as string | null, customerRef: customer, eventAt, renews: null as boolean | null,
  };
  const notOurs = { ignored: `product ${product ?? "(none)"} isn't a Pawse plan` };

  switch (type) {
    case "subscription.updated":
      if (str("status") !== "active") return { ignored: `subscription.updated (${str("status") ?? "no status"})` };
    // falls through: an active subscription's current state, applied like a purchase (the database ignores it unless it changes the plan or period)
    case "subscription.active":
    case "subscription.plan_changed":
    case "subscription.renewed":
      if (!plan) return notOurs;
      return { ...base, kind: type === "subscription.renewed" ? "renewal" : "purchase", plan, periodStart: str("previous_billing_date"), periodEnd: str("next_billing_date"), renews };
    case "subscription.on_hold":
    case "subscription.past_due":
    case "subscription.failed":
      return { ...base, kind: "payment_failed", plan };
    case "subscription.cancelled":
      return { ...base, kind: "cancellation", plan, renews: false };
    case "subscription.expired":
      return { ...base, kind: "expiry", periodEnd: str("next_billing_date"), renews: false };
    case "payment.succeeded":
      return { ...base, kind: "payment", paymentRef: str("payment_id") };
    case "payment.failed":
      return { ...base, kind: "payment_failed", paymentRef: str("payment_id") };
    case "refund.succeeded":
      if (!str("payment_id")) return { ignored: "refund without a payment id" };
      return { ...base, kind: data.is_partial === true ? "partial_refund" : "refund", providerRef: null, paymentRef: str("payment_id") };
    case "dispute.lost":
      if (!str("payment_id")) return { ignored: "dispute without a payment id" };
      return { ...base, kind: "revocation", providerRef: null, paymentRef: str("payment_id") };
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

/** True for a return address the checkout may send people to: https, or the app's own link (opens Pawse). */
export function validReturnUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return (u.protocol === "https:" && !!u.hostname && !u.username && !u.password) || raw.startsWith("app.detoxcompanion://checkout-return");
  } catch { return false; }
}

/** The same address with ?pawse_checkout=cancelled, where Dodo sends people who leave the checkout without paying. */
export function cancelUrlFor(returnUrl: string): string {
  return returnUrl + (returnUrl.includes("?") ? "&" : "?") + `${CANCEL_PARAM}=cancelled`;
}

/** What the checkout function sends Dodo to start a purchase of one plan for one account. Only allowlisted products. */
export function checkoutRequest(plan: PlanId, accountId: string, email: string | null, products: Record<PlanId, string>, returnUrl: string) {
  return {
    product_cart: [{ product_id: products[plan], quantity: 1 }],
    metadata: { [ACCOUNT_METADATA_KEY]: accountId, [PLAN_METADATA_KEY]: plan },
    ...(email ? { customer: { email } } : {}),
    return_url: returnUrl,
    cancel_url: cancelUrlFor(returnUrl),
  };
}

/**
 * What the checkout function sends Dodo to move a Basic subscription to AI (POST /subscriptions/{id}/change-plan).
 * Dodo charges the card on file the prorated difference at once; if that charge fails, nothing changes.
 * Access changes only when the signed subscription.plan_changed webhook arrives.
 */
export function upgradeRequest(products: Record<PlanId, string>, accountId: string) {
  return {
    product_id: products.ai,
    quantity: 1,
    proration_billing_mode: "prorated_immediately",
    on_payment_failure: "prevent_change",
    metadata: { [ACCOUNT_METADATA_KEY]: accountId, [PLAN_METADATA_KEY]: "ai" },
  };
}
