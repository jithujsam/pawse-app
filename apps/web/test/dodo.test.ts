import { beforeEach, describe, expect, it } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { ACCOUNT_METADATA_KEY, checkoutRequest, mapDodoEvent, verifyStandardWebhook } from "../../../supabase/functions/_shared/dodo.ts";
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
  subscription_id: "sub_1", product_id: PRODUCTS.ai, status: "active", previous_billing_date: "2026-11-03T00:00:00Z", next_billing_date: "2027-11-03T00:00:00Z",
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
      periodStart: "2026-11-03T00:00:00Z", periodEnd: "2027-11-03T00:00:00Z", providerRef: "sub_1" });
    expect(map("subscription.active", sub({ product_id: PRODUCTS.basic }))).toMatchObject({ kind: "purchase", plan: "basic" });
  });
  it("renewal, upgrade, failed payment, expiry, refund, lost dispute", () => {
    expect(map("subscription.renewed")).toMatchObject({ kind: "renewal", plan: "ai" });
    expect(map("subscription.plan_changed")).toMatchObject({ kind: "purchase", plan: "ai" });
    for (const t of ["subscription.on_hold", "subscription.past_due", "subscription.failed"]) expect(map(t)).toMatchObject({ kind: "payment_failed" });
    expect(map("subscription.expired")).toMatchObject({ kind: "expiry", providerRef: "sub_1" });
    expect(map("refund.succeeded", { payment_id: "pay_1", metadata: { [ACCOUNT_METADATA_KEY]: ACCOUNT } })).toMatchObject({ kind: "refund", accountId: ACCOUNT, providerRef: null });
    expect(map("dispute.lost", { payment_id: "pay_1" })).toMatchObject({ kind: "revocation", accountId: null });
  });
  it("events that change nothing are acknowledged, not applied", () => {
    for (const t of ["subscription.cancelled", "payment.succeeded", "payment.failed", "license_key.created", ""]) expect(map(t)).toHaveProperty("ignored");
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
    env = { DODO_WEBHOOK_SECRET: SECRET, DODO_PRODUCT_BASIC: PRODUCTS.basic, DODO_PRODUCT_AI: PRODUCTS.ai, SUPABASE_URL: "https://db.local", SUPABASE_SERVICE_ROLE_KEY: "service" };
    rpcCalls = []; seen.clear();
  });

  it("not configured yet: refuses everything, writes nothing", async () => {
    delete env.DODO_WEBHOOK_SECRET;
    const r = await handler()(delivery(JSON.stringify(envelope("subscription.active"))));
    expect(r.status).toBe(503);
    expect(rpcCalls).toEqual([]);
  });
  it("a signed purchase is applied once; Dodo's retry of the same delivery is a duplicate", async () => {
    const body = JSON.stringify(envelope("subscription.active"));
    const first = await handler()(delivery(body, { id: "msg_A" }));
    expect(await first.json()).toEqual({ ok: true, outcome: "applied" });
    expect(rpcCalls[0]).toMatchObject({ p_provider: "dodo", p_event_id: "msg_A", p_user: ACCOUNT, p_kind: "purchase", p_plan: "ai", p_provider_ref: "sub_1" });
    const again = await handler()(delivery(body, { id: "msg_A" }));
    expect(await again.json()).toEqual({ ok: true, outcome: "duplicate" });
  });
  it("an unsigned or forged delivery is refused (401) and writes nothing", async () => {
    const body = JSON.stringify(envelope("subscription.active"));
    expect((await handler()(delivery(body, { sig: "v1,AAAA" }))).status).toBe(401);
    expect((await handler()(new Request("https://fn.local", { method: "POST", body }))).status).toBe(401);
    expect(rpcCalls).toEqual([]);
  });
  it("a payment receipt is acknowledged (200) without touching the plan", async () => {
    const r = await handler()(delivery(JSON.stringify(envelope("payment.succeeded", { payment_id: "pay_1" }))));
    expect(await r.json()).toEqual({ ok: true, outcome: "ignored" });
    expect(rpcCalls).toEqual([]);
  });
  it("the database being down is a 500, so Dodo retries", async () => {
    const down = makeDodoWebhook({ env: (k) => env[k], fetch: (async () => new Response("", { status: 503 })) as unknown as typeof fetch });
    expect((await down(delivery(JSON.stringify(envelope("subscription.renewed"))))).status).toBe(500);
  });
});

describe("the dodo-checkout function", () => {
  let env: Record<string, string>;
  let state = "trial";
  let sentToDodo: Record<string, unknown> | null = null;
  const fakeFetch = (async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    if (url.endsWith("/auth/v1/user")) return init?.headers?.Authorization === "Bearer good" ? new Response(JSON.stringify({ id: ACCOUNT, email: "a@x" })) : new Response("", { status: 401 });
    if (url.endsWith("/rpc/access_for")) return new Response(JSON.stringify({ state }));
    if (url === "https://test.dodopayments.com/checkouts") { sentToDodo = JSON.parse(init!.body!); return new Response(JSON.stringify({ session_id: "cks_1", checkout_url: "https://checkout.dodopayments.com/session/cks_1" })); }
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const post = (body: unknown, token = "good") => makeDodoCheckout({ env: (k) => env[k], fetch: fakeFetch })(new Request("https://fn.local/dodo-checkout", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
  beforeEach(() => {
    env = { DODO_CHECKOUT_ENABLED: "true", DODO_API_KEY: "test_key", DODO_API_BASE: "https://test.dodopayments.com", DODO_RETURN_URL: "app.detoxcompanion://checkout-return",
      DODO_PRODUCT_BASIC: PRODUCTS.basic, DODO_PRODUCT_AI: PRODUCTS.ai, SUPABASE_URL: "https://db.local", SUPABASE_SERVICE_ROLE_KEY: "service" };
    state = "trial"; sentToDodo = null;
  });

  it("switched off by default: nothing is sent to Dodo", async () => {
    delete env.DODO_CHECKOUT_ENABLED;
    expect((await post({ plan: "ai" })).status).toBe(503);
    expect(sentToDodo).toBeNull();
  });
  it("only Dodo's own hosts are ever called with the API key", async () => {
    env.DODO_API_BASE = "https://evil.example.com";
    expect((await post({ plan: "ai" })).status).toBe(503);
  });
  it("a signed-in trial account gets a checkout page for its plan, tagged with its account id", async () => {
    const r = await post({ plan: "ai" });
    expect(await r.json()).toEqual({ ok: true, checkout_url: "https://checkout.dodopayments.com/session/cks_1" });
    expect(sentToDodo).toEqual(checkoutRequest("ai", ACCOUNT, "a@x", PRODUCTS, "app.detoxcompanion://checkout-return"));
    expect(sentToDodo).toMatchObject({ product_cart: [{ product_id: PRODUCTS.ai, quantity: 1 }], metadata: { [ACCOUNT_METADATA_KEY]: ACCOUNT } });
  });
  it("not signed in: 401", async () => {
    expect((await post({ plan: "ai" }, "forged")).status).toBe(401);
  });
  it("never sells a plan already held, or Basic on top of AI; Basic can upgrade to AI", async () => {
    state = "ai";
    expect((await post({ plan: "basic" })).status).toBe(409);
    expect((await post({ plan: "ai" })).status).toBe(409);
    state = "basic";
    expect((await post({ plan: "basic" })).status).toBe(409);
    expect((await post({ plan: "ai" })).status).toBe(200);
  });
  it("an unknown plan is a bad request", async () => {
    expect((await post({ plan: "lifetime" })).status).toBe(400);
  });
});
