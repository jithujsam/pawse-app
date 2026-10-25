import { describe, expect, it } from "vitest";
import { buildFields, countTriggers, inferClass, inferMeasure, inferMeasureFromLabel, isRestrictionRelated, pickedLabels, starterFields } from "../src/questions";

describe("questions", () => {
  it("infers the habit class from free text", () => {
    expect(inferClass("vaping at night")).toBe("smoking");
    expect(inferClass("too many beers")).toBe("alcohol");
    expect(inferClass("reels")).toBe("doomscrolling");
    expect(inferClass("random amazon orders")).toBe("impulse_buying");
    expect(inferClass("swiggy at midnight")).toBe("food_spending");
    expect(inferClass("biting my nails")).toBe("custom");
  });
  it("picks a sensible way to measure each class", () => {
    expect(inferMeasure("food_spending")).toBe("money");
    expect(inferMeasure("smoking")).toBe("count");
    expect(inferMeasure("doomscrolling")).toBe("minutes");
    expect(inferMeasure("custom")).toBe("none");
  });
  it("builds one-tap questions in functional-analysis order", () => {
    const f = buildFields({ what: "x", measure: "money", cls: "food_spending", triggers: ["stress", "lonely"] });
    expect(f.map((x) => x.id)).toEqual(["amount", "what", "mood", "urge", "plan", "where", "who", "after", "photo"]);
    expect(f.filter((x) => x.required).map((x) => x.id)).toEqual(["amount"]);
    expect(f.find((x) => x.id === "what")?.type).toBe("choice");
    expect(f.find((x) => x.id === "mood")?.options?.map((o) => o.id)).toEqual(["stress", "lonely"]);
    expect(f.find((x) => x.id === "urge")?.type).toBe("scale");
  });
  it("offers sensible defaults when no triggers were picked, and habit-specific answers", () => {
    expect(buildFields({ what: "x", measure: "count", cls: "smoking", triggers: [] }).find((x) => x.id === "mood")?.options?.length).toBe(4);
    expect(buildFields({ what: "x", measure: "minutes", cls: "doomscrolling", triggers: [] }).find((x) => x.id === "what")?.options?.map((o) => o.label)).toContain("Instagram");
    expect(buildFields({ what: "Betting or gambling", measure: "money", cls: "custom", triggers: [] }).find((x) => x.id === "what")?.options?.map((o) => o.label)).toContain("Sports bet");
  });
  it("asks what happened in words when there is no number and no known habit", () => {
    const f = buildFields({ what: "biting nails", measure: "none", cls: "custom", triggers: [] });
    expect(f.some((x) => x.amount)).toBe(false);
    expect(f.find((x) => x.id === "what")).toMatchObject({ type: "text", required: true });
  });
  it("counts triggers from picked answers and late night", () => {
    const f = buildFields({ what: "x", measure: "money", cls: "food_spending", triggers: ["stress", "bored", "celebrating"] });
    expect(countTriggers(f, { mood: "stress,celebrating", plan: "spur", who: "alone" }, 14)).toBe(3);
    expect(countTriggers(f, { mood: "celebrating", plan: "planned", who: "friends" }, 14)).toBe(0);
    expect(countTriggers(f, {}, 23)).toBe(1);
    expect(countTriggers(f, {}, null)).toBe(0);
  });
  it("still counts yes answers on questions from earlier versions", () => {
    const old = [{ id: "trg_late", label: "Was it late at night?", type: "yesno" as const, required: false, trigger: true }];
    expect(countTriggers(old, { trg_late: true }, 23)).toBe(1);
  });
  it("reads picked labels", () => {
    const f = buildFields({ what: "x", measure: "money", cls: "food_spending", triggers: ["stress", "bored"] });
    expect(pickedLabels(f.find((x) => x.id === "mood")!, "bored,stress")).toEqual(["Stressed", "Bored"]);
  });
  it("refuses to track restriction, calories or weight", () => {
    for (const t of ["counting calories", "dieting", "skipping meals", "my weight", "eating less"]) expect(isRestrictionRelated(t)).toBe(true);
    expect(isRestrictionRelated("ordering food I didn't plan")).toBe(false);
  });
  it("starts a new track with only what the person asked for", () => {
    const none = starterFields({ what: "biting nails", measure: "none", cls: "custom", triggers: [] });
    expect(none.map((f) => f.id)).toEqual(["note", "photo"]);
    const f = starterFields({ what: "x", measure: "count", amountLabel: "  cigarettes ", cls: "smoking", triggers: [] });
    expect(f.map((x) => x.id)).toEqual(["amount", "note", "photo"]);
    expect(f[0]).toMatchObject({ label: "cigarettes", type: "number", required: true, amount: true });
    expect(f.some((x) => x.options)).toBe(false); // nothing prefilled to pick from
  });
  it("reads money, minutes or a count from what the person typed", () => {
    expect(inferMeasureFromLabel("")).toBe("none");
    expect(inferMeasureFromLabel("₹ spent")).toBe("money");
    expect(inferMeasureFromLabel("minutes")).toBe("minutes");
    expect(inferMeasureFromLabel("cigarettes")).toBe("count");
  });
});
