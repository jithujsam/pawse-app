import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerAccess } from "@detox/schema";

/**
 * The app's side of buying (src/billing.ts): starting a checkout through the dodo-checkout function, and coming back.
 * Coming back never grants anything: the app only asks the server again, and says what the server says.
 */

const fx = vi.hoisted(() => ({
  invoke: null as null | ((name: string, opts: { body: unknown }) => Promise<{ data: unknown; error: unknown }>),
  opened: [] as string[],
  gate: { kind: "open", access: { state: "trial", valid_until: null }, stale: false, until: null } as Record<string, unknown>,
}));
// The phone's own storage, where a checkout in progress is remembered.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); },
});
vi.mock("../src/supabase", () => ({ configured: true, supabase: { functions: { invoke: (n: string, o: { body: unknown }) => fx.invoke!(n, o) } } }));
vi.mock("../src/native", () => ({ openExternal: (u: string) => { fx.opened.push(u); }, closeBrowser: () => undefined, onBrowserClosed: () => undefined }));
vi.mock("../src/access", () => ({ getGate: () => fx.gate, refreshAccess: async () => undefined }));

const billing = await import("../src/billing");
const { confirmAfterCheckout, readReturn, paidKey, markPending, peekPending, clearPending, dodoCheckout, resetConfirm, PENDING_MS } = billing;

const access = (state: ServerAccess["state"], until: string | null = null): ServerAccess => ({
  state, app: state === "trial" || state === "basic" || state === "ai", ai: state === "ai" || state === "trial", email_verified: true,
  tracks: state === "trial" ? 1 : 50, valid_until: until, trial_ends_at: null, plan: state === "basic" || state === "ai" ? state : null,
  plan_status: state === "basic" || state === "ai" ? "active" : null, period_end: until, server_time: "2026-11-04T00:00:00Z",
});
const open = (a: ServerAccess) => ({ kind: "open" as const, access: a, stale: false, until: a.valid_until ? Date.parse(a.valid_until) : null });
const locked = (a: ServerAccess) => ({ kind: "locked" as const, reason: "expired" as const, access: a });

/** A server whose answer changes after `afterRefreshes` checks (a webhook that arrives late), or never. */
function harness(start: ReturnType<typeof open> | ReturnType<typeof locked>, after: ReturnType<typeof open> | null, afterRefreshes: number) {
  let gate: ReturnType<typeof open> | ReturnType<typeof locked> = start;
  let refreshes = 0;
  const said: { text: string; kind?: string }[] = [];
  const waits: number[] = [];
  return {
    said, waits, refreshes: () => refreshes,
    deps: {
      refresh: async () => { refreshes++; if (after && refreshes >= afterRefreshes) gate = after; },
      gate: () => gate,
      wait: async (ms: number) => { waits.push(ms); },
      say: (text: string, kind?: "good" | "bad") => { said.push({ text, kind }); },
      text: (id: string, plan?: string) => (plan ? `${id}:${plan}` : id),
    },
  };
}

beforeEach(() => { resetConfirm(); clearPending(); fx.opened = []; fx.invoke = null; });

describe("the return link is only a hint", () => {
  it("reads Dodo's status, and our own cancel marker", () => {
    const base = "app.detoxcompanion://checkout-return";
    expect(readReturn(`${base}?subscription_id=sub_1&status=active`)).toBe("claimed");
    expect(readReturn(`${base}?payment_id=pay_1&status=succeeded`)).toBe("claimed");
    expect(readReturn(`${base}?payment_id=pay_1&status=failed`)).toBe("failed");
    expect(readReturn(`${base}?payment_id=pay_1&status=processing`)).toBe("pending");
    expect(readReturn(`${base}?status=requires_customer_action`)).toBe("pending");
    expect(readReturn(`${base}?pawse_checkout=cancelled`)).toBe("cancelled");
    expect(readReturn(`${base}?status=cancelled`)).toBe("cancelled");
    expect(readReturn(base)).toBe("unknown");
  });
});

