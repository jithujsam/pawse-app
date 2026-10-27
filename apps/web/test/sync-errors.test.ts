import { beforeAll, describe, expect, it, vi } from "vitest";
import { refuses, table } from "./fake-supabase";
import { withTimeout } from "../src/net";

vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });

const { actions } = await import("../src/store");
const { startSync, syncNow, getSyncStatus, stopSync } = await import("../src/sync");
const { blank } = await import("../src/persist");

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222";
const E1 = "33333333-3333-4333-8333-333333333331", E2 = "33333333-3333-4333-8333-333333333332", E3 = "33333333-3333-4333-8333-333333333333";
const entry = (id: string, createdAt: number) => ({
  id, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: null, months: 2, severity: 1, effects: [], explanation: "", source: "baseline" as const, aiAdjustPct: null, createdAt,
});

describe("a row the server refuses does not stall the rest of the sync", () => {
  beforeAll(() => {
    // The server refuses one entry for good (say, a check constraint). Everything else must still go up.
    refuses("entries", (r) => r.id === E2);
  });

  it("sends the good rows, parents first, and sets the refused one aside instead of failing every cycle", async () => {
    const d = blank();
    actions.applyRemote({
      ...d,
      settings: { ...d.settings, onboarded: true },
      companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
      habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
      entries: [entry(E1, 1), entry(E2, 2)],
    });
    await startSync("u-refuse");
    await syncNow();
    expect(table("companions").size).toBe(1);
    expect(table("entries").has(`${E1}`)).toBe(true);
    expect(table("entries").has(`${E2}`)).toBe(false);
    expect(getSyncStatus().state).toBe("error");
    expect(getSyncStatus().pending).toBe(1); // the refused row isn't backed up, so sign-out will warn about it
    // Another pass does not retry the refused row, and the phone still says there's a problem.
    await syncNow();
    expect(getSyncStatus().state).toBe("error");
    expect(table("entries").has(`${E2}`)).toBe(false);
  });

  it("a later change to the refused row gives it another try, and new rows still go up", async () => {
    refuses("entries", () => false); // the server accepts again
    actions.applyAi(E2, { effects: [], explanation: "Edited after the refusal." }); // the change re-queues the row
    actions.restoreEntry(entry(E3, 3));
    await syncNow();
    expect(table("entries").has(E2)).toBe(true);
    expect(table("entries").has(E3)).toBe(true);
    expect(getSyncStatus().state).toBe("idle");
    stopSync();
  });
});

describe("withTimeout", () => {
  it("passes through an answer that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
  it("fails a call that never answers, and runs the abandon hook once", async () => {
    let abandoned = 0;
    await expect(withTimeout(new Promise(() => undefined), 20, () => { abandoned++; })).rejects.toThrow("timed out");
    expect(abandoned).toBe(1);
  });
  it("keeps a real error as it was", async () => {
    await expect(withTimeout(Promise.reject(new Error("offline")), 50)).rejects.toThrow("offline");
  });
});

