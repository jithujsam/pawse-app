import { describe, expect, it } from "vitest";
import { goalProgress, goalTarget, MIN_CHECKED_DAYS, urgePhotos, whatHelps } from "../src/goal";
import { addDays, weekStart } from "../src/dates";
import { blank } from "../src/persist";
import { emptyPlan } from "../src/store";
import { defaultTrackState } from "../src/tracks";
import type { AppData, Baseline, Entry, GoalKind, Urge } from "../src/types";

// Wednesday 21 October 2026: the week runs Monday 19th to Sunday 25th, and last week is the 12th to the 18th.
const T0 = "2026-10-21";
const WS = weekStart(T0);
const H = "11111111-1111-4111-8111-111111111111", C = "22222222-2222-4222-8222-222222222222";

const slip = (day: string, n = 0): Entry => ({ id: `e-${day}-${n}`, habitId: H, companionId: C, day, time: null, values: {}, amount: null, months: 2, severity: 1, effects: [], explanation: "", source: "baseline", aiAdjustPct: null, createdAt: 0 });
const urge = (day: string, p: Partial<Urge> = {}): Urge => ({ id: `u-${day}-${Math.random()}`, habitId: H, day, time: "20:00", strength: 3, outcome: "rode_it_out", createdAt: Date.parse(day), ...p });

function build(o: { goal?: GoalKind | null; limit?: number | null; identity?: string; baseline?: Baseline | null; slips?: string[]; met?: string[]; urges?: Urge[] } = {}): AppData {
  const d = blank();
  const plan = o.goal === null ? null : { ...emptyPlan(), goal: o.goal ?? "stop", limitPerWeek: o.limit ?? null, identity: o.identity ?? "" };
  return {
    ...d, settings: { ...d.settings, onboarded: true, activeHabit: H },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: addDays(T0, -60), diedOn: null, finalAge: null, trackId: H }],
    habits: [{ id: H, name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: C, unit: "count", fields: [], track: { ...defaultTrackState(addDays(T0, -60)), plan, baseline: o.baseline ?? null } }],
    entries: (o.slips ?? []).map((day, i) => slip(day, i)),
    cleanDays: (o.met ?? []).map((day) => ({ habitId: H, day })),
    urges: o.urges ?? [],
  } as AppData;
}
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe("the target a goal describes", () => {
  it("maps each goal to a target, and a cut-down goal needs its number", () => {
    expect(goalTarget(null)).toBeNull();
    expect(goalTarget({ ...emptyPlan(), goal: null })).toBeNull();
    expect(goalTarget({ ...emptyPlan(), goal: "stop" })).toEqual({ kind: "quit" });
    expect(goalTarget({ ...emptyPlan(), goal: "reduce", limitPerWeek: 3 })).toEqual({ kind: "limit", perWeek: 3 });
    expect(goalTarget({ ...emptyPlan(), goal: "reduce", limitPerWeek: null })).toEqual({ kind: "learn" });
    expect(goalTarget({ ...emptyPlan(), goal: "understand" })).toEqual({ kind: "learn" });
  });
  it("a plan saved before goals had targets (no number, no identity) still reads", () => {
    const old = { goal: "reduce", reasons: [], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] } as never;
    expect(goalTarget(old)).toEqual({ kind: "learn" });
  });
});

