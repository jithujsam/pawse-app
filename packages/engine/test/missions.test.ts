import { describe, expect, it } from "vitest";
import { HEAL_AT, journey, missionHealthCap, MISSIONS, missionsFor, petTraits, setbackState, slipTier, type DayRecord } from "../src";

const D0 = Date.UTC(2026, 0, 1);
const day = (i: number) => new Date(D0 + i * 86_400_000).toISOString().slice(0, 10);
/** m = goal met, s = slip, S = heavy slip, . = nothing recorded. */
const days = (p: string): DayRecord[] => [...p].map((c, i) => ({ day: day(i), met: c === "m", slip: c === "s" || c === "S", heavy: c === "S" }));
const m = (n: number) => "m".repeat(n);
const J = (p: string, mode: "rescue" | "raise" = "rescue") => journey(mode, days(p));

describe("recovery: 21 goal-met days in a row", () => {
  it("a new rescue is at day 0 of 21 with the coat healing first", () => {
    expect(J("")).toMatchObject({ phase: "recovery", run: 0, pct: 0 });
    expect(J("").missions.map((x) => x.status)).toEqual(["current", "waiting", "waiting", "waiting", "waiting", "waiting"]);
  });
  it("conditions heal on days 1, 3, 6, 10, 15 and 21", () => {
    expect(HEAL_AT).toEqual([1, 3, 6, 10, 15, 21]);
    expect([1, 3, 6, 10, 15].map((n) => J(m(n)).missions.filter((x) => x.status === "healed").length)).toEqual([1, 2, 3, 4, 5]);
    expect(J(m(21))).toMatchObject({ phase: "consistency", run: 21, pct: 100, recoveredOn: day(20) });
  });
  it("a slip starts recovery over at day 0", () => {
    const j = J(m(20) + "s");
    expect(j).toMatchObject({ phase: "recovery", run: 0 });
    expect(j.events.at(-1)).toMatchObject({ kind: "restart", n: 20 });
    expect(J(m(20) + "s" + m(20)).phase).toBe("recovery");
    expect(J(m(20) + "s" + m(21)).phase).toBe("consistency");
  });
  it("days with nothing recorded neither count nor break the run", () => {
    expect(J("m.m..m").run).toBe(3);
  });
  it("is the same every time for the same records", () => {
    expect(J("mmsmm.mSm")).toEqual(J("mmsmm.mSm"));
  });
});

describe("the slip formula after recovery", () => {
  it("scores: 1, +1 for a 2nd and a 3rd slip in 7 days, +1 for 3 in 30 days, +1 for a heavy slip; capped at 3", () => {
    expect(slipTier([day(0)], day(0), false)).toBe(1);
    expect(slipTier([day(0)], day(0), true)).toBe(2);
    expect(slipTier([day(0), day(5)], day(5), false)).toBe(2);
    expect(slipTier([day(0), day(20)], day(20), false)).toBe(1);
    expect(slipTier([day(0), day(10), day(20)], day(20), false)).toBe(2);
    expect(slipTier([day(0), day(2), day(4)], day(4), false)).toBe(3);
    expect(slipTier([day(0), day(2), day(4)], day(4), true)).toBe(3);
  });
  it("a one-off slip: a minor issue cleared by 3 goal-met days in a row, then consistency carries on", () => {
    const j = J(m(21) + m(5) + "s");
    expect(j.issue).toMatchObject({ id: "issue_stomach", tier: 1, need: 3, have: 0 });
    expect(j.consistency).toBe(5);
    const k = J(m(21) + m(5) + "s" + m(3));
    expect(k.issue).toBeNull();
    expect(k.consistency).toBe(5);
    expect(k.events.at(-1)).toMatchObject({ kind: "cleared", id: "issue_stomach" });
    expect(J(m(21) + m(5) + "s" + m(4)).consistency).toBe(6);
  });
  it("twice in a week: the old fear comes back, 7 days in a row", () => {
    expect(J(m(21) + "s" + "mm" + "s").issue).toMatchObject({ id: "issue_fear", tier: 2, need: 7 });
  });
  it("three times in a week: withdrawn, 14 days in a row", () => {
    expect(J(m(21) + "smsms").issue).toMatchObject({ id: "issue_withdrawn", tier: 3, need: 14 });
  });
  it("a heavy slip counts as bigger", () => {
    expect(J(m(21) + "S").issue).toMatchObject({ tier: 2 });
  });
  it("a slip while an issue is still active makes it at least one tier worse and restarts its count", () => {
    const j = J(m(21) + "smm" + "......." + "s");
    expect(j.issue).toMatchObject({ tier: 2, have: 0 });
    expect(J(m(21) + "S" + "s").issue).toMatchObject({ tier: 3 });
    expect(J(m(21) + "s" + m(3) + "..........s").issue).toMatchObject({ tier: 1 });
  });
  it("minor issues take turns", () => {
    const ids = [0, 1, 2].map((k) => J(m(21) + ("s" + m(40)).repeat(k) + "s").issue!.id);
    expect(ids).toEqual(["issue_stomach", "issue_restless", "issue_itch"]);
  });
  it("never goes back to the 21-day restart once recovered", () => {
    expect(J(m(21) + "sssssss").phase).toBe("consistency");
  });
});

