import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Audit P0-1. "Forgot PIN" -> "Erase and start over" used to wipe the phone but leave it signed in to the account.
 * The first sync after that brought the whole history back, unencrypted and with no PIN. Erasing local data is not
 * proof of who is holding the phone; signing in with the account's password is.
 */
import { authState, table } from "./fake-supabase";

vi.mock("../src/supabase", async () => ({ configured: true, supabase: (await import("./fake-supabase")).client }));
vi.mock("../src/db", () => {
  const m = new Map<string, unknown>();
  return {
    idbAvailable: () => true, __m: m,
    kv: { get: async (k: string) => m.get(k), set: async (k: string, v: unknown) => void m.set(k, v), del: async (k: string) => void m.delete(k), clear: async () => m.clear() },
  };
});

const db = (await import("../src/db")) as unknown as { __m: Map<string, unknown> };
const { actions, flush, getData, vault } = await import("../src/store");
const { getSyncStatus, signOutAndErase, startSync, stopSync, syncNow } = await import("../src/sync");
const { blank } = await import("../src/persist");

const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222", E = "33333333-3333-4333-8333-333333333333";

async function signedInWithHistoryAndPin() {
  stopSync();
  authState.session = { user: { id: "u1" } }; authState.stuck = false;
  for (const t of ["companions", "habits", "entries", "deductions", "clean_days", "profiles"]) table(t).clear();
  await actions.resetAll();
  const d = blank();
  actions.applyRemote({
    ...d,
    settings: { ...d.settings, onboarded: true },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: "2026-10-01", diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
    entries: [{ id: E, habitId: H, companionId: C, day: "2026-10-02", time: null, values: {}, amount: 300, months: 2.8, severity: 0.7, effects: [], explanation: "x", source: "baseline", aiAdjustPct: null, createdAt: 1 }],
  });
  await startSync("u1");
  await vault.setPin("4826");
  await flush();
}

describe("the path 'Forgot PIN' used to take", () => {
  beforeEach(signedInWithHistoryAndPin);

  it("wiping alone leaves the phone signed in, so the next sync hands the history back with no PIN", async () => {
    expect(vault.hasPin()).toBe(true);
    await actions.resetAll();
    expect(getData().entries).toHaveLength(0);
    await syncNow(); await syncNow();
    expect(getData().entries.map((e) => e.id)).toEqual([E]);
    expect(vault.hasPin()).toBe(false); // and the lock is gone
    stopSync();
  });
});

describe("Forgot PIN -> Erase now signs this phone out first", () => {
  beforeEach(signedInWithHistoryAndPin);

  it("wipes the phone, ends its session and turns sync off", async () => {
    expect(await signOutAndErase()).toBe(true);
    expect(authState.session).toBeNull();
    expect(getData().entries).toHaveLength(0);
    expect(getData().settings.onboarded).toBe(false);
    expect(vault.hasPin()).toBe(false);
    expect(getSyncStatus().state).toBe("off");
  });

  it("nothing brings the history back without signing in: a later sync does nothing", async () => {
    await signOutAndErase();
    await syncNow(); await syncNow();
    expect(getData().entries).toHaveLength(0);
    expect(getData().companions).toHaveLength(0);
  });

  it("leaves no readable copy of the history on the phone", async () => {
    await signOutAndErase();
    await flush();
    expect(db.__m.has("data.enc")).toBe(false);
    expect(JSON.stringify([...db.__m.values()])).not.toContain("Biscuit");
    expect(db.__m.has("sync:u1")).toBe(false);
  });

  it("does not delete anything from the account, or sign out the person's other phones", async () => {
    await signOutAndErase();
    for (const t of ["companions", "habits", "entries"]) for (const r of table(t).values()) expect(r.deleted_at ?? null).toBeNull();
    expect(table("entries").has(E)).toBe(true);
  });

  it("legitimate recovery works: signing in again restores the history", async () => {
    await signOutAndErase();
    authState.session = { user: { id: "u1" } }; // the person signs in with their password
    await startSync("u1");
    await syncNow();
    expect(getData().entries.map((e) => e.id)).toEqual([E]);
    expect(getData().settings.onboarded).toBe(true);
    stopSync();
  });

  it("if the session can't be cleared, nothing is wiped (a wipe while still signed in is the bypass)", async () => {
    authState.stuck = true;
    expect(await signOutAndErase()).toBe(false);
    expect(getData().entries.map((e) => e.id)).toEqual([E]);
    expect(vault.hasPin()).toBe(true);
    expect(authState.session).not.toBeNull();
    stopSync();
  });
});

describe("deleting this phone's data from Your data, with app lock on", () => {
  beforeEach(signedInWithHistoryAndPin);

  it("keeps the lock, so what comes back from the account is encrypted", async () => {
    await actions.resetAll({ keepLock: true });
    expect(vault.hasPin()).toBe(true);
    expect(await vault.pinLength()).toBe(4);
    await syncNow(); await syncNow();
    await flush();
    expect(getData().entries.map((e) => e.id)).toEqual([E]);
    expect(db.__m.has("data.enc")).toBe(true);
    expect(db.__m.has("data")).toBe(false);
    expect(JSON.stringify(db.__m.get("data.enc"))).not.toContain("Biscuit");
    expect(await vault.check("4826")).toBe(true);
    stopSync();
  });

  it("without keepLock (leaving the account) the lock goes with the data", async () => {
    await actions.resetAll();
    expect(vault.hasPin()).toBe(false);
    expect(db.__m.has("pinLength")).toBe(false);
    stopSync();
  });
});
