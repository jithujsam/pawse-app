import { describe, expect, it, vi } from "vitest";
import type { PetRequest, SlipRequest } from "@detox/schema";

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
      invoke: async (_: string, { body }: { body: SlipRequest | PetRequest }) => {
        calls++;
        if (reply) return reply();
        if (body.kind === "pet") return { data: { ok: true, result: petAnswer(body.companionName) }, error: null };
        return { data: { ok: true, result: { ai_adjust_pct: 0, body_effects: [], explanation: `${body.companionName} felt that.` } }, error: null };
      },
    },
  },
}));

const petAnswer = (name: string) => ({
  waiting: `${name} is waiting, dramatically.`, goal_met: "Goal met. Delicious.", after_slip: "That stung. Tonight is ours.",
  away: "Days of silence. I nearly printed posters.", morning: "Slept like royalty.", risk: "Slip o'clock. Change the ending.", thanks: "Look at us, thriving.",
});
const { aiCacheKey, aiForSlip, aiPetLines, latestPetLines, AI_RETENTION_MS } = await import("../src/ai");
const { AI_CACHE_KEY } = await import("../src/store");

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
});

describe("the AI's percentage is ignored", () => {
  it("a slip answer carries a sentence and tags, never a months figure", async () => {
    reply = () => ({ data: { ok: true, result: { ai_adjust_pct: 30, body_effects: ["cough"], explanation: "Biscuit coughed." } }, error: null });
    const a = await aiForSlip({ ...req, amount: 778 });
    expect(a).toEqual({ effects: ["cough"], explanation: "Biscuit coughed." });
    expect(a).not.toHaveProperty("months");
    expect(a).not.toHaveProperty("adjustPct");
    reply = null;
  });
});

describe("AI retention and sign-in", () => {
  const DAY = 24 * 3600_000;
  const seed = (entries: Record<string, unknown>) => mem.set(AI_CACHE_KEY, JSON.stringify(entries));
  const fresh = (n: number): SlipRequest => ({ ...req, amount: 2000 + n });

  it("keeps an answer for seven days, and no longer", () => {
    expect(AI_RETENTION_MS).toBe(7 * DAY);
  });

  it("serves a cached answer that is under seven days old, without asking the AI again", async () => {
    const r = fresh(1);
    seed({ [aiCacheKey(r)]: { at: Date.now() - 2 * DAY, raw: { ai_adjust_pct: 0, body_effects: [], explanation: "Biscuit, from the cache." } } });
    const before = calls;
    expect((await aiForSlip(r))?.explanation).toBe("Biscuit, from the cache.");
    expect(calls).toBe(before);
  });

  it("does not serve an answer older than seven days; it asks again", async () => {
    const r = fresh(2);
    seed({ [aiCacheKey(r)]: { at: Date.now() - 8 * DAY, raw: { ai_adjust_pct: 0, body_effects: [], explanation: "Stale." } } });
    const before = calls;
    expect((await aiForSlip(r))?.explanation).toBe("Biscuit felt that.");
    expect(calls).toBe(before + 1);
    expect(JSON.parse(mem.get(AI_CACHE_KEY)!)[aiCacheKey(r)].raw.explanation).toBe("Biscuit felt that.");
  });

  it("discards entries saved in the old, untimed format", async () => {
    const r = fresh(3);
    seed({ [aiCacheKey(r)]: { ai_adjust_pct: 0, body_effects: [], explanation: "Untimed." } });
    expect((await aiForSlip(r))?.explanation).toBe("Biscuit felt that.");
  });

  it("signed out: nothing is sent and no cached answer is shown", async () => {
    const r = fresh(4);
    seed({ [aiCacheKey(r)]: { at: Date.now(), raw: { ai_adjust_pct: 0, body_effects: [], explanation: "Cached." } } });
    signedIn = false;
    const before = calls;
    expect(await aiForSlip(r)).toBeNull();
    expect(calls).toBe(before);
    signedIn = true;
  });
});

describe("the pet's own lines (PRD §24)", () => {
  const pet: PetRequest = {
    kind: "pet", tone: "brutal", personality: "savage", species: "dog", companionName: "Biscuit", habitClass: "food_spending",
    day: "2026-11-03", streak: 4, quietDays: 0, last7Slips: 2, stage: "adult",
  };

  it("asks once per pet and day, then serves the cached lines", async () => {
    const n = calls;
    const a = await aiPetLines("c1", pet);
    expect(a?.waiting).toBe("Biscuit is waiting, dramatically.");
    expect(a?.goalMet).toBe("Goal met. Delicious.");
    expect(await aiPetLines("c1", pet)).toEqual(a);
    expect(calls).toBe(n + 1);
    await aiPetLines("c1", { ...pet, day: "2026-11-04" });
    expect(calls).toBe(n + 2); // a new day is a new set
  });

  it("notifications get the newest lines only in the pet's current personality and Voice, and only while signed in", async () => {
    await aiPetLines("c2", { ...pet, companionName: "Mochi" });
    expect((await latestPetLines("c2", "savage", "brutal"))?.waiting).toBe("Mochi is waiting, dramatically.");
    expect(await latestPetLines("c2", "calm", "brutal")).toBeNull();
    expect(await latestPetLines("c2", "savage", "gentle")).toBeNull();
    expect(await latestPetLines("other", "savage", "brutal")).toBeNull();
    signedIn = false;
    expect(await latestPetLines("c2", "savage", "brutal")).toBeNull();
    signedIn = true;
  });

  it.each([
    ["an error", () => ({ data: null, error: new Error("offline") })],
    ["an unsafe line", () => ({ data: { ok: true, result: { ...petAnswer("Biscuit"), away: "I was so lonely without you." } }, error: null })],
    ["a missing line", () => ({ data: { ok: true, result: { waiting: "Hi." } }, error: null })],
  ])("%s → no lines, and the hand-written ones stand", async (_n, answer) => {
    reply = answer;
    expect(await aiPetLines("c3", { ...pet, streak: calls })).toBeNull();
    reply = null;
  });

  it("signed out: nothing is sent", async () => {
    signedIn = false;
    const n = calls;
    expect(await aiPetLines("c4", { ...pet, streak: 999 })).toBeNull();
    expect(calls).toBe(n);
    signedIn = true;
  });
});
