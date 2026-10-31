import { describe, expect, it } from "vitest";
import { sceneFor, type SceneInput } from "../src/scene";

const base: SceneInput = { wellness: 100, rescue: false, slipToday: false, milestoneToday: false, hour: 12 };
const at = (wellness: number, o: Partial<SceneInput> = {}) => sceneFor({ ...base, wellness, ...o });

describe("scene mood thresholds", () => {
  it("picks the mood from wellness", () => {
    expect(at(100).mood).toBe("golden");
    expect(at(95).mood).toBe("golden");
    expect(at(94).mood).toBe("clear");
    expect(at(80).mood).toBe("clear");
    expect(at(79).mood).toBe("clearing");
    expect(at(60).mood).toBe("clearing");
    expect(at(59).mood).toBe("overcast");
    expect(at(40).mood).toBe("overcast");
    expect(at(39).mood).toBe("storm");
    expect(at(0).mood).toBe("storm");
  });
  it("a milestone today is golden at any wellness", () => {
    expect(at(10, { milestoneToday: true }).mood).toBe("golden");
  });
  it("a rescue below 95 never gets better than clearing", () => {
    expect(at(90, { rescue: true }).mood).toBe("clearing");
    expect(at(85, { rescue: true, milestoneToday: true }).mood).toBe("clearing");
    expect(at(95, { rescue: true }).mood).toBe("golden");
    expect(at(70, { rescue: true }).mood).toBe("clearing");
    expect(at(50, { rescue: true }).mood).toBe("overcast");
  });
});

describe("scene time and light", () => {
  it("splits the day at 6, 17 and 20", () => {
    expect([5, 6, 16, 17, 19, 20, 23, 0].map((hour) => at(90, { hour }).time)).toEqual(["night", "day", "day", "dusk", "dusk", "night", "night", "night"]);
  });
  it("scales light for dusk and night", () => {
    expect(at(90, { hour: 12 }).light).toEqual({ color: "#FFF8EE", intensity: 1.6 });
    expect(at(90, { hour: 18 }).light.intensity).toBeCloseTo(1.6 * 0.8);
    expect(at(90, { hour: 22 }).light.intensity).toBeCloseTo(1.6 * 0.55);
  });
  it("resolves the day colours from the table and darkens them at night", () => {
    const d = at(90, { hour: 12 });
    expect([d.skyTop, d.skyBottom, d.ground]).toEqual(["#7FB2DA", "#CFE3EF", "#6F9450"]);
    const n = at(90, { hour: 23 });
    expect(n.skyTop).not.toBe(d.skyTop);
    expect(n.ground).not.toBe(d.ground);
  });
  it("uses light ink on grey weather and at night, dark ink otherwise", () => {
    expect(at(10).ink).toBe("light");
    expect(at(50).ink).toBe("light");
    expect(at(90, { hour: 22 }).ink).toBe("light");
    expect(at(90).ink).toBe("dark");
    expect(at(70, { hour: 18 }).ink).toBe("dark");
  });
});

describe("scene rain", () => {
  it("counts streaks by mood, and a slip adds rain to fair weather", () => {
    expect(at(10).rain).toBe(24);
    expect(at(50).rain).toBe(10);
    expect(at(70).rain).toBe(0);
    expect(at(70, { slipToday: true }).rain).toBe(12);
    expect(at(90, { slipToday: true }).rain).toBe(12);
    expect(at(10, { slipToday: true }).rain).toBe(24);
  });
});
