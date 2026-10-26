import { describe, expect, it } from "vitest";
import { concernIn, concernInAny, isRestrictionRelated, stringsIn } from "../src/guard";

describe("restriction check", () => {
  it("catches calorie, weight, diet and restriction language, however it is written", () => {
    for (const t of ["calories", "Count my calories", "kcal eaten", "c a l o r i e s", "c.a.l.o.r.i.e.s", "ca1ories", "CALORIES", "lose weight", "lose 5 kgs", "weight loss goal", "weigh myself", "weigh-in", "How much did you weigh?", "weighing in", "my weight", "dieting", "keto", "intermittent fasting", "skip meals", "skipping dinner", "eat less", "eating nothing", "starving", "purging", "binge eating", "laxatives", "bmi", "restricting food", "cut out carbs", "feeling fat", "pro-ana"])
      expect(isRestrictionRelated(t), t).toBe(true);
  });
  it("leaves ordinary habits and wording alone", () => {
    for (const t of ["Ordering food or takeaway", "Late-night snacks", "Online shopping", "Scrolling on my phone", "binge-watching shows", "Smoking or vaping", "Drinking alcohol", "Cups of coffee", "Minutes spent", "How many", "weights at the gym", "Rate it on a scale of 1 to 5", "fast food orders", "Sweets", "Takeaway spend"])
      expect(isRestrictionRelated(t), t).toBe(false);
  });
});

describe("one check for every field", () => {
  it("ranks crisis above restriction and honours the strictness", () => {
    expect(concernIn("I want to die")).toBe("crisis");
    expect(concernIn("count calories")).toBe("restriction");
    expect(concernIn("count calories", "crisis")).toBeNull();
    expect(concernIn("I want to die", "crisis")).toBe("crisis");
    expect(concernIn("a long day and I ordered in")).toBeNull();
    expect(concernIn("")).toBeNull();
    expect(concernIn(undefined)).toBeNull();
  });
  it("finds the first concern across several texts, crisis first", () => {
    expect(concernInAny(["fine", "calories", "I can't go on"])).toBe("crisis");
    expect(concernInAny(["fine", "calories"])).toBe("restriction");
    expect(concernInAny(["fine", "also fine"])).toBeNull();
  });
  it("catches the extra crisis phrasings without flagging ordinary sentences", () => {
    for (const t of ["I wish I was dead", "life is not worth living", "no point in going on", "cutting myself"]) expect(concernIn(t, "crisis"), t).toBe("crisis");
    for (const t of ["walked 5 kms", "I cut myself some slack", "dying to try the new place"]) expect(concernIn(t, "crisis"), t).toBeNull();
  });
  it("reads every string inside a record", () => {
    expect([...stringsIn({ a: "x", b: ["y", { c: "z" }], d: 4, e: null })]).toEqual(["x", "y", "z"]);
  });
});
