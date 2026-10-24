import { describe, expect, it, vi } from "vitest";
import type { SlipRequest } from "@detox/schema";

// A cached AI sentence can quote the request (pet name, notes, amounts), so it is reused only for the exact same request (audit B2).
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });

let calls = 0;
vi.mock("../src/supabase", () => ({
  configured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
    functions: { invoke: async (_: string, { body }: { body: SlipRequest }) => { calls++; return { data: { ok: true, result: { ai_adjust_pct: 0, body_effects: [], explanation: `${body.companionName} felt that.` } }, error: null }; } },
  },
}));

const { aiCacheKey, aiForSlip } = await import("../src/ai");

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
