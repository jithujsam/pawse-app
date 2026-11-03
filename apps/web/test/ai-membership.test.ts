import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PetRequest, SlipRequest } from "@detox/schema";

/**
 * The app's AI requests and membership (src/ai.ts, src/access.ts): without AI in the membership (Basic, or access
 * that has ended) nothing new is asked for, while text already written stays: pet lines cached on this phone and
 * explanations saved on past slips. The AI function enforces the same on the server (ai-function.test.ts).
 */
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });

const state = vi.hoisted(() => ({ aiIncluded: true, calls: [] as string[] }));
vi.mock("../src/access", () => ({ can: (f: string) => (f === "ai" ? state.aiIncluded : true) }));
vi.mock("../src/supabase", () => ({
  configured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
    functions: {
      invoke: async (_: string, { body }: { body: SlipRequest | PetRequest }) => {
        state.calls.push(body.kind);
        const result = body.kind === "pet"
          ? { waiting: "Biscuit is waiting, dramatically.", goal_met: "Goal met.", after_slip: "Tonight we rally.", away: "Today still counts.", morning: "Morning.", risk: "Careful now.", thanks: "Noted." }
          : { ai_adjust_pct: 0, body_effects: [], explanation: "Biscuit felt that." };
        return { data: { ok: true, result }, error: null };
      },
    },
  },
}));

const { aiForSlip, aiPetLines, latestPetLines } = await import("../src/ai");

const slip: SlipRequest = {
  kind: "slip", tone: "honest", personality: "savage", habitClass: "food_spending", companionName: "Biscuit", amount: 400, unit: "money", median: 200,
  triggers: [], texts: [], nthToday: 1, baselineMonths: 4, last7Slips: 2,
};
const pet: PetRequest = {
  kind: "pet", tone: "brutal", personality: "savage", species: "dog", companionName: "Biscuit", habitClass: "food_spending",
  day: "2026-11-03", streak: 4, quietDays: 0, last7Slips: 2, stage: "adult",
};

beforeEach(() => { mem.clear(); state.calls = []; state.aiIncluded = true; });

describe("AI requests follow the membership", () => {
  it("trial or the AI plan: slips and pet lines are asked for", async () => {
    expect(await aiForSlip(slip)).toMatchObject({ explanation: "Biscuit felt that." });
    expect(await aiPetLines("c1", pet)).toMatchObject({ waiting: "Biscuit is waiting, dramatically." });
    expect(state.calls).toEqual(["slip", "pet"]);
  });

  it("without AI (Basic, or access ended): nothing new is sent, and the hand-written text stands", async () => {
    state.aiIncluded = false;
    expect(await aiForSlip(slip)).toBeNull();
    expect(await aiPetLines("c1", pet)).toBeNull();
    expect(state.calls).toEqual([]);
  });

  it("lines already written stay: today's cached pet lines and the newest lines for notifications", async () => {
    await aiPetLines("c1", pet);
    expect(state.calls).toEqual(["pet"]);
    state.aiIncluded = false;
    expect(await aiPetLines("c1", pet)).toMatchObject({ waiting: "Biscuit is waiting, dramatically." });
    expect(await latestPetLines("c1", "savage", "brutal")).toMatchObject({ goalMet: "Goal met." });
    expect(await aiForSlip(slip)).toBeNull(); // a slip never asked about before: nothing to show, nothing sent
    expect(state.calls).toEqual(["pet"]);
  });

  it("a cached slip sentence is still shown after AI ends (it was written while included)", async () => {
    await aiForSlip(slip);
    state.aiIncluded = false;
    expect(await aiForSlip(slip)).toMatchObject({ explanation: "Biscuit felt that." });
    expect(state.calls).toEqual(["slip"]);
  });
});
