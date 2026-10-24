import { describe, expect, it, vi } from "vitest";
import type { SlipRequest } from "@detox/schema";

// A cached AI sentence can quote the request (pet name, notes, amounts), so it is reused only for the exact same request (audit B2).
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });

let calls = 0;
let signedIn = true;
/** Overrides what the AI function answers; null means the normal, valid answer. */
let reply: null | (() => { data: unknown; error: unknown }) = null;
vi.mock("../src/supabase", () => ({
  configured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: signedIn ? { user: { id: "u1" } } : null } }) },
    functions: {
      invoke: async (_: string, { body }: { body: SlipRequest }) => {
        calls++;
        if (reply) return reply();
        return { data: { ok: true, result: { ai_adjust_pct: 0, body_effects: [], explanation: `${body.companionName} felt that.` } }, error: null };
      },
    },
  },
}));

const { aiCacheKey, aiForSlip, aiWeekly } = await import("../src/ai");

const req: SlipRequest = {
  kind: "slip", tone: "honest", habitClass: "food_spending", companionName: "Biscuit", amount: 400, unit: "money", median: 200,
  triggers: ["Stressed"], texts: ["What: Delivery order"], nthToday: 1, baselineMonths: 4, last7Slips: 2,
};

describe("AI cache", () => {
  it("keys on everything that shapes the sentence", () => {
    expect(aiCacheKey({ ...req, companionName: "Mochi" })).not.toBe(aiCacheKey(req));
    expect(aiCacheKey({ ...req, texts: ["What: Snacks"] })).not.toBe(aiCacheKey(req));
    expect(aiCacheKey({ ...req, amount: 410 })).not.toBe(aiCacheKey(req));
    expect(aiCacheKey({ ...req })).toBe(aiCacheKey(req));
  });

  it("never answers one pet's slip with another pet's sentence", async () => {
    const a = await aiForSlip(req);
    const again = await aiForSlip(req);
    const b = await aiForSlip({ ...req, companionName: "Mochi" });
    expect(a?.explanation).toBe("Biscuit felt that.");
    expect(again?.explanation).toBe("Biscuit felt that.");
    expect(b?.explanation).toBe("Mochi felt that.");
    expect(calls).toBe(2);
  });
});

describe("server AI cache key (supabase/functions/ai/cache.ts)", async () => {
  const { cacheKey } = await import("../../../supabase/functions/ai/cache.ts");
  it("is per person: two people sending the very same request never share a cached sentence", async () => {
    const a = await cacheKey("user-a", req), b = await cacheKey("user-b", req);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // fits ai_cache.key's length check
    expect(await cacheKey("user-a", { ...req })).toBe(a);
  });
  it("changes with anything in the request: pet name, notes, amounts, tone", async () => {
    const base = await cacheKey("u", req);
    for (const r of [{ ...req, companionName: "Mochi" }, { ...req, texts: [] }, { ...req, amount: 401 }, { ...req, tone: "gentle" as const }]) {
      expect(await cacheKey("u", r)).not.toBe(base);
    }
  });
});

describe("when the AI fails or answers badly, the baseline stands", () => {
  const fresh = (n: number): SlipRequest => ({ ...req, amount: 1000 + n });
  const bad = (result: unknown) => () => ({ data: { ok: true, result }, error: null });
  it.each([
    ["network or function error", () => ({ data: null, error: new Error("offline") })],
    ["daily limit reached", () => ({ data: { ok: false, error: "limit" }, error: null })],
    ["adjustment out of range", bad({ ai_adjust_pct: 80, body_effects: [], explanation: "Biscuit felt that." })],
    ["medical claim", bad({ ai_adjust_pct: 5, body_effects: [], explanation: "This causes liver failure." })],
    ["tag outside the vocabulary", bad({ ai_adjust_pct: 5, body_effects: ["tumour"], explanation: "Biscuit felt that." })],
    ["extra field", bad({ ai_adjust_pct: 5, body_effects: [], explanation: "Biscuit felt that.", months: 99 })],
    ["not JSON at all", bad("Sure! Here's your answer")],
  ])("%s → no result, nothing cached", async (_name, answer) => {
    reply = answer;
    const n = calls;
    expect(await aiForSlip(fresh(calls))).toBeNull();
    reply = null;
    expect(await aiForSlip(fresh(n))).not.toBeNull(); // asked again: the failure wasn't cached
    expect(calls).toBe(n + 2);
  });

  it("signed out: no call at all", async () => {
    signedIn = false;
    const n = calls;
    expect(await aiForSlip(fresh(999))).toBeNull();
    expect(calls).toBe(n);
    signedIn = true;
  });

  it("weekly summary must be safe and cite a number", async () => {
    const week = { kind: "weekly" as const, tone: "honest" as const, habitClass: "food_spending", companionName: "Biscuit", unit: "money" as const,
      thisWeek: { slips: 3, spend: 900, months: 9 }, lastWeek: { slips: 5, spend: 1500, months: 15 }, worstWeekday: "Friday", age: 12, currency: "₹" };
    reply = bad({ summary: "A quieter week than the last one, mostly on Fridays." });
    expect(await aiWeekly(week)).toBeNull();
    reply = bad({ summary: "3 slips this week, down from 5. Fridays were the hardest." });
    expect(await aiWeekly(week)).toBe("3 slips this week, down from 5. Fridays were the hardest.");
    reply = null;
  });
});