describe("after a checkout, the app believes only the server", () => {
  it("successful payment: the plan shows up on a check, and it says so", async () => {
    const h = harness(open(access("trial", "2026-11-08T00:00:00Z")), open(access("ai", "2027-11-04T00:00:00Z")), 1);
    expect(await confirmAfterCheckout("claimed", null, h.deps)).toBe("confirmed");
    expect(h.said.at(-1)).toEqual({ text: "confirmed:ai", kind: "good" });
  });

  it("the webhook is late: keeps asking, backing off, and confirms when the server has it", async () => {
    const h = harness(open(access("trial", "2026-11-08T00:00:00Z")), open(access("basic", "2027-11-04T00:00:00Z")), 5);
    expect(await confirmAfterCheckout("claimed", null, h.deps)).toBe("confirmed");
    expect(h.refreshes()).toBe(5);
    expect(h.waits.slice(0, 4)).toEqual([2000, 2000, 3000, 3000]);
    expect(h.said.map((s) => s.text)).toEqual(["checking", "confirmed:basic"]);
  });

  it("the success link opened without paying: nothing unlocks, and it says the payment isn't confirmed", async () => {
    const start = locked(access("expired"));
    const h = harness(start, null, 0);
    expect(await confirmAfterCheckout("claimed", null, h.deps)).toBe("not_yet");
    expect(h.deps.gate()).toBe(start);
    expect(h.said.at(-1)).toEqual({ text: "pending", kind: undefined });
    expect(h.refreshes()).toBe(billing.CONFIRM_SCHEDULE_MS.length);
  });

  it("cancelled checkout: says nothing was charged after one check", async () => {
    const h = harness(open(access("trial", "2026-11-08T00:00:00Z")), null, 0);
    expect(await confirmAfterCheckout("cancelled", null, h.deps)).toBe("not_yet");
    expect(h.refreshes()).toBe(1);
    expect(h.said).toEqual([{ text: "cancelled", kind: undefined }]);
  });

  it("failed payment: says it didn't go through; membership unchanged", async () => {
    const h = harness(open(access("trial", "2026-11-08T00:00:00Z")), null, 0);
    expect(await confirmAfterCheckout("failed", null, h.deps)).toBe("not_yet");
    expect(h.said).toEqual([{ text: "failed", kind: "bad" }]);
  });

  it("a plan already held doesn't count as new: only a new plan or a later end date confirms", async () => {
    const basic = open(access("basic", "2027-01-01T00:00:00Z"));
    const h = harness(basic, null, 0);
    expect(await confirmAfterCheckout("claimed", paidKey(basic), h.deps)).toBe("not_yet");
    const h2 = harness(basic, open(access("ai", "2027-01-01T00:00:00Z")), 2);
    expect(await confirmAfterCheckout("pending", paidKey(basic), h2.deps)).toBe("confirmed");
  });

  it("the browser closing and the return link arriving together run one check, with the link's words", async () => {
    const h = harness(open(access("trial", "2026-11-08T00:00:00Z")), null, 0);
    const a = confirmAfterCheckout("unknown", null, h.deps);
    const b = confirmAfterCheckout("cancelled", null, h.deps);
    expect(a).toBe(b);
    await a;
    expect(h.said.at(-1)?.text).toBe("cancelled");
    expect(h.refreshes()).toBeLessThanOrEqual(2);
  });
});

describe("a checkout begun on this phone is picked up after a restart", () => {
  it("is remembered for two hours, with the plan held when it began", () => {
    const t0 = Date.parse("2026-11-04T10:00:00Z");
    markPending("ai", "basic:2027-01-01", t0);
    expect(peekPending(t0 + 60_000)).toEqual({ plan: "ai", at: t0, before: "basic:2027-01-01" });
    expect(peekPending(t0 + PENDING_MS + 1)).toBeNull();
    expect(peekPending(t0 - 1)).toBeNull(); // a clock moved back can't keep it forever
    clearPending();
    expect(peekPending(t0)).toBeNull();
  });
});

describe("starting a checkout", () => {
  it("sends only the plan's name, opens Dodo's page and remembers the checkout", async () => {
    let sent: unknown = null;
    fx.invoke = async (name, opts) => { sent = { name, body: opts.body }; return { data: { ok: true, checkout_url: "https://test.checkout.dodopayments.com/s/1" }, error: null }; };
    expect(await dodoCheckout.startCheckout("basic")).toEqual({ kind: "opened" });
    expect(sent).toEqual({ name: "dodo-checkout", body: { plan: "basic" } });
    expect(fx.opened).toEqual(["https://test.checkout.dodopayments.com/s/1"]);
    expect(peekPending()?.plan).toBe("basic");
  });

  it("an upgrade waits for the person's confirmation, then goes through without a new page", async () => {
    const bodies: unknown[] = [];
    fx.invoke = async (_n, opts) => {
      bodies.push(opts.body);
      if (!(opts.body as { upgrade?: boolean }).upgrade) {
        return { data: null, error: { context: new Response(JSON.stringify({ ok: false, error: "confirm_upgrade" }), { status: 409 }) } };
      }
      return { data: { ok: true, upgrade_requested: true }, error: null };
    };
    expect(await dodoCheckout.startCheckout("ai")).toEqual({ kind: "confirm_upgrade" });
    expect(await dodoCheckout.startCheckout("ai", { upgrade: true })).toEqual({ kind: "upgrade_requested" });
    expect(bodies).toEqual([{ plan: "ai" }, { plan: "ai", upgrade: true }]);
    expect(fx.opened).toEqual([]);
  });

  it("already active, provider down, not configured or a non-https page: nothing opens", async () => {
    fx.invoke = async () => ({ data: null, error: { context: new Response(JSON.stringify({ ok: false, error: "already_active" }), { status: 409 }) } });
    expect(await dodoCheckout.startCheckout("ai")).toEqual({ kind: "already_active" });
    for (const answer of [
      { data: null, error: { context: new Response(JSON.stringify({ ok: false, error: "provider" }), { status: 502 }) } },
      { data: null, error: { context: new Response(JSON.stringify({ ok: false, error: "not_enabled" }), { status: 503 }) } },
      { data: { ok: true, checkout_url: "http://evil.example" }, error: null },
      { data: null, error: new Error("offline") },
    ]) {
      fx.invoke = async () => answer;
      await expect(dodoCheckout.startCheckout("basic")).rejects.toThrow();
    }
    expect(fx.opened).toEqual([]);
    expect(peekPending()).toBeNull();
  });
});
