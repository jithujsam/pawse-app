import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, today } from "../src/dates";

// An in-memory stand-in for IndexedDB, so the real persistence code runs. `failNextGet` simulates a read failure.
const mem = vi.hoisted(() => ({ rows: new Map<string, unknown>(), failNextGet: false }));
vi.mock("../src/db", () => ({
  idbAvailable: () => true,
  kv: {
    get: async (k: string) => {
      if (mem.failNextGet) { mem.failNextGet = false; throw new Error("read failed"); }
      return mem.rows.has(k) ? structuredClone(mem.rows.get(k)) : undefined;
    },
    set: async (k: string, v: unknown) => { mem.rows.set(k, structuredClone(v)); },
    del: async (k: string) => { mem.rows.delete(k); },
    clear: async () => { mem.rows.clear(); },
  },
}));

// The app reads a legacy localStorage key at boot; Node has none, so give it an empty one.
const ls = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v), removeItem: (k: string) => void ls.delete(k) });

// A locked boot sets the lock screen's accent colour on the page, so it needs a document.
vi.stubGlobal("document", { documentElement: { dataset: {} } });

const PIN = "2468";
const C = "11111111-1111-4111-8111-111111111111", H = "22222222-2222-4222-8222-222222222222";
const settle = () => new Promise((r) => setTimeout(r, 320)); // longer than the 250 ms persist timer

/** A fresh copy of the store module, as after an app restart. */
async function restart() {
  vi.resetModules();
  return import("../src/store");
}

function seeded() {
  return {
    v: 2 as const, updatedAt: 1, summaries: {}, urges: [], journal: [], cleanDays: [],
    settings: { tone: "honest", onboarded: true, userName: "Jo" },
    companions: [{ id: C, species: "dog", name: "Biscuit", bornOn: addDays(today(), -20), diedOn: null, finalAge: null }],
    habits: [{ id: H, name: "Orders", cls: "food_spending", classWeight: 0.7, companionId: C, unit: "money", fields: [] }],
    entries: [],
  };
}

/** Makes a PIN-protected vault in the fake storage and returns what is in it. */
async function makeVault() {
  mem.rows.clear();
  const store = await restart();
  await store.boot();
  store.actions.applyRemote(seeded() as never);
  await store.vault.setPin(PIN);
  await store.flush();
  return store;
}

describe("the encrypted vault survives a locked app", () => {
  beforeEach(() => { mem.rows.clear(); mem.failNextGet = false; });

  it("a restart with a PIN boots locked, with the encrypted payload in place", async () => {
    await makeVault();
    const store = await restart();
    const b = await store.boot();
    expect(b.kind).toBe("locked");
    expect(mem.rows.has("data.enc")).toBe(true);
    expect(mem.rows.has("data")).toBe(false);
  });

  it("backgrounding, persisting or applying remote rows while locked never overwrites the vault", async () => {
    await makeVault();
    const before = structuredClone(mem.rows.get("data.enc"));
    const store = await restart();
    await store.boot();
    // What the app does while the lock screen is up: the background flush, a sync pull, a pagehide.
    await store.flush();
    store.actions.applyRemote({ ...seeded(), companions: [] } as never);
    await store.flush();
    await settle();
    expect(mem.rows.get("data.enc")).toEqual(before);
    expect(mem.rows.has("data")).toBe(false);
  });

  it("removing or setting a PIN from a locked session changes nothing stored", async () => {
    await makeVault();
    const before = structuredClone(mem.rows.get("data.enc"));
    const store = await restart();
    await store.boot();
    await store.vault.removePin();
    await store.vault.setPin("1357");
    await settle();
    expect(mem.rows.get("data.enc")).toEqual(before);
    expect(mem.rows.has("data")).toBe(false);
  });

  it("a failed read at boot is not treated as an empty phone: nothing is saved over the vault", async () => {
    await makeVault();
    const before = structuredClone(mem.rows.get("data.enc"));
    const store = await restart();
    mem.failNextGet = true;
    const b = await store.boot();
    expect(b.kind).toBe("ready");
    store.actions.applyRemote(blank());
    await settle();
    expect(mem.rows.get("data.enc")).toEqual(before);
    expect(mem.rows.has("data")).toBe(false);
  });

  it("a wrong PIN leaves the vault alone; the right PIN opens it and saves again", async () => {
    await makeVault();
    const sealed = structuredClone(mem.rows.get("data.enc")) as never;
    const store = await restart();
    await store.boot();
    expect(await store.unlockWith("0000", sealed)).toBe(false);
    expect(mem.rows.get("data.enc")).toEqual(sealed);
    expect(await store.unlockWith(PIN, sealed)).toBe(true);
    expect(store.getData().companions[0].name).toBe("Biscuit");
    store.actions.setSettings({ userName: "Sam" });
    await store.flush();
    expect(mem.rows.has("data")).toBe(false);
    const after = await store.boot();
    expect(after.kind).toBe("locked");
  });

  it("erasing from the lock screen (Forgot PIN) still works: the explicit erase may write", async () => {
    await makeVault();
    const store = await restart();
    await store.boot();
    await store.actions.resetAll();
    await store.flush();
    expect(mem.rows.has("data.enc")).toBe(false);
    expect(mem.rows.get("data")).toMatchObject({ settings: { onboarded: false } });
  });
});

function blank() {
  return { v: 2 as const, updatedAt: 0, summaries: {}, urges: [], journal: [], cleanDays: [], companions: [], habits: [], entries: [], settings: {} };
}
