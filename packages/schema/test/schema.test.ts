import { describe, expect, it } from "vitest";
import { AiSlipResult, AiWeeklyResult } from "../src";

describe("AI slip result", () => {
  const ok = { ai_adjust_pct: 12, body_effects: ["dull_coat", "heavier"], explanation: "Third order today and well above your usual spend." };
  it("accepts a good result", () => expect(AiSlipResult.safeParse(ok).success).toBe(true));
  it.each([
    ["adjustment too large", { ...ok, ai_adjust_pct: 80 }],
    ["tag outside the vocabulary", { ...ok, body_effects: ["has_cancer"] }],
    ["explanation too long", { ...ok, explanation: "x".repeat(141) }],
    ["medical claim", { ...ok, explanation: "This will give you cancer." }],
    ["insult", { ...ok, explanation: "You are pathetic." }],
    ["weight talk", { ...ok, explanation: "Spending more may lead to weight gain for Biscuit." }],
    ["calorie talk", { ...ok, explanation: "That order had a lot of calories." }],
    ["extra field", { ...ok, extra: 1 }],
  ])("rejects: %s", (_n, v) => expect(AiSlipResult.safeParse(v).success).toBe(false));
});

describe("AI weekly result", () => {
  it("needs a real number and safe wording", () => {
    expect(AiWeeklyResult.safeParse({ summary: "You logged 9 slips this week, up from 6, mostly on Fridays." }).success).toBe(true);
    expect(AiWeeklyResult.safeParse({ summary: "You did worse this week than before, mostly on Fridays." }).success).toBe(false);
  });
});
