import { describe, expect, it } from "vitest";
import { buildFields, inferClass, inferMeasure, isRestrictionRelated } from "../src/questions";

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
  it("builds the questions from the answers, in a fixed order", () => {
    const f = buildFields({ what: "x", measure: "money", cls: "food_spending", triggers: ["late", "stress"] });
    expect(f.map((x) => x.id)).toEqual(["amount", "what", "where", "trg_late", "trg_stress", "extra", "photo"]);
    expect(f.find((x) => x.amount)?.type).toBe("money");
    expect(f.filter((x) => x.trigger)).toHaveLength(3);
  });
  it("asks what happened when there is no number to track", () => {
    const f = buildFields({ what: "x", measure: "none", cls: "custom", triggers: [] });
    expect(f.some((x) => x.amount)).toBe(false);
    expect(f.find((x) => x.id === "what")?.required).toBe(true);
  });
  it("refuses to track restriction, calories or weight", () => {
    for (const t of ["counting calories", "dieting", "skipping meals", "my weight", "eating less"]) expect(isRestrictionRelated(t)).toBe(true);
    expect(isRestrictionRelated("ordering food I didn't plan")).toBe(false);
  });
});