describe("consistency and thriving", () => {
  it("21 days of consistency, with rewards at 7, 14 and 21, then thriving", () => {
    const j = J(m(42));
    expect(j).toMatchObject({ phase: "thriving", consistency: 21, rewards: 3 });
    expect(j.events.filter((e) => e.kind === "reward").map((e) => e.day)).toEqual([day(27), day(34), day(41)]);
  });
  it("a reward every 30 well days while thriving", () => {
    expect(J(m(72)).rewards).toBe(4);
  });
  it("after day 42 a one-off slip is only minor", () => {
    expect(J(m(42) + "s").issue).toMatchObject({ tier: 1 });
  });
});

describe("the health bar", () => {
  it("a rescue goes from 10% to 100% over the 21 days", () => {
    expect([0, 7, 14, 21].map((n) => missionHealthCap(J(m(n))))).toEqual([10, 40, 70, 100]);
  });
  it("an issue lowers it by 15, 30 or 50 and it comes back as the issue clears", () => {
    expect(missionHealthCap(J(m(21) + "s"))).toBe(85);
    expect(missionHealthCap(J(m(21) + "S"))).toBe(70);
    expect(missionHealthCap(J(m(21) + "smsms"))).toBe(50);
    expect(missionHealthCap(J(m(21) + "smsms" + m(7)))).toBe(75);
  });
  it("a raised puppy in training isn't limited", () => {
    expect(missionHealthCap(J("", "raise"))).toBe(100);
  });
});

describe("modes, setbacks, look", () => {
  it("six conditions or skills per mode", () => {
    expect(missionsFor("rescue")).toHaveLength(6);
    expect(missionsFor("raise")).toHaveLength(6);
    expect(new Set(MISSIONS.map((x) => x.id)).size).toBe(12);
  });
  it("a setback lasts the slip day and the next, ending with a goal-met day", () => {
    const b = { lastGoalMet: null, today: "2026-11-10" };
    expect(setbackState({ ...b, lastSlip: "2026-11-10", daysSinceSlip: 0 }).active).toBe(true);
    expect(setbackState({ ...b, lastSlip: "2026-11-08", daysSinceSlip: 2 }).active).toBe(false);
    expect(setbackState({ ...b, lastSlip: "2026-11-09", lastGoalMet: "2026-11-10", daysSinceSlip: 1 }).active).toBe(false);
  });
  it("the coat heals on day 1; trust only at 21", () => {
    expect(petTraits(J(m(1)))).toMatchObject({ coat: 1, trust: 0 });
    expect(Object.values(petTraits(J(m(21)))).every((v) => v === 1)).toBe(true);
  });
  it("an issue shows on its own traits and fades as it clears", () => {
    const t = petTraits(J(m(21) + "smsms"));
    expect(t.trust).toBeCloseTo(0.3);
    expect(t.coat).toBe(1);
  });
});
