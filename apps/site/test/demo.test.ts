import { describe, expect, it } from "vitest";
import { dogState, jumpTo, view, type Mark } from "../src/demo";

const met = (n: number): Mark[] => Array.from({ length: n }, () => "met");

describe("landing demo uses the real mission rules", () => {
  it("rescue: wellness 10 at the start, 45 on day 8, 100 when recovered on day 21", () => {
    expect(view("rescue", []).wellness).toBe(10);
    expect(view("rescue", met(8)).wellness).toBe(45);
    const v = view("rescue", met(21));
    expect(v.wellness).toBe(100);
    expect(v.j.phase).toBe("consistency");
  });

  it("raise starts at 70", () => {
    expect(view("raise", []).wellness).toBe(70);
  });

  it("heals on days 1, 3, 6, 10, 15 and 21", () => {
    const healedOn = (n: number) => view("rescue", met(n)).j.missions.filter((m) => m.status === "healed").length;
    expect([1, 3, 6, 10, 15, 21].map(healedOn)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(healedOn(2)).toBe(1);
  });

  it("a slip in recovery starts the 21 days over and keeps the best run", () => {
    const v = view("rescue", [...met(8), "slip"]);
    expect(v.j.run).toBe(0);
    expect(v.j.bestRun).toBe(8);
    expect(v.wellness).toBe(10);
  });

  it("after recovery a slip makes a minor issue that clears in 3 days, not a restart", () => {
    const v = view("rescue", [...met(21), "slip"]);
    expect(v.j.phase).toBe("consistency");
    expect(v.j.issue?.tier).toBe(1);
    expect(v.wellness).toBe(85);
    expect(view("rescue", [...met(21), "slip", ...met(3)]).j.issue).toBeNull();
  });

  it("42 goal-met days reach thriving", () => {
    expect(view("raise", met(42)).j.phase).toBe("thriving");
  });

  it("jumping keeps earlier slips and fills the rest with goal-met days", () => {
    expect(jumpTo(["met", "slip"], 4)).toEqual(["met", "slip", "met", "met"]);
    expect(jumpTo(met(10), 3)).toEqual(met(3));
  });

  it("the dog hops after a goal-met tap and looks sad after a slip", () => {
    expect(dogState(view("rescue", met(1)), true)).toEqual({ mood: "happy", gesture: "hop" });
    expect(dogState(view("rescue", ["slip"]), true).mood).toBe("sad");
    expect(dogState(view("rescue", []), false).mood).toBe("waiting");
  });
});
