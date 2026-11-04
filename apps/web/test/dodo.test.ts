import { beforeEach, describe, expect, it } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { ACCOUNT_METADATA_KEY, cancelUrlFor, checkoutRequest, dodoApiBase, mapDodoEvent, upgradeRequest, validReturnUrl, verifyStandardWebhook } from "../../../supabase/functions/_shared/dodo.ts";
import { makeDodoWebhook } from "../../../supabase/functions/dodo-webhook/handler.ts";
import { makeDodoCheckout } from "../../../supabase/functions/dodo-checkout/handler.ts";

/**
 * Dodo Payments (supabase/functions/_shared/dodo.ts, dodo-webhook, dodo-checkout). Signatures here are made with
 * Node's own crypto, independently of the code under test, by the Standard Webhooks rule Dodo uses:
 * base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), sent as "v1,<sig>".
 */
const SECRET_BYTES = randomBytes(32);
const SECRET = "whsec_" + SECRET_BYTES.toString("base64");
const PRODUCTS = { basic: "pdt_basic_test", ai: "pdt_ai_test" };
const ACCOUNT = "aaaaaaaa-0000-4000-8000-00000000000a";
const now = () => Math.floor(Date.now() / 1000);
const sign = (id: string, ts: number, body: string, key = SECRET_BYTES) => "v1," + createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");

