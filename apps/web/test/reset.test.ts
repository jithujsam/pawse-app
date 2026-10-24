import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Wiping this phone must never wipe the account (audit B1). A tiny in-memory stand-in for the
 * Supabase tables lets the real sync loop run end to end.
 */
import { hold, remoteWrite, stamp, table } from "./fake-supabase";

vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));

const { actions, getData } = await import("../src/store");
const { startSync, syncNow, stopSync, getSyncStatus } = await import("../src/sync");
const { blank } = await import("../src/persist");

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222", E = "33333333-3333-4333-8333-333333333333";

function seed() {
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true, goal: "Orders" },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
    entries: [{ id: E, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: 300, months: 2.8, severity: 0.7, effects: [], explanation: "x", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
    cleanDays: [{ habitId: H, day: "2026-10-03" }],
  });
}

describe("erasing this phone", () => {
  beforeAll(async () => {
    seed();
    await startSync("u1");
  });

  it("first backs the account up", () => {
    expect(table("entries").size).toBe(1);
    expect((table("profiles").get("u1")!.settings as { onboarded: boolean }).onboarded).toBe(true);
  });

  it("leaves every row in the account untouched and brings the history back", async () => {
    await actions.resetAll();
    expect(getData().entries).toHaveLength(0);
    await syncNow();
    await syncNow();
    for (const t of ["companions", "habits", "entries", "clean_days"]) {
      for (const r of table(t).values()) expect(r.deleted_at ?? null).toBeNull();
    }
    expect((table("profiles").get("u1")!.settings as { onboarded: boolean }).onboarded).toBe(true);
    expect(getData().settings.onboarded).toBe(true);
    expect(getData().entries.map((e) => e.id)).toEqual([E]);
    expect(getData().companions.map((c) => c.id)).toEqual([C]);
  });

  it("an ordinary local delete still reaches the account", async () => {
    actions.deleteEntry(E);
    await syncNow();
    expect(table("entries").get(E)!.deleted_at).toBeTruthy();
    stopSync();
  });
});

describe("erasing or signing out while a sync is in flight", () => {
  const E2 = "44444444-4444-4444-8444-444444444444", E3 = "55555555-5555-4555-8555-555555555555";
  beforeAll(async () => {
    seed();
    const base = getData().entries[0];
    actions.applyRemote({ ...getData(), entries: [{ ...base, id: E2, day: "2026-10-05" }, { ...base, id: E3, day: "2026-10-06" }] });
    await startSync("u1");
    await syncNow();
  });

  it("an erase mid-pull restores the whole history, and deletes nothing", async () => {
    expect(getData().entries.map((e) => e.id).sort()).toEqual([E2, E3]);
    // Another phone edits one slip, so the in-flight (incremental) pull reads only that one. Before the fix, the stale
    // cycle then wrote the entries cursor into the fresh sync state, the restore pulled entries incrementally, and
    // the untouched slip E2 never came back to this phone.
    remoteWrite("entries", { id: E3, amount: 999, client_updated_at: Date.now() + 1 });
    const release = hold();
    const inflight = syncNow();
    await actions.resetAll();
    release();
    await inflight;
    await syncNow();
    expect(table("entries").get(E2)!.deleted_at ?? null).toBeNull();
    expect(getData().settings.onboarded).toBe(true);
    expect(getData().entries.map((e) => e.id).sort()).toEqual([E2, E3]);
    expect(getData().entries.find((e) => e.id === E3)!.amount).toBe(999);
  });

  it("signing out mid-pull never puts the account's rows back on the wiped phone", async () => {
    const release = hold();
    const inflight = syncNow();
    stopSync();
    await actions.resetAll();
    release();
    await inflight;
    expect(getData().entries).toHaveLength(0);
    expect(getData().settings.onboarded).toBe(false);
    expect(getSyncStatus().state).toBe("off");
  });
});

describe("offline and conflicting edits", () => {
  beforeAll(async () => {
    seed();
    await startSync("u1");
    await syncNow();
  });

  it("offline: changes wait on the phone, then go up when the connection is back", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    actions.renameCompanion(C, "Offline");
    await syncNow();
    expect(getSyncStatus().state).toBe("offline");
    expect(getSyncStatus().pending).toBeGreaterThan(0);
    expect(table("companions").get(C)!.name).not.toBe("Offline");
    vi.stubGlobal("navigator", { onLine: true });
    await syncNow();
    expect(table("companions").get(C)!.name).toBe("Offline");
    expect(getSyncStatus().pending).toBe(0);
  });

  it("a newer edit from another phone wins over an older unsent edit here", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    actions.renameCompanion(C, "Older");
    Object.assign(table("companions").get(C)!, { name: "Newer", client_updated_at: Date.now() + 60_000, updated_at: stamp() });
    vi.stubGlobal("navigator", { onLine: true });
    await syncNow();
    expect(getData().companions.find((c) => c.id === C)!.name).toBe("Newer");
  });

  it("an unsent edit here that is newer than the account's row wins and is pushed", async () => {
    Object.assign(table("companions").get(C)!, { name: "Stale", client_updated_at: 1, updated_at: stamp() });
    vi.stubGlobal("navigator", { onLine: false });
    actions.renameCompanion(C, "Fresh");
    vi.stubGlobal("navigator", { onLine: true });
    await syncNow();
    expect(getData().companions.find((c) => c.id === C)!.name).toBe("Fresh");
    expect(table("companions").get(C)!.name).toBe("Fresh");
    stopSync();
  });
});
