import { describe, expect, it, vi } from "vitest";
import { lacksColumns, table } from "./fake-supabase";

/** Several tracks through the account, on a server with migration 0006 and on one without it. */
vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, getData } = await import("../src/store");
const { startSync, stopSync, getSyncStatus } = await import("../src/sync");
const { blank } = await import("../src/persist");
const { defaultTrackState, trackState } = await import("../src/tracks");

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const plan = { goal: "stop" as const, reasons: ["Health"], situations: [], firstStep: "", strategies: [], supportName: "", ifThen: [] };

function phone(ids: number) {
  const [CA, HA, CB, HB] = [1, 2, 3, 4].map((k) => u(ids + k));
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [
      { id: CA, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null, trackId: HA },
      { id: CB, species: "cat", name: "Miso", bornOn: "2026-10-05", diedOn: null, finalAge: null, trackId: HB },
    ],
    habits: [
      { id: HA, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: CA, unit: "money", fields: [], track: { ...defaultTrackState("2026-10-01"), plan, wear: "bow" } },
      { id: HB, name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: CB, unit: "count", fields: [], track: { ...defaultTrackState("2026-10-05"), status: "paused", pauses: [{ from: "2026-10-20", to: null }] } },
    ],
  });
  return { CA, HA, CB, HB };
}

describe("tracks through the account", () => {
  it("each track's state and each companion's owner reach the server; old apps still find the first track's settings", async () => {
    const uid = "user-t1";
    const { HA, HB, CB } = phone(100);
    await startSync(uid);
    expect(table("habits").get(HA)).toMatchObject({ status: "active", started_on: "2026-10-01", track: { plan, wear: "bow" } });
    expect(table("habits").get(HB)).toMatchObject({ status: "paused", track: { pauses: [{ from: "2026-10-20", to: null }] } });
    expect(table("companions").get(CB)).toMatchObject({ habit_id: HB });
    expect(table("profiles").get(uid)!.settings).toMatchObject({ plan, wear: "bow", goal: "Orders" });
    expect(getSyncStatus().state).toBe("idle");
    stopSync();
  });

  it("a server without migration 0006 keeps syncing everything else, and the phone keeps its track state", async () => {
    lacksColumns("habits", ["description", "started_on", "status", "archived_at", "track"]);
    lacksColumns("companions", ["habit_id"]);
    const uid = "user-t2";
    const { HA, HB, CA } = phone(200);
    actions.logSlip(HA, {}, "2026-10-21");
    await startSync(uid);
    expect(getSyncStatus().state).toBe("idle");
    expect(table("habits").get(HB)).toMatchObject({ name: "Smoking" });
    expect(table("habits").get(HB)!.track).toBeUndefined();
    expect(table("companions").get(CA)).toMatchObject({ name: "Biscuit" });
    expect([...table("entries").values()].some((e) => e.habit_id === HA)).toBe(true);
    expect(trackState(getData(), HB).status).toBe("paused");
    expect(trackState(getData(), HA).plan).toEqual(plan);
    stopSync();
  });
});
