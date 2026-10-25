import { beforeEach, describe, expect, it, vi } from "vitest";
import { lacksColumns, remoteWrite, table } from "./fake-supabase";

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
  // Only the test that simulates a server without migration 0006 turns columns off.
  beforeEach(() => { lacksColumns("habits", []); lacksColumns("companions", []); });
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

  it("an older app saving the account's settings and its habit can't wipe or override track state", async () => {
    const uid = "user-t3";
    const { HA, HB, CA } = phone(300);
    await startSync(uid);
    stopSync();
    // An app from before tracks (2.1.0 / the 3.0.0 test build) loads the profile, drops keys it doesn't know,
    // and saves its whole settings object back, with its own stale per-track values. It also re-saves the habit
    // it shows (habits[0]) without the track columns it has never heard of.
    remoteWrite("profiles", { id: uid, settings: { onboarded: true, tone: "brutal", plan: null, wear: null, restDays: ["2026-10-01"], celebrated: [] }, client_updated_at: Date.now() + 1000 });
    remoteWrite("habits", { id: HA, user_id: uid, companion_id: CA, name: "Orders", class: "food_spending", class_weight: 0.7, unit: "money", fields: [], position: 0, client_updated_at: Date.now() + 1000, deleted_at: null });
    expect(table("habits").get(HA)!.track).toMatchObject({ plan, wear: "bow" }); // an upsert only sets the columns it sends

    // This phone pulls: the person-level change arrives; the track state doesn't move.
    await startSync(uid);
    expect(getData().settings.tone).toBe("brutal");
    expect(trackState(getData(), HA)).toMatchObject({ plan, wear: "bow", restDays: [] });
    expect(trackState(getData(), HB).status).toBe("paused");
    stopSync();

    // A brand-new phone signing in to the same account rebuilds every track from the server, not from the
    // older app's stale profile keys.
    actions.applyRemote(blank());
    await startSync(uid);
    expect(getData().habits.map((h) => h.id).sort()).toEqual([HA, HB].sort());
    expect(trackState(getData(), HA)).toMatchObject({ plan, wear: "bow", restDays: [] });
    expect(trackState(getData(), HB)).toMatchObject({ status: "paused", pauses: [{ from: "2026-10-20", to: null }] });
    expect(getData().settings.activeHabit ?? null).not.toBe(HB); // never taken from the account
    stopSync();
  });

  it("fields a newer app wrote into a track's state survive this version editing that track", async () => {
    const uid = "user-t4";
    const { HA } = phone(400);
    await startSync(uid);
    stopSync();
    const row = table("habits").get(HA)!;
    remoteWrite("habits", { ...row, track: { ...(row.track as object), fromTheFuture: 42 }, client_updated_at: Number(row.client_updated_at) + 1 });
    await startSync(uid);
    // Last write wins by each phone's clock: make sure this edit is later than the newer app's write.
    await new Promise((r) => setTimeout(r, 5));
    actions.setTrackSettings(HA, { wear: "crown" });
    await new Promise((r) => setTimeout(r, 50));
    const { syncNow } = await import("../src/sync");
    await syncNow();
    expect(table("habits").get(HA)!.track).toMatchObject({ wear: "crown", fromTheFuture: 42 });
    stopSync();
  });
});