const sub = (over: Record<string, unknown> = {}) => ({
  subscription_id: "sub_1", product_id: PRODUCTS.ai, status: "active", cancel_at_next_billing_date: false, previous_billing_date: "2026-11-03T00:00:00Z", next_billing_date: "2027-11-03T00:00:00Z",
  metadata: { [ACCOUNT_METADATA_KEY]: ACCOUNT }, customer: { customer_id: "cus_1", email: "a@x" }, ...over,
});
const envelope = (type: string, data: Record<string, unknown> = sub()) => ({ business_id: "bus_1", type, timestamp: "2026-11-03T10:00:00Z", data });
const delivery = (body: string, opts: { id?: string; ts?: number; sig?: string } = {}) => {
  const id = opts.id ?? "msg_" + Math.random().toString(36).slice(2), ts = opts.ts ?? now();
  return new Request("https://fn.local/dodo-webhook", { method: "POST", body, headers: { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": opts.sig ?? sign(id, ts, body), "content-type": "application/json" } });
};

describe("Dodo's webhook signature (Standard Webhooks)", () => {
  const body = JSON.stringify(envelope("subscription.active"));
  const headers = (id: string, ts: number, sig: string) => new Headers({ "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": sig });

  it("accepts a correct signature", async () => {
    const ts = now();
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", ts, sign("msg_1", ts, body)), body)).toBe(true);
  });
  it("accepts when any of several signatures matches (key rotation)", async () => {
    const ts = now();
    const both = `${sign("msg_1", ts, body, randomBytes(32))} ${sign("msg_1", ts, body)}`;
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", ts, both), body)).toBe(true);
  });
  it("refuses a changed body, id or timestamp, the wrong secret, or no signature", async () => {
    const ts = now(), good = sign("msg_1", ts, body);
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", ts, good), body.replace("active", "expired"))).toBe(false);
    expect(await verifyStandardWebhook(SECRET, headers("msg_2", ts, good), body)).toBe(false);
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", ts + 1, good), body)).toBe(false);
    expect(await verifyStandardWebhook("whsec_" + randomBytes(32).toString("base64"), headers("msg_1", ts, good), body)).toBe(false);
    expect(await verifyStandardWebhook(SECRET, new Headers({ "webhook-id": "msg_1", "webhook-timestamp": String(ts) }), body)).toBe(false);
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", ts, good.replace("v1,", "v2,")), body)).toBe(false);
  });
  it("refuses a delivery more than five minutes old or ahead (replays)", async () => {
    const old = now() - 301, ahead = now() + 301;
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", old, sign("msg_1", old, body)), body)).toBe(false);
    expect(await verifyStandardWebhook(SECRET, headers("msg_1", ahead, sign("msg_1", ahead, body)), body)).toBe(false);
  });
});

describe("Dodo events in Pawse's terms", () => {
  const map = (type: string, data?: Record<string, unknown>) => mapDodoEvent(envelope(type, data), "msg_9", { webhookSecret: SECRET, products: PRODUCTS });
  it("a new subscription is a purchase of its plan, for the account in its metadata, for its paid year", () => {
    expect(map("subscription.active")).toEqual({ provider: "dodo", eventId: "msg_9", accountId: ACCOUNT, kind: "purchase", plan: "ai",
      periodStart: "2026-11-03T00:00:00Z", periodEnd: "2027-11-03T00:00:00Z", providerRef: "sub_1", paymentRef: null, customerRef: "cus_1",
      eventAt: "2026-11-03T10:00:00Z", renews: true });
    expect(map("subscription.active", sub({ product_id: PRODUCTS.basic }))).toMatchObject({ kind: "purchase", plan: "basic" });
  });
  it("renewal, plan change up and down, subscription.updated, failed payment, cancellation, expiry", () => {
    expect(map("subscription.renewed", sub({ metadata: {} }))).toMatchObject({ kind: "renewal", plan: "ai", accountId: null, providerRef: "sub_1" });
    expect(map("subscription.plan_changed")).toMatchObject({ kind: "purchase", plan: "ai" });
    expect(map("subscription.plan_changed", sub({ product_id: PRODUCTS.basic }))).toMatchObject({ kind: "purchase", plan: "basic", providerRef: "sub_1" });
    expect(map("subscription.updated")).toMatchObject({ kind: "purchase", plan: "ai", renews: true });
    expect(map("subscription.updated", sub({ cancel_at_next_billing_date: true }))).toMatchObject({ kind: "purchase", renews: false });
    expect(map("subscription.updated", sub({ status: "on_hold" }))).toHaveProperty("ignored");
    for (const t of ["subscription.on_hold", "subscription.past_due", "subscription.failed"]) expect(map(t)).toMatchObject({ kind: "payment_failed", providerRef: "sub_1" });
    expect(map("subscription.cancelled")).toMatchObject({ kind: "cancellation", renews: false, providerRef: "sub_1" });
    expect(map("subscription.expired")).toMatchObject({ kind: "expiry", providerRef: "sub_1", periodEnd: "2027-11-03T00:00:00Z" });
  });
  it("payments are recorded with their subscription, so a later refund finds its account", () => {
    const pay = { payment_id: "pay_1", subscription_id: "sub_1", metadata: { [ACCOUNT_METADATA_KEY]: ACCOUNT }, customer: { customer_id: "cus_1" } };
    expect(map("payment.succeeded", pay)).toMatchObject({ kind: "payment", accountId: ACCOUNT, providerRef: "sub_1", paymentRef: "pay_1", customerRef: "cus_1" });
    expect(map("payment.failed", pay)).toMatchObject({ kind: "payment_failed", paymentRef: "pay_1" });
  });
  it("refunds and lost disputes name only the payment; a partial refund is held for review", () => {
    const refund = { refund_id: "ref_1", payment_id: "pay_1", is_partial: false, metadata: {}, customer: { customer_id: "cus_1" } };
    expect(map("refund.succeeded", refund)).toMatchObject({ kind: "refund", accountId: null, providerRef: null, paymentRef: "pay_1", customerRef: "cus_1" });
    expect(map("refund.succeeded", { ...refund, is_partial: true })).toMatchObject({ kind: "partial_refund", paymentRef: "pay_1" });
    expect(map("refund.succeeded", { ...refund, payment_id: undefined })).toHaveProperty("ignored");
    expect(map("dispute.lost", { dispute_id: "dis_1", payment_id: "pay_1" })).toMatchObject({ kind: "revocation", accountId: null, paymentRef: "pay_1" });
  });
  it("events that change nothing are acknowledged, not applied", () => {
    for (const t of ["payment.processing", "payment.cancelled", "refund.failed", "dispute.opened", "license_key.created", ""]) expect(map(t)).toHaveProperty("ignored");
    expect(map("subscription.active", sub({ product_id: "pdt_someone_else" }))).toHaveProperty("ignored");
  });
  it("an account id that isn't a uuid is never trusted", () => {
    expect(map("subscription.active", sub({ metadata: { [ACCOUNT_METADATA_KEY]: "me; drop table" } }))).toMatchObject({ accountId: null });
    expect(map("subscription.active", sub({ metadata: null }))).toMatchObject({ accountId: null });
  });
});

describe("the dodo-webhook function", () => {
  let env: Record<string, string>;
  let rpcCalls: Record<string, unknown>[];
  const seen = new Set<string>();
  const fakeFetch = (async (_url: string, init: { body: string }) => {
    const args = JSON.parse(init.body) as Record<string, unknown>;
    rpcCalls.push(args);
    const k = `${args.p_provider}/${args.p_event_id}`;
    const outcome = seen.has(k) ? "duplicate" : "applied";
    seen.add(k);
    return new Response(JSON.stringify(outcome), { status: 200 });
  }) as unknown as typeof fetch;
  const handler = () => makeDodoWebhook({ env: (k) => env[k], fetch: fakeFetch });
  beforeEach(() => {
    env = { DODO_PAYMENTS_WEBHOOK_KEY: SECRET, DODO_BASIC_PRODUCT_ID: PRODUCTS.basic, DODO_AI_PRODUCT_ID: PRODUCTS.ai, SUPABASE_URL: "https://db.local", SUPABASE_SERVICE_ROLE_KEY: "service" };
    rpcCalls = []; seen.clear();
  });

  it("not configured yet: refuses everything, writes nothing", async () => {
    delete env.DODO_PAYMENTS_WEBHOOK_KEY;
    const r = await handler()(delivery(JSON.stringify(envelope("subscription.active"))));
    expect(r.status).toBe(503);
    expect(rpcCalls).toEqual([]);
  });
  it("a signed purchase is applied once; Dodo's retry of the same delivery is a duplicate", async () => {
    const body = JSON.stringify(envelope("subscription.active"));
    const first = await handler()(delivery(body, { id: "msg_A" }));
    expect(await first.json()).toEqual({ ok: true, outcome: "applied" });
    expect(rpcCalls[0]).toMatchObject({ p_provider: "dodo", p_event_id: "msg_A", p_user: ACCOUNT, p_kind: "purchase", p_plan: "ai", p_provider_ref: "sub_1",
      p_customer_ref: "cus_1", p_event_at: "2026-11-03T10:00:00Z", p_renews: true });
    const again = await handler()(delivery(body, { id: "msg_A" }));
    expect(await again.json()).toEqual({ ok: true, outcome: "duplicate" });
  });
  it("an unsigned or forged delivery is refused (401) and writes nothing", async () => {
    const body = JSON.stringify(envelope("subscription.active"));
    expect((await handler()(delivery(body, { sig: "v1,AAAA" }))).status).toBe(401);
    expect((await handler()(new Request("https://fn.local", { method: "POST", body }))).status).toBe(401);
    expect(rpcCalls).toEqual([]);
  });
  it("a payment is recorded (to map refunds later) and a refund goes to the database by its payment id", async () => {
    await handler()(delivery(JSON.stringify(envelope("payment.succeeded", { payment_id: "pay_1", subscription_id: "sub_1", metadata: { [ACCOUNT_METADATA_KEY]: ACCOUNT } }))));
    await handler()(delivery(JSON.stringify(envelope("refund.succeeded", { refund_id: "ref_1", payment_id: "pay_1", is_partial: false, metadata: {} }))));
    expect(rpcCalls[0]).toMatchObject({ p_kind: "payment", p_user: ACCOUNT, p_provider_ref: "sub_1", p_payment_ref: "pay_1" });
    expect(rpcCalls[1]).toMatchObject({ p_kind: "refund", p_user: null, p_provider_ref: null, p_payment_ref: "pay_1" });
  });
  it("an event that changes nothing is acknowledged (200) without a database call", async () => {
    const r = await handler()(delivery(JSON.stringify(envelope("payment.processing", { payment_id: "pay_1" }))));
    expect(await r.json()).toEqual({ ok: true, outcome: "ignored" });
    expect(rpcCalls).toEqual([]);
  });
  it("a signature made with another secret, or a replay older than five minutes, is refused", async () => {
    const body = JSON.stringify(envelope("subscription.active"));
    const ts = now(), other = randomBytes(32);
    expect((await handler()(delivery(body, { id: "m1", ts, sig: sign("m1", ts, body, other) }))).status).toBe(401);
    const old = now() - 600;
    expect((await handler()(delivery(body, { id: "m2", ts: old }))).status).toBe(401);
    expect(rpcCalls).toEqual([]);
  });
  it("the same product id for both plans is a configuration mistake: refuses everything", async () => {
    env.DODO_AI_PRODUCT_ID = PRODUCTS.basic;
    expect((await handler()(delivery(JSON.stringify(envelope("subscription.active"))))).status).toBe(503);
  });
  it("the database being down is a 500, so Dodo retries", async () => {
    const down = makeDodoWebhook({ env: (k) => env[k], fetch: (async () => new Response("", { status: 503 })) as unknown as typeof fetch });
    expect((await down(delivery(JSON.stringify(envelope("subscription.renewed"))))).status).toBe(500);
  });
});

describe("the dodo-checkout function", () => {
  let env: Record<string, string>;
  let state = "trial";
  let entitlement: Record<string, unknown> | null = null;
  let calls: { url: string; body: Record<string, unknown> | null; auth?: string }[] = [];
  let dodoFails = false;
  const fakeFetch = (async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, auth: init?.headers?.Authorization });
    if (url.endsWith("/auth/v1/user")) return init?.headers?.Authorization === "Bearer good" ? new Response(JSON.stringify({ id: ACCOUNT, email: "a@x" })) : new Response("", { status: 401 });
    if (url.endsWith("/rpc/access_for")) return new Response(JSON.stringify({ state }));
    if (url.includes("/rest/v1/entitlements")) return new Response(JSON.stringify(entitlement ? [entitlement] : []));
    if (dodoFails && url.startsWith("https://test.dodopayments.com")) return new Response(JSON.stringify({ message: "bad" }), { status: 422 });
    if (url === "https://test.dodopayments.com/checkouts") return new Response(JSON.stringify({ session_id: "cks_1", checkout_url: "https://test.checkout.dodopayments.com/session/cks_1" }));
    if (url === "https://test.dodopayments.com/subscriptions/sub_B/change-plan") return new Response("{}");
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const post = (body: unknown, token = "good") => makeDodoCheckout({ env: (k) => env[k], fetch: fakeFetch })(new Request("https://fn.local/dodo-checkout", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
  const toDodo = () => calls.filter((c) => c.url.includes("dodopayments.com"));
  beforeEach(() => {
    env = { DODO_PAYMENTS_API_KEY: "test_key", DODO_PAYMENTS_ENVIRONMENT: "test_mode", DODO_PAYMENTS_RETURN_URL: "app.detoxcompanion://checkout-return",
      DODO_BASIC_PRODUCT_ID: PRODUCTS.basic, DODO_AI_PRODUCT_ID: PRODUCTS.ai, SUPABASE_URL: "https://db.local", SUPABASE_SERVICE_ROLE_KEY: "service" };
    state = "trial"; entitlement = null; calls = []; dodoFails = false;
  });

  it("not configured: 503 and nothing is sent to Dodo", async () => {
    for (const k of ["DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_ENVIRONMENT", "DODO_PAYMENTS_RETURN_URL", "DODO_BASIC_PRODUCT_ID", "DODO_AI_PRODUCT_ID"]) {
      const saved = env[k]; delete env[k];
      expect((await post({ plan: "ai" })).status).toBe(503);
      env[k] = saved;
    }
    expect(toDodo()).toEqual([]);
  });
  it("test mode only, unless live mode is switched on deliberately; no other host is ever called with the key", async () => {
    expect(dodoApiBase("test_mode", undefined)).toBe("https://test.dodopayments.com");
    expect(dodoApiBase("live_mode", undefined)).toBeNull();
    expect(dodoApiBase("live_mode", "true")).toBe("https://live.dodopayments.com");
    expect(dodoApiBase("https://evil.example.com", "true")).toBeNull();
    env.DODO_PAYMENTS_ENVIRONMENT = "live_mode";
    expect((await post({ plan: "ai" })).status).toBe(503);
    expect(toDodo()).toEqual([]);
  });
  it("the return address must be https or the app's own checkout link", () => {
    expect(validReturnUrl("app.detoxcompanion://checkout-return")).toBe(true);
    expect(validReturnUrl("https://pawse.example/paid")).toBe(true);
    for (const bad of ["http://pawse.example", "javascript:alert(1)", "app.detoxcompanion://auth-callback", "", undefined]) expect(validReturnUrl(bad)).toBe(false);
    expect(cancelUrlFor("app.detoxcompanion://checkout-return")).toBe("app.detoxcompanion://checkout-return?pawse_checkout=cancelled");
    expect(cancelUrlFor("https://x.example/r?a=1")).toBe("https://x.example/r?a=1&pawse_checkout=cancelled");
  });
  it("a signed-in trial account gets a hosted checkout for the allowlisted product, tagged with its own account id", async () => {
    const r = await post({ plan: "ai" });
    expect(await r.json()).toEqual({ ok: true, checkout_url: "https://test.checkout.dodopayments.com/session/cks_1" });
    const sent = toDodo()[0];
    expect(sent.url).toBe("https://test.dodopayments.com/checkouts");
    expect(sent.auth).toBe("Bearer test_key");
    expect(sent.body).toEqual(checkoutRequest("ai", ACCOUNT, "a@x", PRODUCTS, "app.detoxcompanion://checkout-return"));
    expect(sent.body).toMatchObject({ product_cart: [{ product_id: PRODUCTS.ai, quantity: 1 }], metadata: { [ACCOUNT_METADATA_KEY]: ACCOUNT, pawse_plan: "ai" },
      return_url: "app.detoxcompanion://checkout-return", cancel_url: "app.detoxcompanion://checkout-return?pawse_checkout=cancelled" });
    await post({ plan: "basic" });
    expect(toDodo()[1].body).toMatchObject({ product_cart: [{ product_id: PRODUCTS.basic, quantity: 1 }] });
  });
  it("never takes a product id, price or account id from the app", async () => {
    await post({ plan: "basic", product_id: "pdt_free", price: 0, amount: 0, account: "bbbbbbbb-0000-4000-8000-00000000000b", product_cart: [{ product_id: "pdt_free", quantity: 1 }] });
    expect(toDodo()[0].body).toEqual(checkoutRequest("basic", ACCOUNT, "a@x", PRODUCTS, "app.detoxcompanion://checkout-return"));
  });
  it("not signed in, or a forged token: 401, nothing sent to Dodo", async () => {
    expect((await post({ plan: "ai" }, "forged")).status).toBe(401);
    expect((await post({ plan: "ai" }, "")).status).toBe(401);
    expect(toDodo()).toEqual([]);
  });
  it("never sells a plan already held, or Basic on top of AI", async () => {
    state = "ai";
    expect((await post({ plan: "basic" })).status).toBe(409);
    expect((await post({ plan: "ai" })).status).toBe(409);
    state = "basic";
    expect((await post({ plan: "basic" })).status).toBe(409);
    expect(toDodo()).toEqual([]);
  });
  it("Basic → AI changes the existing Dodo subscription, only after the person confirmed it", async () => {
    state = "basic"; entitlement = { provider: "dodo", provider_ref: "sub_B", status: "active", plan: "basic" };
    const unconfirmed = await post({ plan: "ai" });
    expect(unconfirmed.status).toBe(409);
    expect(await unconfirmed.json()).toEqual({ ok: false, error: "confirm_upgrade" });
    expect(toDodo()).toEqual([]);
    const r = await post({ plan: "ai", upgrade: true });
    expect(await r.json()).toEqual({ ok: true, upgrade_requested: true });
    expect(toDodo()).toHaveLength(1);
    expect(toDodo()[0]).toMatchObject({ url: "https://test.dodopayments.com/subscriptions/sub_B/change-plan", body: upgradeRequest(PRODUCTS, ACCOUNT) });
    expect(toDodo()[0].body).toMatchObject({ product_id: PRODUCTS.ai, proration_billing_mode: "prorated_immediately", on_payment_failure: "prevent_change" });
  });
  it("Basic from a manual grant goes up through a new AI checkout", async () => {
    state = "basic"; entitlement = { provider: "manual", provider_ref: null, status: "active", plan: "basic" };
    expect(await (await post({ plan: "ai" })).json()).toMatchObject({ ok: true, checkout_url: expect.stringContaining("https://") });
  });
  it("Dodo refusing is a 502 the app shows as an error; nothing is granted", async () => {
    dodoFails = true;
    expect(await (await post({ plan: "ai" })).json()).toEqual({ ok: false, error: "provider" });
    state = "basic"; entitlement = { provider: "dodo", provider_ref: "sub_B", status: "active", plan: "basic" };
    expect((await post({ plan: "ai", upgrade: true })).status).toBe(502);
    expect(calls.some((c) => c.url.includes("apply_payment_event"))).toBe(false);
  });
  it("an unknown plan is a bad request", async () => {
    expect((await post({ plan: "lifetime" })).status).toBe(400);
  });
});
