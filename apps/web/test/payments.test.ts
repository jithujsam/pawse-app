import { describe, expect, it } from "vitest";
import { noProvider, problemWith, processPaymentWebhook, type PaymentVerifier, type Rpc, type VerifiedPaymentEvent } from "../../../supabase/functions/_shared/payments.ts";

/**
 * The payment webhook contract (supabase/functions/_shared/payments.ts). No provider is connected; a test verifier
 * stands in for one. The database side (apply_payment_event: idempotency, plan transitions, stale and duplicate
 * events) is tested in supabase/tests/membership.sql; here, what reaches it and what the provider is told.
 */

const ACCOUNT = "aaaaaaaa-0000-4000-8000-00000000000a";
const year = { periodStart: "2026-11-03T00:00:00Z", periodEnd: "2027-11-03T00:00:00Z" };
const purchase: VerifiedPaymentEvent = { provider: "test", eventId: "evt-1", accountId: ACCOUNT, kind: "purchase", plan: "ai", ...year, providerRef: "sub-1" };

/** A verifier that trusts only requests carrying the right signature header, like a real one checks an HMAC. */
const verifier = (event: VerifiedPaymentEvent | null): PaymentVerifier => ({
  provider: "test",
  verify: async (req) => (req.headers.get("x-signature") === "good" ? event : null),
});

/** Records the calls and mimics apply_payment_event's idempotency by (provider, event id). */
function db(fail = false) {
  const seen = new Set<string>();
  const calls: Record<string, unknown>[] = [];
  const rpc: Rpc = async (_fn, args) => {
    calls.push(args);
    if (fail) return { data: null, error: { message: "db down" } };
    const k = `${args.p_provider}/${args.p_event_id}`;
    if (seen.has(k)) return { data: "duplicate", error: null };
    seen.add(k);
    return { data: "applied", error: null };
  };
  return { rpc, calls };
}
const post = (sig = "good") => new Request("https://fn.local/payments", { method: "POST", headers: { "x-signature": sig }, body: "{}" });

describe("payment webhooks", () => {
  it("a verified purchase is applied for the account it names", async () => {
    const d = db();
    const res = await processPaymentWebhook(post(), verifier(purchase), d.rpc);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: "applied" });
    expect(d.calls[0]).toEqual({ p_provider: "test", p_event_id: "evt-1", p_user: ACCOUNT, p_kind: "purchase", p_plan: "ai", p_period_start: year.periodStart, p_period_end: year.periodEnd, p_provider_ref: "sub-1", p_payment_ref: null, p_customer_ref: null, p_event_at: null, p_renews: null });
  });

  it("the same event delivered again is answered OK and changes nothing", async () => {
    const d = db();
    await processPaymentWebhook(post(), verifier(purchase), d.rpc);
    const again = await processPaymentWebhook(post(), verifier(purchase), d.rpc);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, outcome: "duplicate" });
  });

  it("a request without a valid signature records nothing: 401", async () => {
    const d = db();
    const res = await processPaymentWebhook(post("forged"), verifier(purchase), d.rpc);
    expect(res.status).toBe(401);
    expect(d.calls).toEqual([]);
  });

  it("an event claiming to be from another provider is rejected", async () => {
    const d = db();
    expect((await processPaymentWebhook(post(), verifier({ ...purchase, provider: "other" }), d.rpc)).status).toBe(401);
    expect(d.calls).toEqual([]);
  });

  it("a verifier that throws counts as unverified", async () => {
    const d = db();
    const boom: PaymentVerifier = { provider: "test", verify: async () => { throw new Error("bad body"); } };
    expect((await processPaymentWebhook(post(), boom, d.rpc)).status).toBe(401);
  });

  it("with no provider connected, every webhook is rejected", async () => {
    const d = db();
    expect((await processPaymentWebhook(post(), noProvider, d.rpc)).status).toBe(401);
    expect(d.calls).toEqual([]);
  });

  it("a database failure is a 500, so the provider retries", async () => {
    expect((await processPaymentWebhook(post(), verifier(purchase), db(true).rpc)).status).toBe(500);
  });

  it("only POST", async () => {
    expect((await processPaymentWebhook(new Request("https://fn.local/payments"), verifier(purchase), db().rpc)).status).toBe(405);
  });

  it("malformed events are refused before they reach the database: 400", async () => {
    const bad: Partial<VerifiedPaymentEvent>[] = [
      { plan: null }, { plan: "lifetime" as never }, { periodEnd: null }, { periodEnd: year.periodStart },
      { periodEnd: "2029-01-01T00:00:00Z" }, { periodStart: "not a date" }, { accountId: "me" }, { kind: "gift" as never }, { eventId: "" },
    ];
    for (const b of bad) {
      const d = db();
      const res = await processPaymentWebhook(post(), verifier({ ...purchase, ...b }), d.rpc);
      expect(res.status, JSON.stringify(b)).toBe(400);
      expect(d.calls).toEqual([]);
    }
  });

  it("every lifecycle event has a valid shape: renewal, failure, expiry, refund, revocation", () => {
    expect(problemWith({ ...purchase, kind: "renewal", eventId: "e2" })).toBeNull();
    expect(problemWith({ ...purchase, kind: "purchase", plan: "basic" })).toBeNull();
    for (const kind of ["payment_failed", "expiry", "refund", "revocation"] as const) {
      expect(problemWith({ ...purchase, kind, plan: null, periodStart: null, periodEnd: kind === "expiry" ? year.periodEnd : null })).toBeNull();
    }
    // An event the provider couldn't tie to an account is still recorded (anonymously) by the database.
    expect(problemWith({ ...purchase, accountId: null })).toBeNull();
  });
});