describe("goal progress", () => {
  it("no goal, no progress", () => { expect(goalProgress(build({ goal: null }), H, T0)).toBeNull(); });

  it("understanding first never judges: it only notices", () => {
    const g = goalProgress(build({ goal: "understand", slips: [WS] }), H, T0)!;
    expect(g.status).toBe("learn");
    expect(g.target).toEqual({ kind: "learn" });
  });

  it("a week with too few check-ins is 'building', never a verdict (an unrecorded day is unknown, not a failure)", () => {
    const g = goalProgress(build({ goal: "stop", met: [WS] }), H, T0)!;
    expect(MIN_CHECKED_DAYS).toBe(2);
    expect(g.checkedThis).toBe(1);
    expect(g.status).toBe("building");
  });

  it("quit: no slips this week is on target; any slip is not", () => {
    expect(goalProgress(build({ goal: "stop", met: days(WS, 3) }), H, T0)!.status).toBe("on_target");
    const slipped = goalProgress(build({ goal: "stop", met: days(WS, 2), slips: [addDays(WS, 2)] }), H, T0)!;
    expect(slipped.thisWeek).toBe(1);
    expect(["closing", "away"]).toContain(slipped.status);
  });

  it("quit: over the target but with fewer slips than last week is 'closing'; the same or more is 'away'", () => {
    const lastWeek = [addDays(WS, -7), addDays(WS, -6), addDays(WS, -5)]; // 3 slips last week
    const closing = goalProgress(build({ goal: "stop", met: [...days(addDays(WS, -7), 7), ...days(WS, 2)], slips: [...lastWeek, addDays(WS, 2)] }), H, T0)!;
    expect(closing.lastWeek).toBe(3); expect(closing.thisWeek).toBe(1);
    expect(closing.status).toBe("closing");
    const away = goalProgress(build({ goal: "stop", met: [...days(addDays(WS, -7), 7), ...days(WS, 2)], slips: [addDays(WS, -7), WS, addDays(WS, 1)] }), H, T0)!;
    expect(away.lastWeek).toBe(1); expect(away.thisWeek).toBe(2);
    expect(away.status).toBe("away");
  });

  it("cut down: at or under the weekly limit is on target", () => {
    const base = { goal: "reduce" as const, limit: 2, met: days(WS, 3) };
    expect(goalProgress(build({ ...base, slips: [WS, addDays(WS, 1)] }), H, T0)!.status).toBe("on_target");
    expect(goalProgress(build({ ...base, slips: [WS, addDays(WS, 1), addDays(WS, 2)] }), H, T0)!.status).toBe("away");
  });

  it("measures change since the start from the onboarding pace", () => {
    // Started at about 3 a week (few_weekly); over 13 checked-in days there were 2 slips, so about 1.08 a week now.
    const g = goalProgress(build({ goal: "stop", baseline: "few_weekly", met: days(addDays(T0, -13), 14).filter((x) => x !== T0), slips: [addDays(T0, -5), addDays(T0, -9)] }), H, T0)!;
    expect(g.startedPerWeek).toBe(3);
    expect(g.nowPerWeek).toBeCloseTo((2 / 13) * 7, 5);
    expect(g.changePct).toBe(64);
  });

  it("returns the last 8 weeks of slips, oldest first, ending with this week", () => {
    const g = goalProgress(build({ goal: "stop", met: days(WS, 2), slips: [addDays(WS, -14), addDays(WS, -14), addDays(WS, 1)] }), H, T0)!;
    expect(g.weeks).toHaveLength(8);
    expect(g.weeks[5]).toBe(2);
    expect(g.weeks[7]).toBe(1);
  });

  it("carries who the person wants to be", () => {
    expect(goalProgress(build({ goal: "stop", identity: "  Someone who reads every night " }), H, T0)!.identity).toBe("Someone who reads every night");
  });
});

describe("what helps", () => {
  it("groups what people did instead, most successful first, ignoring other tracks and blanks", () => {
    const d = build({
      urges: [
        urge("2026-10-19", { instead: "Reading", strength: 4 }), urge("2026-10-20", { instead: "reading", strength: 2 }),
        urge("2026-10-20", { instead: "Walk", outcome: "slipped", strength: 5 }), urge("2026-10-21", { instead: "Walk" }),
        urge("2026-10-21", { instead: "  " }), urge("2026-10-21"), { ...urge("2026-10-21", { instead: "Elsewhere" }), habitId: "other" },
      ],
    });
    const { helpers, noted } = whatHelps(d, H);
    expect(noted).toBe(4);
    expect(helpers.map((h) => [h.what, h.managed, h.total])).toEqual([["Reading", 2, 2], ["Walk", 1, 2]]);
    expect(helpers[0].avgStrength).toBe(3);
  });

  it("keeps the newest photos, newest first", () => {
    const d = build({ urges: [urge("2026-10-19", { instead: "A", photo: "data:image/jpeg;base64,AA" }), urge("2026-10-21", { instead: "B", photo: "data:image/jpeg;base64,BB" }), urge("2026-10-20", { instead: "C" })] });
    expect(urgePhotos(d, H).map((p) => p.what)).toEqual(["B", "A"]);
  });
});
