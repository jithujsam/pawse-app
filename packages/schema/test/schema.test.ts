import { describe, expect, it } from "vitest";
import { AiPetResult, AiSlipResult, AiWeeklyResult, PetRequest } from "../src";

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

import { AppDataSchema, AppDataV1Schema, parseAppData, parseAppDataV1, TrackStateSchema } from "../src/data";

describe("tracks (stored data v2)", () => {
  const state = {
    description: "", startedOn: "2026-10-01", status: "active", pauses: [{ from: "2026-10-10", to: "2026-10-12" }], archivedOn: null, createdAt: 0,
    baseline: null, plan: null, restDays: [], weekFocus: [], celebrated: [], wear: null, treatsGiven: 0, fedOn: null, savingsGoal: null,
  };
  const habit = { id: "h1", name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: "c1", unit: "money", fields: [] };
  const base = { settings: {}, companions: [], entries: [], cleanDays: [] };

  it("accepts a valid track state and rejects a bad status or pause", () => {
    expect(TrackStateSchema.safeParse(state).success).toBe(true);
    expect(TrackStateSchema.safeParse({ ...state, status: "deleted" }).success).toBe(false);
    expect(TrackStateSchema.safeParse({ ...state, pauses: [{ from: "soon", to: null }] }).success).toBe(false);
    expect(TrackStateSchema.safeParse({ ...state, description: "x".repeat(281) }).success).toBe(false);
  });

  it("keeps v1 and v2 apart: each parser takes only its own version", () => {
    const v1 = { ...base, v: 1, habits: [habit], settings: { plan: null, restDays: [] }, summaries: { "2026-10-19": "ok" } };
    const v2 = { ...base, v: 2, habits: [{ ...habit, track: state }], summaries: { h1: { "2026-10-19": "ok" } } };
    expect(parseAppDataV1(v1)?.settings).toEqual({ plan: null, restDays: [] });
    expect(parseAppData(v1)).toBeNull();
    expect(parseAppData(v2)?.habits[0].track).toEqual(state);
    expect(parseAppDataV1(v2)).toBeNull();
    expect(AppDataSchema.safeParse({ ...v2, summaries: { "2026-10-19": "flat" } }).success).toBe(false);
    expect(AppDataV1Schema.safeParse(v1).success).toBe(true);
  });

  it("keeps settings and track keys it doesn't know, so a newer app's fields survive a save", () => {
    // The app removes the old per-track keys itself after parsing (persist.normalizeWithReport).
    const v2 = { ...base, v: 2, habits: [{ ...habit, track: { ...state, fromNewerApp: 1 } }], settings: { tone: "gentle", activeHabit: "h1", fromNewerApp: true } };
    const parsed = parseAppData(v2)!;
    expect(parsed.settings).toEqual({ tone: "gentle", activeHabit: "h1", fromNewerApp: true });
    expect(parsed.habits[0].track).toMatchObject({ fromNewerApp: 1 });
    // Known keys are still validated.
    expect(parseAppData({ ...v2, settings: { tone: "shouty" } })).toBeNull();
  });
});

describe("AI pet lines (PRD §24)", () => {
  const ok = {
    waiting: "Still waiting on today. I've rehearsed my reaction both ways.", goal_met: "Goal met. The habit got nothing. Delicious.",
    after_slip: "That one stung. Tonight is still ours.", away: "Three days of silence. I nearly printed posters. Today counts.",
    morning: "Slept like royalty. Yesterday did that.", risk: "Slip o'clock is near. Change the ending.", thanks: "Goal met today. Look at us.",
  };
  it("accepts a full set of short, safe lines", () => expect(AiPetResult.safeParse(ok).success).toBe(true));
  it.each([
    ["a line missing", (({ risk: _r, ...rest }) => rest)(ok)],
    ["too long", { ...ok, waiting: "x".repeat(121) }],
    ["insult", { ...ok, after_slip: "You are pathetic." }],
    ["the pet hurt by a quiet day", { ...ok, away: "I was so lonely while you were gone." }],
    ["disappointment", { ...ok, after_slip: "I'm disappointed in you." }],
    ["care made conditional", { ...ok, goal_met: "You earned a cuddle today." }],
    ["food refusal", { ...ok, after_slip: "I won't eat tonight." }],
    ["weight talk", { ...ok, morning: "I feel fat today." }],
    ["markup or placeholders", { ...ok, waiting: "Hi {name}, check in!" }],
    ["extra field", { ...ok, months: 3 }],
  ])("rejects: %s", (_n, v) => expect(AiPetResult.safeParse(v).success).toBe(false));
  it("the request carries counts and the pet, never anything typed", () => {
    const req = { kind: "pet", tone: "brutal", personality: "savage", species: "dog", companionName: "Biscuit", habitClass: "food_spending", day: "2026-11-03", streak: 4, quietDays: 0, last7Slips: 2, stage: "adult" };
    expect(PetRequest.safeParse(req).success).toBe(true);
    expect(PetRequest.safeParse({ ...req, personality: "evil" }).success).toBe(false);
    expect(PetRequest.safeParse({ ...req, day: "today" }).success).toBe(false);
    expect(Object.keys(PetRequest.shape)).not.toContain("texts");
  });
});
